-- ============================================================================
-- 0025_finance.sql
--
-- Fase 9, Bloco A — backend do módulo financeiro. Objetivo: ajudar o
-- profissional a entender o consultório e precificar a consulta — NÃO é um
-- ERP (sem centro de custo, rateio contábil, conciliação bancária, DRE ou
-- plano de contas).
--
-- Três tabelas:
--   expenses         — despesas do consultório (custo fixo/variável)
--   patient_billings — o ACORDO de cobrança com o paciente (avulso ou pacote)
--   payments         — as parcelas/recebimentos desse acordo
--
-- "Pendente" é DERIVADO (payments.data_pagamento is null), nunca uma coluna
-- de status separada — mesmo princípio já usado no projeto para evitar um
-- campo que possa ficar dessincronizado do dado real (ex.: IMC calculado on
-- the fly em vez de armazenado).
--
-- Todo valor monetário é numeric(10,2) — nunca float/double precision, que
-- gera erro de arredondamento perceptível ao somar um mês inteiro de
-- lançamentos. A soma/normalização em JS (src/lib/finance.ts) também evita
-- ponto flutuante, operando em centavos internamente.
--
-- Mesmo padrão de soft delete + RLS desde a migration 0005, e mesmo padrão
-- de funções SECURITY DEFINER para soft delete desde a migration 0017 (bug
-- sistêmico: a policy de SELECT com `deleted_at is null` rejeita o próprio
-- UPDATE que torna a linha invisível por ela mesma).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EXPENSES — despesas do consultório
-- ----------------------------------------------------------------------------
create table if not exists public.expenses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  descricao text not null,
  categoria text not null,
  valor numeric(10,2) not null check (valor > 0),
  recorrencia text not null
    check (recorrencia in ('unica', 'mensal', 'trimestral', 'semestral', 'anual')),
  /** Dia do mês (1–31) de vencimento — só usado quando recorrencia <> 'unica'. */
  dia_vencimento integer check (dia_vencimento between 1 and 31),
  /** Data de vencimento — só usada quando recorrencia = 'unica'. */
  data_vencimento date,
  /** Uma despesa recorrente pode ser encerrada sem apagar o histórico já lançado. */
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint expenses_vencimento_check check (
    (recorrencia = 'unica' and dia_vencimento is null)
    or (recorrencia <> 'unica' and data_vencimento is null)
  )
);

comment on table public.expenses is 'Despesas do consultório (custo fixo/variável). Fase 9 — módulo financeiro, não um ERP.';
comment on column public.expenses.valor is 'numeric(10,2) — nunca float. Ver src/lib/finance.ts para normalização sem erro de arredondamento.';
comment on column public.expenses.recorrencia is 'unica | mensal | trimestral | semestral | anual. "unica" nunca entra no custo fixo mensal recorrente (normalizeToMonthly).';
comment on column public.expenses.ativa is 'Despesa recorrente pode ser encerrada (ativa = false) sem apagar o histórico já lançado — deleted_at é para exclusão, isto é para "não recorre mais".';
comment on column public.expenses.deleted_at is 'Soft delete — mesmo padrão de anamnesis.deleted_at (migration 0005).';

create index if not exists expenses_user_id_idx on public.expenses (user_id) where deleted_at is null;
create index if not exists expenses_ativa_idx on public.expenses (user_id, ativa) where deleted_at is null;

drop trigger if exists set_updated_at on public.expenses;
create trigger set_updated_at before update on public.expenses
  for each row execute procedure public.set_updated_at();

alter table public.expenses enable row level security;

create policy "expenses_select_own" on public.expenses
  for select using (auth.uid() = user_id and deleted_at is null);
create policy "expenses_insert_own" on public.expenses
  for insert with check (auth.uid() = user_id);
create policy "expenses_update_own" on public.expenses
  for update using (auth.uid() = user_id);
create policy "expenses_delete_own" on public.expenses
  for delete using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 2. PATIENT_BILLINGS — o acordo de cobrança com o paciente
-- ----------------------------------------------------------------------------
create table if not exists public.patient_billings (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  tipo text not null check (tipo in ('avulso', 'pacote')),
  descricao text not null,
  valor_total numeric(10,2) not null check (valor_total > 0),
  /** Só para tipo = 'pacote' — quantas consultas o pacote cobre. */
  numero_consultas integer check (numero_consultas > 0),
  data_inicio date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- Nome explícito diferente de "patient_billings_numero_consultas_check" de propósito:
  -- esse nome colidiria com o nome que o Postgres gera sozinho para o CHECK inline da
  -- coluna numero_consultas logo acima (padrão "<tabela>_<coluna>_check").
  constraint patient_billings_tipo_consultas_check check (
    (tipo = 'avulso' and numero_consultas is null)
    or (tipo = 'pacote')
  )
);

comment on table public.patient_billings is 'O ACORDO de cobrança com o paciente (avulso = 1 consulta, pacote = N consultas). As parcelas/recebimentos ficam em payments. Avulso = 1 billing com 1 payment; pacote = 1 billing com N payments (ou 1, se pago à vista).';
comment on column public.patient_billings.valor_total is 'numeric(10,2) — nunca float.';
comment on column public.patient_billings.deleted_at is 'Soft delete — mesmo padrão de anamnesis.deleted_at (migration 0005).';

create index if not exists patient_billings_patient_id_idx on public.patient_billings (patient_id) where deleted_at is null;
create index if not exists patient_billings_user_id_idx on public.patient_billings (user_id) where deleted_at is null;

drop trigger if exists set_updated_at on public.patient_billings;
create trigger set_updated_at before update on public.patient_billings
  for each row execute procedure public.set_updated_at();

alter table public.patient_billings enable row level security;

create policy "patient_billings_select_own" on public.patient_billings
  for select using (auth.uid() = user_id and deleted_at is null);
create policy "patient_billings_insert_own" on public.patient_billings
  for insert with check (auth.uid() = user_id);
create policy "patient_billings_update_own" on public.patient_billings
  for update using (auth.uid() = user_id);
create policy "patient_billings_delete_own" on public.patient_billings
  for delete using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 3. PAYMENTS — parcelas/recebimentos de um patient_billing
-- ----------------------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default uuid_generate_v4(),
  billing_id uuid not null references public.patient_billings (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  valor numeric(10,2) not null check (valor > 0),
  data_vencimento date not null,
  /** NULL = pendente. Nunca uma coluna "status" separada — evita dessincronia entre os dois campos. */
  data_pagamento date,
  forma_pagamento text check (forma_pagamento in ('pix', 'dinheiro', 'cartao', 'transferencia', 'outro')),
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- Nome explícito diferente de "payments_forma_pagamento_check" de propósito: colidiria
  -- com o nome que o Postgres gera sozinho para o CHECK inline da coluna forma_pagamento
  -- logo acima (padrão "<tabela>_<coluna>_check").
  constraint payments_pagamento_consistente_check check (
    (data_pagamento is null and forma_pagamento is null)
    or (data_pagamento is not null and forma_pagamento is not null)
  )
);

comment on table public.payments is 'Parcelas/recebimentos de um patient_billing. "Pendente" é derivado: data_pagamento is null — nunca uma coluna de status própria.';
comment on column public.payments.valor is 'numeric(10,2) — nunca float.';
comment on column public.payments.data_pagamento is 'NULL = pendente. Setado junto com forma_pagamento no momento da baixa.';
comment on column public.payments.deleted_at is 'Soft delete — mesmo padrão de anamnesis.deleted_at (migration 0005).';

create index if not exists payments_billing_id_idx on public.payments (billing_id) where deleted_at is null;
create index if not exists payments_user_id_idx on public.payments (user_id) where deleted_at is null;
create index if not exists payments_pendentes_idx on public.payments (user_id, data_vencimento) where deleted_at is null and data_pagamento is null;

drop trigger if exists set_updated_at on public.payments;
create trigger set_updated_at before update on public.payments
  for each row execute procedure public.set_updated_at();

alter table public.payments enable row level security;

create policy "payments_select_own" on public.payments
  for select using (auth.uid() = user_id and deleted_at is null);
create policy "payments_insert_own" on public.payments
  for insert with check (auth.uid() = user_id);
create policy "payments_update_own" on public.payments
  for update using (auth.uid() = user_id);
create policy "payments_delete_own" on public.payments
  for delete using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 4. Soft delete via função SECURITY DEFINER — mesmo padrão da migration 0017.
--    Sem isso, o UPDATE que seta deleted_at é rejeitado pela própria policy
--    de SELECT (`deleted_at is null`) no momento em que a linha deixa de ser
--    visível por ela mesma.
-- ----------------------------------------------------------------------------
create or replace function public.soft_delete_expense(expense_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.expenses
  set deleted_at = now()
  where id = expense_id
    and user_id = auth.uid()
    and deleted_at is null;

  return found;
end;
$$;

create or replace function public.soft_delete_patient_billing(billing_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.patient_billings
  set deleted_at = now()
  where id = billing_id
    and user_id = auth.uid()
    and deleted_at is null;

  return found;
end;
$$;

create or replace function public.soft_delete_payment(payment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.payments
  set deleted_at = now()
  where id = payment_id
    and user_id = auth.uid()
    and deleted_at is null;

  return found;
end;
$$;

revoke all on function public.soft_delete_expense(uuid) from public;
revoke all on function public.soft_delete_patient_billing(uuid) from public;
revoke all on function public.soft_delete_payment(uuid) from public;

grant execute on function public.soft_delete_expense(uuid) to authenticated;
grant execute on function public.soft_delete_patient_billing(uuid) to authenticated;
grant execute on function public.soft_delete_payment(uuid) to authenticated;
