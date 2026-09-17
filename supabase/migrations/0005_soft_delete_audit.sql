-- ============================================================================
-- AuriNutri - Migration 0005
-- Fase 3, Bloco A — soft delete estrutural (via RLS, não via disciplina de
-- query) + trilha de auditoria nas tabelas clínicas.
--
-- DECISÃO DE ARQUITETURA: o filtro "deleted_at is null" entra na cláusula
-- USING da policy de SELECT de cada tabela, não em cada query da aplicação.
-- Isso significa que um registro excluído fica invisível para QUALQUER
-- select — inclusive um esquecido, futuro, ou de uma ferramenta externa
-- (Table Editor, outro serviço) — porque a garantia está no banco, não no
-- código. Nenhuma query da aplicação precisa (nem deve) adicionar
-- `.is("deleted_at", null)` manualmente: seria redundante.
--
-- DECISÃO DE PRODUTO (ver DECISIONS.md D5): excluir um PACIENTE continua
-- sendo uma exclusão real e definitiva — apaga o paciente e, em cascata
-- (FK on delete cascade já existente desde 0001), anamnese, avaliações,
-- planos, refeições e itens dele. `patients` NÃO recebe `deleted_at`.
-- O soft delete desta migration vale para exclusões pontuais dentro de um
-- paciente que continua ativo: uma avaliação errada, um plano antigo, um
-- item de refeição — coisas que fazem sentido poder desfazer.
--
-- `foods` também recebe a coluna `deleted_at` e o mesmo filtro no SELECT,
-- por consistência de schema — mas o fluxo de exclusão de alimentos
-- (deleteFood, usado pela UI e nunca pelo script de importação da TACO)
-- CONTINUA fazendo hard delete, sem mudança de comportamento. A coluna fica
-- pronta caso uma fase futura decida aplicar soft delete a `foods` também;
-- até lá, `deleted_at` nunca é setado nessa tabela e o filtro é um no-op.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. DELETED_AT — nullable, sem default (null = ativo/visível).
--    NÃO inclui `patients` — ver decisão de produto acima.
-- ----------------------------------------------------------------------------
alter table public.anamnesis add column if not exists deleted_at timestamptz;
alter table public.anthropometric_assessments add column if not exists deleted_at timestamptz;
alter table public.meal_plans add column if not exists deleted_at timestamptz;
alter table public.meals add column if not exists deleted_at timestamptz;
alter table public.meal_items add column if not exists deleted_at timestamptz;
alter table public.foods add column if not exists deleted_at timestamptz;

comment on column public.anamnesis.deleted_at is 'Soft delete: não-nulo = excluído. Invisível via RLS (ver policy de select), nunca removido fisicamente.';
comment on column public.anthropometric_assessments.deleted_at is 'Soft delete — ver comentário em anamnesis.deleted_at.';
comment on column public.meal_plans.deleted_at is 'Soft delete — ver comentário em anamnesis.deleted_at.';
comment on column public.meals.deleted_at is 'Soft delete — ver comentário em anamnesis.deleted_at.';
comment on column public.meal_items.deleted_at is 'Soft delete — ver comentário em anamnesis.deleted_at.';
comment on column public.foods.deleted_at is 'Reservado para uso futuro. deleteFood continua fazendo hard delete; esta coluna nunca é setada hoje.';

-- ----------------------------------------------------------------------------
-- 2. RLS — soft delete aplicado na policy de SELECT, não nas queries.
--    `patients_select_own` NÃO muda (paciente excluído é apagado de verdade,
--    então já não existe mais linha nenhuma pra filtrar).
-- ----------------------------------------------------------------------------
drop policy if exists "anamnesis_select_own" on public.anamnesis;
create policy "anamnesis_select_own" on public.anamnesis
  for select using (auth.uid() = user_id and deleted_at is null);

drop policy if exists "assessments_select_own" on public.anthropometric_assessments;
create policy "assessments_select_own" on public.anthropometric_assessments
  for select using (auth.uid() = user_id and deleted_at is null);

drop policy if exists "meal_plans_select_own" on public.meal_plans;
create policy "meal_plans_select_own" on public.meal_plans
  for select using (auth.uid() = user_id and deleted_at is null);

drop policy if exists "meals_select_own" on public.meals;
create policy "meals_select_own" on public.meals
  for select using (auth.uid() = user_id and deleted_at is null);

drop policy if exists "meal_items_select_own" on public.meal_items;
create policy "meal_items_select_own" on public.meal_items
  for select using (auth.uid() = user_id and deleted_at is null);

drop policy if exists "foods_select_global_or_own" on public.foods;
create policy "foods_select_global_or_own" on public.foods
  for select using ((is_global = true or auth.uid() = user_id) and deleted_at is null);

-- ----------------------------------------------------------------------------
-- 3. Índices parciais — mesmas definições de antes, agora restritas a
--    "where deleted_at is null" para não crescer com registros excluídos e
--    para casar exatamente com o filtro que a RLS já aplica em todo SELECT.
--    Índices de `patients` não mudam (tabela não tem deleted_at).
-- ----------------------------------------------------------------------------
drop index if exists public.anamnesis_user_id_idx;
create index anamnesis_user_id_idx on public.anamnesis (user_id) where deleted_at is null;

drop index if exists public.anamnesis_patient_id_idx;
create index anamnesis_patient_id_idx on public.anamnesis (patient_id) where deleted_at is null;

drop index if exists public.assessments_user_id_idx;
create index assessments_user_id_idx on public.anthropometric_assessments (user_id) where deleted_at is null;

drop index if exists public.assessments_patient_id_idx;
create index assessments_patient_id_idx on public.anthropometric_assessments (patient_id) where deleted_at is null;

drop index if exists public.assessments_data_idx;
create index assessments_data_idx on public.anthropometric_assessments (data_avaliacao) where deleted_at is null;

drop index if exists public.meal_plans_user_id_idx;
create index meal_plans_user_id_idx on public.meal_plans (user_id) where deleted_at is null;

drop index if exists public.meal_plans_patient_id_idx;
create index meal_plans_patient_id_idx on public.meal_plans (patient_id) where deleted_at is null;

drop index if exists public.meals_user_id_idx;
create index meals_user_id_idx on public.meals (user_id) where deleted_at is null;

drop index if exists public.meals_meal_plan_id_idx;
create index meals_meal_plan_id_idx on public.meals (meal_plan_id) where deleted_at is null;

drop index if exists public.meal_items_user_id_idx;
create index meal_items_user_id_idx on public.meal_items (user_id) where deleted_at is null;

drop index if exists public.meal_items_meal_id_idx;
create index meal_items_meal_id_idx on public.meal_items (meal_id) where deleted_at is null;

drop index if exists public.meal_items_food_id_idx;
create index meal_items_food_id_idx on public.meal_items (food_id) where deleted_at is null;

drop index if exists public.foods_user_id_idx;
create index foods_user_id_idx on public.foods (user_id) where deleted_at is null;

drop index if exists public.foods_nome_idx;
create index foods_nome_idx on public.foods using gin (to_tsvector('portuguese', nome)) where deleted_at is null;

drop index if exists public.foods_nome_trgm_idx;
create index foods_nome_trgm_idx on public.foods using gin (nome gin_trgm_ops) where deleted_at is null;

drop index if exists public.foods_categoria_idx;
create index foods_categoria_idx on public.foods (categoria) where deleted_at is null;

drop index if exists public.foods_is_global_idx;
create index foods_is_global_idx on public.foods (is_global) where deleted_at is null;

drop index if exists public.foods_fonte_idx;
create index foods_fonte_idx on public.foods (fonte) where deleted_at is null;

-- ----------------------------------------------------------------------------
-- 4. AUDIT_LOG — trilha de auditoria das tabelas clínicas
-- ----------------------------------------------------------------------------
create table if not exists public.audit_log (
  id uuid primary key default uuid_generate_v4(),
  tabela text not null,
  registro_id uuid not null,
  acao text not null check (acao in ('insert', 'update', 'delete')),
  user_id uuid references auth.users (id) on delete set null,
  "timestamp" timestamptz not null default now(),
  dados_anteriores jsonb,
  dados_novos jsonb
);

comment on table public.audit_log is 'Trilha de auditoria das tabelas clínicas. Só é escrita pelo trigger log_audit_event (security definer) — nunca diretamente pela aplicação.';
comment on column public.audit_log.acao is E'insert | update | delete. Para tabelas com soft delete, "delete" cobre a exclusão lógica (update que seta deleted_at pela primeira vez). Para `patients` (hard delete real, com cascata), "delete" é um DELETE de verdade.';

create index if not exists audit_log_user_id_idx on public.audit_log (user_id);
create index if not exists audit_log_tabela_registro_idx on public.audit_log (tabela, registro_id);

alter table public.audit_log enable row level security;

-- Cada profissional só lê os próprios registros de auditoria.
create policy "audit_log_select_own" on public.audit_log
  for select using (auth.uid() = user_id);

-- Nenhuma policy de insert/update/delete é criada de propósito: com RLS
-- habilitada, a ausência de policy para uma operação nega essa operação por
-- padrão para qualquer role da API (anon/authenticated). A única forma de
-- gravar em audit_log é a trigger abaixo, que roda como SECURITY DEFINER
-- (dono da função = role que aplicou esta migration, que é dono da tabela e
-- portanto ignora RLS) — nunca através de uma chamada da API.

-- ----------------------------------------------------------------------------
-- 5. Trigger de auditoria — genérica, uma função para as 4 tabelas clínicas.
--    Usa jsonb (não OLD.deleted_at direto) para detectar soft delete, porque
--    a mesma função é usada em `patients`, que não tem essa coluna — checar
--    o campo diretamente quebraria nessa tabela.
-- ----------------------------------------------------------------------------
create or replace function public.log_audit_event()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  acao text;
  actor_id uuid;
  registro uuid;
  old_json jsonb;
  new_json jsonb;
begin
  old_json := case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(OLD) else null end;
  new_json := case when TG_OP in ('INSERT', 'UPDATE') then to_jsonb(NEW) else null end;

  acao := lower(TG_OP);

  -- Uma exclusão lógica (soft delete) é, no Postgres, um UPDATE — mas para
  -- quem lê a auditoria, é uma exclusão. Detecta a transição
  -- "não excluído -> excluído" (só existe em tabelas com deleted_at) e
  -- registra como "delete", não "update".
  if TG_OP = 'UPDATE'
     and old_json ? 'deleted_at'
     and old_json ->> 'deleted_at' is null
     and new_json ->> 'deleted_at' is not null then
    acao := 'delete';
  end if;

  if TG_OP = 'DELETE' then
    registro := OLD.id;
  else
    registro := NEW.id;
  end if;

  -- auth.uid() é o profissional autenticado que fez a requisição. Cai para
  -- o user_id dono do registro se não houver um usuário autenticado na
  -- sessão atual (ex.: uma correção feita manualmente com a service role).
  actor_id := coalesce(auth.uid(), case when TG_OP = 'DELETE' then OLD.user_id else NEW.user_id end);

  insert into public.audit_log (tabela, registro_id, acao, user_id, dados_anteriores, dados_novos)
  values (TG_TABLE_NAME, registro, acao, actor_id, old_json, new_json);

  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists audit_patients on public.patients;
create trigger audit_patients
  after insert or update or delete on public.patients
  for each row execute procedure public.log_audit_event();

drop trigger if exists audit_anamnesis on public.anamnesis;
create trigger audit_anamnesis
  after insert or update or delete on public.anamnesis
  for each row execute procedure public.log_audit_event();

drop trigger if exists audit_anthropometric_assessments on public.anthropometric_assessments;
create trigger audit_anthropometric_assessments
  after insert or update or delete on public.anthropometric_assessments
  for each row execute procedure public.log_audit_event();

drop trigger if exists audit_meal_plans on public.meal_plans;
create trigger audit_meal_plans
  after insert or update or delete on public.meal_plans
  for each row execute procedure public.log_audit_event();
