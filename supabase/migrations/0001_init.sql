-- ============================================================================
-- AuriNutri - Migration inicial
-- Schema multiusuário com Row Level Security (RLS)
-- Cada nutricionista (auth.users) só acessa seus próprios dados.
-- ============================================================================

-- Extensões necessárias
create extension if not exists "uuid-ossp";

-- ============================================================================
-- 1. PROFILES (dados do nutricionista, espelha auth.users)
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  email text not null,
  crn text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Dados públicos do nutricionista, 1:1 com auth.users';

-- Cria o profile automaticamente quando um usuário se cadastra
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nome, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================================
-- 2. PATIENTS (pacientes do nutricionista)
-- ============================================================================
create table if not exists public.patients (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nome text not null,
  email text,
  telefone text,
  data_nascimento date,
  sexo text check (sexo in ('feminino', 'masculino', 'outro')),
  endereco text,
  objetivo text,
  observacoes text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists patients_user_id_idx on public.patients (user_id);
create index if not exists patients_nome_idx on public.patients using gin (to_tsvector('portuguese', nome));

-- ============================================================================
-- 3. ANAMNESIS (anamnese do paciente - um registro por paciente, editável)
-- ============================================================================
create table if not exists public.anamnesis (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null unique references public.patients (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  queixa_principal text,
  historico_saude text,
  historico_familiar text,
  habitos_alimentares text,
  atividade_fisica text,
  qualidade_sono text,
  alergias text,
  intolerancias text,
  medicamentos text,
  suplementos text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists anamnesis_user_id_idx on public.anamnesis (user_id);
create index if not exists anamnesis_patient_id_idx on public.anamnesis (patient_id);

-- ============================================================================
-- 4. ANTHROPOMETRIC ASSESSMENTS (avaliações antropométricas / evolução)
-- ============================================================================
create table if not exists public.anthropometric_assessments (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  data_avaliacao date not null default current_date,
  peso_kg numeric(6, 2) not null check (peso_kg > 0),
  altura_cm numeric(6, 2) not null check (altura_cm > 0),
  imc numeric(6, 2) generated always as (
    round((peso_kg / ((altura_cm / 100) * (altura_cm / 100)))::numeric, 2)
  ) stored,
  circunferencia_cintura_cm numeric(6, 2),
  circunferencia_quadril_cm numeric(6, 2),
  circunferencia_braco_cm numeric(6, 2),
  circunferencia_coxa_cm numeric(6, 2),
  circunferencia_pescoco_cm numeric(6, 2),
  percentual_gordura numeric(5, 2),
  observacoes text,
  created_at timestamptz not null default now()
);

create index if not exists assessments_user_id_idx on public.anthropometric_assessments (user_id);
create index if not exists assessments_patient_id_idx on public.anthropometric_assessments (patient_id);
create index if not exists assessments_data_idx on public.anthropometric_assessments (data_avaliacao);

-- ============================================================================
-- 5. FOODS (banco de alimentos personalizado por nutricionista)
-- ============================================================================
create table if not exists public.foods (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nome text not null,
  categoria text not null,
  marca text,
  porcao_referencia_g numeric(7, 2) not null default 100,
  calorias_kcal numeric(7, 2) not null default 0,
  proteinas_g numeric(7, 2) not null default 0,
  carboidratos_g numeric(7, 2) not null default 0,
  gorduras_g numeric(7, 2) not null default 0,
  fibras_g numeric(7, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists foods_user_id_idx on public.foods (user_id);
create index if not exists foods_nome_idx on public.foods using gin (to_tsvector('portuguese', nome));
create index if not exists foods_categoria_idx on public.foods (categoria);

-- ============================================================================
-- 6. MEAL PLANS (planos alimentares)
-- ============================================================================
create table if not exists public.meal_plans (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  nome text not null default 'Plano Alimentar',
  data_inicio date not null default current_date,
  ativo boolean not null default true,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists meal_plans_user_id_idx on public.meal_plans (user_id);
create index if not exists meal_plans_patient_id_idx on public.meal_plans (patient_id);

-- ============================================================================
-- 7. MEALS (refeições dentro de um plano)
-- ============================================================================
create table if not exists public.meals (
  id uuid primary key default uuid_generate_v4(),
  meal_plan_id uuid not null references public.meal_plans (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  nome text not null,
  horario time,
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists meals_user_id_idx on public.meals (user_id);
create index if not exists meals_meal_plan_id_idx on public.meals (meal_plan_id);

-- ============================================================================
-- 8. MEAL ITEMS (alimentos dentro de uma refeição, com quantidade)
-- ============================================================================
create table if not exists public.meal_items (
  id uuid primary key default uuid_generate_v4(),
  meal_id uuid not null references public.meals (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete cascade,
  quantidade_g numeric(7, 2) not null check (quantidade_g > 0),
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists meal_items_user_id_idx on public.meal_items (user_id);
create index if not exists meal_items_meal_id_idx on public.meal_items (meal_id);
create index if not exists meal_items_food_id_idx on public.meal_items (food_id);

-- ============================================================================
-- TRIGGERS: updated_at automático
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at on public.patients;
create trigger set_updated_at before update on public.patients
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at on public.anamnesis;
create trigger set_updated_at before update on public.anamnesis
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at on public.foods;
create trigger set_updated_at before update on public.foods
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at on public.meal_plans;
create trigger set_updated_at before update on public.meal_plans
  for each row execute procedure public.set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.anamnesis enable row level security;
alter table public.anthropometric_assessments enable row level security;
alter table public.foods enable row level security;
alter table public.meal_plans enable row level security;
alter table public.meals enable row level security;
alter table public.meal_items enable row level security;

-- PROFILES: cada usuário só vê/edita o próprio perfil
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- PATIENTS
create policy "patients_select_own" on public.patients
  for select using (auth.uid() = user_id);
create policy "patients_insert_own" on public.patients
  for insert with check (auth.uid() = user_id);
create policy "patients_update_own" on public.patients
  for update using (auth.uid() = user_id);
create policy "patients_delete_own" on public.patients
  for delete using (auth.uid() = user_id);

-- ANAMNESIS
create policy "anamnesis_select_own" on public.anamnesis
  for select using (auth.uid() = user_id);
create policy "anamnesis_insert_own" on public.anamnesis
  for insert with check (auth.uid() = user_id);
create policy "anamnesis_update_own" on public.anamnesis
  for update using (auth.uid() = user_id);
create policy "anamnesis_delete_own" on public.anamnesis
  for delete using (auth.uid() = user_id);

-- ANTHROPOMETRIC ASSESSMENTS
create policy "assessments_select_own" on public.anthropometric_assessments
  for select using (auth.uid() = user_id);
create policy "assessments_insert_own" on public.anthropometric_assessments
  for insert with check (auth.uid() = user_id);
create policy "assessments_update_own" on public.anthropometric_assessments
  for update using (auth.uid() = user_id);
create policy "assessments_delete_own" on public.anthropometric_assessments
  for delete using (auth.uid() = user_id);

-- FOODS
create policy "foods_select_own" on public.foods
  for select using (auth.uid() = user_id);
create policy "foods_insert_own" on public.foods
  for insert with check (auth.uid() = user_id);
create policy "foods_update_own" on public.foods
  for update using (auth.uid() = user_id);
create policy "foods_delete_own" on public.foods
  for delete using (auth.uid() = user_id);

-- MEAL PLANS
create policy "meal_plans_select_own" on public.meal_plans
  for select using (auth.uid() = user_id);
create policy "meal_plans_insert_own" on public.meal_plans
  for insert with check (auth.uid() = user_id);
create policy "meal_plans_update_own" on public.meal_plans
  for update using (auth.uid() = user_id);
create policy "meal_plans_delete_own" on public.meal_plans
  for delete using (auth.uid() = user_id);

-- MEALS
create policy "meals_select_own" on public.meals
  for select using (auth.uid() = user_id);
create policy "meals_insert_own" on public.meals
  for insert with check (auth.uid() = user_id);
create policy "meals_update_own" on public.meals
  for update using (auth.uid() = user_id);
create policy "meals_delete_own" on public.meals
  for delete using (auth.uid() = user_id);

-- MEAL ITEMS
create policy "meal_items_select_own" on public.meal_items
  for select using (auth.uid() = user_id);
create policy "meal_items_insert_own" on public.meal_items
  for insert with check (auth.uid() = user_id);
create policy "meal_items_update_own" on public.meal_items
  for update using (auth.uid() = user_id);
create policy "meal_items_delete_own" on public.meal_items
  for delete using (auth.uid() = user_id);
