-- ============================================================================
-- 0042 — Fase 16 (Roadmap 2): cálculo energético.
--
-- Só acrescenta (tabela nova). Seguro de aplicar com o site no ar.
--
-- energy_calculations — cálculos de gasto energético do paciente, com nome
-- ("Dias de treino"), como no WebDiet. É criado ao abrir e salvo sozinho
-- (mesmo fluxo da antropometria, migration 0041). Guarda as ENTRADAS
-- (peso, altura, massa livre de gordura, fórmula, fatores, ajustes) e, como
-- foto do momento, a TMB e o GET recalculados no servidor a cada gravação
-- (src/lib/energy-formulas.ts) — é o GET que o planejamento do plano
-- alimentar importa na Fase 17.
--
-- Mesmo padrão das tabelas clínicas: RLS por auth.uid() = user_id (com o
-- paciente também tendo de ser do profissional), soft delete por função
-- security definer (padrão 0017) e trilha de auditoria (0005).
-- ============================================================================

create table if not exists public.energy_calculations (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  nome text check (char_length(nome) <= 80),
  data_calculo date not null default current_date,
  -- Avaliação de onde os dados foram importados (só rastreio; os valores ficam copiados aqui).
  assessment_id uuid references public.anthropometric_assessments (id) on delete set null,

  -- 1. Dados antropométricos
  peso_kg numeric(6, 2) check (peso_kg > 0),
  altura_cm numeric(6, 2) check (altura_cm > 0),
  massa_livre_gordura_kg numeric(6, 2) check (massa_livre_gordura_kg > 0),
  -- Base das fórmulas quando o paciente é "outro" ou não tem sexo (nunca assumida).
  sexo_referencia text check (sexo_referencia in ('masculino', 'feminino')),

  -- 2. Fórmula e fatores
  formula text,
  nivel_eer text check (nivel_eer in ('inativo', 'pouco_ativo', 'ativo', 'muito_ativo')),
  kcal_por_kg numeric(6, 2) check (kcal_por_kg > 0),
  valor_manual_kcal numeric(7, 1) check (valor_manual_kcal > 0),
  fator_atividade numeric(5, 3) not null default 1 check (fator_atividade > 0),
  fator_injuria numeric(5, 3) not null default 1 check (fator_injuria > 0),
  fator_injuria_label text,

  -- 3. Ajustes refinados
  -- Atividades do Compendium: [{ "codigo", "nome", "met", "minutos" }] — minutos por dia.
  atividades_met jsonb not null default '[]'::jsonb,
  venta_kg numeric(5, 1),
  venta_dias integer check (venta_dias > 0),
  adicional_gestante_kcal numeric(6, 1) check (adicional_gestante_kcal >= 0),

  -- 4. Resultado (foto do momento, recalculada no servidor a cada gravação)
  tmb_kcal numeric(7, 1),
  get_kcal numeric(7, 1),

  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.energy_calculations is 'Cálculos de gasto energético do paciente (Fase 16). Criados ao abrir e salvos sozinhos; tmb_kcal/get_kcal recalculados no servidor.';
comment on column public.energy_calculations.atividades_met is 'Atividades do Compendium of Physical Activities (uso comercial permitido com citação, valores de MET sem alteração): [{codigo, nome, met, minutos por dia}].';
comment on column public.energy_calculations.deleted_at is 'Soft delete — exclusão via soft_delete_energy_calculation (padrão 0017), nunca UPDATE direto.';

create index if not exists energy_calculations_user_id_idx on public.energy_calculations (user_id) where deleted_at is null;
create index if not exists energy_calculations_patient_id_idx on public.energy_calculations (patient_id) where deleted_at is null;

drop trigger if exists set_updated_at on public.energy_calculations;
create trigger set_updated_at before update on public.energy_calculations
  for each row execute procedure public.set_updated_at();

drop trigger if exists audit_energy_calculations on public.energy_calculations;
create trigger audit_energy_calculations
  after insert or update or delete on public.energy_calculations
  for each row execute procedure public.log_audit_event();

alter table public.energy_calculations enable row level security;

create policy "energy_calculations_select_own" on public.energy_calculations
  for select using (auth.uid() = user_id and deleted_at is null);
create policy "energy_calculations_insert_own" on public.energy_calculations
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.patients p where p.id = patient_id and p.user_id = auth.uid())
  );
create policy "energy_calculations_update_own" on public.energy_calculations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "energy_calculations_delete_own" on public.energy_calculations
  for delete using (auth.uid() = user_id);

create or replace function public.soft_delete_energy_calculation(calculation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.energy_calculations
  set deleted_at = now()
  where id = calculation_id
    and user_id = auth.uid()
    and deleted_at is null;

  return found;
end;
$$;

revoke all on function public.soft_delete_energy_calculation(uuid) from public;
grant execute on function public.soft_delete_energy_calculation(uuid) to authenticated;
