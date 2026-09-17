-- ============================================================================
-- 0011_appointments_tasks.sql
--
-- Fase 5, Bloco A (backend) — agenda: consultas (appointments) e pendências
-- (tasks). Mesmo padrão de soft delete + RLS já usado desde a migration 0005
-- (deleted_at na cláusula USING do SELECT, nunca filtrado pela aplicação).
--
-- FUSO HORÁRIO: data_hora é timestamptz (instante absoluto em UTC dentro do
-- Postgres, sempre — isso não muda com a decisão abaixo). O que muda por
-- profissional é como esse instante é INTERPRETADO na entrada (horário de
-- parede digitado) e EXIBIDO na saída. profiles.fuso_horario guarda o fuso
-- IANA do profissional (ex. "America/Sao_Paulo") para essas duas conversões,
-- feitas em src/lib/timezone.ts — nunca no fuso do servidor que executa o
-- código. Ver explicação completa dada ao usuário antes desta migration.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PROFILES — fuso horário do profissional
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists fuso_horario text not null default 'America/Sao_Paulo';

comment on column public.profiles.fuso_horario is 'Fuso IANA do profissional (ex. "America/Sao_Paulo"), usado para interpretar/exibir data_hora de appointments. Nunca usar o fuso do servidor.';

-- ----------------------------------------------------------------------------
-- 2. APPOINTMENTS — consultas/agendamentos
-- ----------------------------------------------------------------------------
create table if not exists public.appointments (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  data_hora timestamptz not null,
  duracao_min integer not null default 60 check (duracao_min > 0),
  tipo text not null check (tipo in ('primeira_consulta', 'retorno', 'avaliacao', 'outro')),
  status text not null default 'agendado'
    check (status in ('agendado', 'confirmado', 'realizado', 'faltou', 'cancelado')),
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on column public.appointments.data_hora is 'Instante absoluto (UTC) da consulta. Interpretado/exibido no fuso de profiles.fuso_horario pela aplicação — nunca no fuso do servidor.';
comment on column public.appointments.deleted_at is 'Soft delete — mesmo padrão de anamnesis.deleted_at (migration 0005).';

create index if not exists appointments_patient_id_idx on public.appointments (patient_id) where deleted_at is null;
create index if not exists appointments_user_data_idx on public.appointments (user_id, data_hora) where deleted_at is null;

drop trigger if exists set_updated_at on public.appointments;
create trigger set_updated_at before update on public.appointments
  for each row execute procedure public.set_updated_at();

alter table public.appointments enable row level security;

create policy "appointments_select_own" on public.appointments
  for select using (auth.uid() = user_id and deleted_at is null);
create policy "appointments_insert_own" on public.appointments
  for insert with check (auth.uid() = user_id);
create policy "appointments_update_own" on public.appointments
  for update using (auth.uid() = user_id);
create policy "appointments_delete_own" on public.appointments
  for delete using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 3. TASKS — pendências, opcionalmente vinculadas a paciente e/ou consulta
-- ----------------------------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  patient_id uuid references public.patients (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete set null,
  titulo text not null,
  descricao text,
  concluida boolean not null default false,
  data_limite date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on column public.tasks.data_limite is 'Data (sem horário) — pendência não precisa de precisão de fuso como appointments.data_hora.';
comment on column public.tasks.appointment_id is 'on delete set null: uma pendência pode sobreviver a uma consulta reagendada/removida. Referência opcional, não estrutural.';
comment on column public.tasks.deleted_at is 'Soft delete — mesmo padrão de anamnesis.deleted_at (migration 0005).';

create index if not exists tasks_user_id_idx on public.tasks (user_id) where deleted_at is null;
create index if not exists tasks_patient_id_idx on public.tasks (patient_id) where deleted_at is null;
create index if not exists tasks_appointment_id_idx on public.tasks (appointment_id) where deleted_at is null;

drop trigger if exists set_updated_at on public.tasks;
create trigger set_updated_at before update on public.tasks
  for each row execute procedure public.set_updated_at();

alter table public.tasks enable row level security;

create policy "tasks_select_own" on public.tasks
  for select using (auth.uid() = user_id and deleted_at is null);
create policy "tasks_insert_own" on public.tasks
  for insert with check (auth.uid() = user_id);
create policy "tasks_update_own" on public.tasks
  for update using (auth.uid() = user_id);
create policy "tasks_delete_own" on public.tasks
  for delete using (auth.uid() = user_id);
