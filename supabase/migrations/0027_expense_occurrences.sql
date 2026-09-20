-- ============================================================================
-- 0027_expense_occurrences.sql
--
-- Fase 9, Bloco B — pedido do usuário: (1) uma etiqueta informativa de
-- "à vista" ou "parcelado" para despesas trimestral/semestral/anual (não
-- recalcula nada — é só pra lembrar como aquela conta é paga na prática);
-- (2) histórico de pagamento por despesa, para servir de base a um futuro
-- card "Despesas do mês" no dashboard.
--
-- expense_occurrences é o equivalente de `payments` (migration 0025) mas
-- para despesas do consultório em vez de cobranças de paciente: cada
-- vencimento real vira uma linha, "pendente" é derivado de
-- data_pagamento is null (mesmo princípio, nunca uma coluna de status).
-- Sem soft delete aqui de propósito — não há hoje nenhuma ação de excluir
-- uma ocorrência de pagamento, então não há o bug de RLS da migration 0017
-- pra evitar (esse padrão só é necessário quando existe um UPDATE que torna
-- a própria linha invisível pela policy de SELECT).
--
-- Geração das ocorrências: não há nenhum job agendado neste projeto (todo
-- processamento é por requisição). Por isso, a ocorrência do mês vigente de
-- cada despesa ativa é garantida ("upsert" idempotente, ignora se já existe)
-- toda vez que a página /financeiro é carregada — ver
-- ensureCurrentMonthExpenseOccurrences em src/lib/actions/finance.ts. Para
-- despesa 'unica', a única ocorrência já nasce junto com a despesa (a data é
-- conhecida de imediato, não precisa esperar o mês chegar).
-- ============================================================================

alter table public.expenses
  add column if not exists parcelamento text check (parcelamento in ('avista', 'parcelado'));

comment on column public.expenses.parcelamento is 'Etiqueta informativa (só para trimestral/semestral/anual) de como o profissional paga essa despesa na prática — NÃO divide o valor nem gera parcelas de verdade. Se quiser modelar parcelas reais, isso é uma despesa diferente, não uma opção desta.';

alter table public.expenses drop constraint if exists expenses_parcelamento_recorrencia_check;
alter table public.expenses add constraint expenses_parcelamento_recorrencia_check check (
  recorrencia in ('trimestral', 'semestral', 'anual') or parcelamento is null
);

create table if not exists public.expense_occurrences (
  id uuid primary key default uuid_generate_v4(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  /** Snapshot do valor da despesa no momento em que a ocorrência foi gerada — editar a despesa depois não reescreve o histórico já registrado. */
  valor numeric(10,2) not null check (valor > 0),
  data_vencimento date not null,
  /** NULL = pendente. Nunca uma coluna "status" separada — mesmo princípio de payments.data_pagamento. */
  data_pagamento date,
  forma_pagamento text check (forma_pagamento in ('pix', 'dinheiro', 'cartao', 'transferencia', 'outro')),
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expense_occurrences_pagamento_consistente_check check (
    (data_pagamento is null and forma_pagamento is null)
    or (data_pagamento is not null and forma_pagamento is not null)
  ),
  -- Garante geração idempotente: reprocessar o mesmo mês da mesma despesa nunca duplica.
  constraint expense_occurrences_unica_por_vencimento unique (expense_id, data_vencimento)
);

comment on table public.expense_occurrences is 'Histórico de vencimentos/pagamentos de uma despesa — equivalente de payments (migration 0025), mas para despesas do consultório. Base do futuro card "Despesas do mês" no dashboard.';

create index if not exists expense_occurrences_expense_id_idx on public.expense_occurrences (expense_id);
create index if not exists expense_occurrences_user_vencimento_idx on public.expense_occurrences (user_id, data_vencimento);

drop trigger if exists set_updated_at on public.expense_occurrences;
create trigger set_updated_at before update on public.expense_occurrences
  for each row execute procedure public.set_updated_at();

alter table public.expense_occurrences enable row level security;

create policy "expense_occurrences_select_own" on public.expense_occurrences
  for select using (auth.uid() = user_id);
create policy "expense_occurrences_insert_own" on public.expense_occurrences
  for insert with check (auth.uid() = user_id);
create policy "expense_occurrences_update_own" on public.expense_occurrences
  for update using (auth.uid() = user_id);
create policy "expense_occurrences_delete_own" on public.expense_occurrences
  for delete using (auth.uid() = user_id);
