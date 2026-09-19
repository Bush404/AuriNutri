-- ============================================================================
-- 0020_lab_exams.sql
--
-- Fase 7, Bloco B — exames laboratoriais. Três tabelas:
-- `lab_exams` (o exame em si — data, laboratório, arquivo opcional),
-- `lab_reference_ranges` (catálogo de faixas de referência, global +
-- personalizado por profissional, mesmo padrão de `foods` para TACO vs.
-- alimento personalizado), e `lab_markers` (resultados estruturados de um
-- exame, com SNAPSHOT da faixa usada — nunca uma FK para
-- lab_reference_ranges, mesmo princípio de meal_items/recipe_ingredients:
-- editar a faixa global depois não pode reinterpretar exames já lançados).
--
-- Upload de arquivo (bucket 'profissional', criado na migration 0004) e a
-- checagem de consentimento (migration 0019, has_active_patient_consent)
-- são aplicados na camada de Server Action, não aqui — RLS de storage.objects
-- já cobre `<user_id>/exames/...` porque a policy existente só olha o
-- primeiro segmento do path (auth.uid()), não precisa de policy nova.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. LAB_EXAMS
-- ----------------------------------------------------------------------------
create table if not exists public.lab_exams (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  data_coleta date not null,
  laboratorio text,
  -- Caminho no storage privado 'profissional' (ex. "<user_id>/exames/<uuid>.pdf")
  -- — NUNCA uma URL. A URL assinada é gerada sob demanda, de curta duração,
  -- nunca persistida (ver getLabExamFileSignedUrl).
  arquivo_path text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on column public.lab_exams.arquivo_path is 'Path no bucket privado "profissional" (pasta <user_id>/exames/) — nunca uma URL. Assinada sob demanda, nunca persistida.';
comment on column public.lab_exams.deleted_at is 'Soft delete — mesmo padrão de anamnesis.deleted_at (migration 0005). Exclusão via soft_delete_lab_exam (migration 0017-style security definer), nunca UPDATE direto.';

create index if not exists lab_exams_user_id_idx on public.lab_exams (user_id) where deleted_at is null;
create index if not exists lab_exams_patient_id_idx on public.lab_exams (patient_id) where deleted_at is null;

drop trigger if exists set_updated_at on public.lab_exams;
create trigger set_updated_at before update on public.lab_exams
  for each row execute procedure public.set_updated_at();

alter table public.lab_exams enable row level security;

create policy "lab_exams_select_own" on public.lab_exams
  for select using (auth.uid() = user_id and deleted_at is null);
create policy "lab_exams_insert_own" on public.lab_exams
  for insert with check (auth.uid() = user_id);
create policy "lab_exams_update_own" on public.lab_exams
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "lab_exams_delete_own" on public.lab_exams
  for delete using (auth.uid() = user_id);

-- Soft delete via função security definer — UPDATE direto setando deleted_at
-- falha com "new row violates row-level security policy" pelo mesmo motivo
-- sistêmico já corrigido na migration 0017 (a policy de SELECT exige
-- deleted_at is null, e o Postgres rejeita a própria linha virando invisível
-- por ela mesma durante o UPDATE). Ver comentário completo na 0017.
create or replace function public.soft_delete_lab_exam(exam_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.lab_exams
  set deleted_at = now()
  where id = exam_id
    and user_id = auth.uid()
    and deleted_at is null;

  return found;
end;
$$;

revoke all on function public.soft_delete_lab_exam(uuid) from public;
grant execute on function public.soft_delete_lab_exam(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 2. LAB_REFERENCE_RANGES — catálogo de faixas de referência.
--    user_id NULL = catálogo global do sistema (só escrito por esta
--    migration/seed, nunca pela aplicação — mesmo padrão de foods.is_global,
--    sem precisar da coluna extra porque aqui a nulidade de user_id já basta).
--    user_id preenchido = faixa customizada daquele profissional, que
--    prevalece sobre a global quando ambas existem para o mesmo marcador
--    (resolvido em código, não aqui — ver getReferenceRangeSuggestion).
-- ----------------------------------------------------------------------------
create table if not exists public.lab_reference_ranges (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users (id) on delete cascade,
  nome_marcador text not null,
  unidade text not null,
  sexo text not null check (sexo in ('M', 'F', 'ambos')),
  idade_min_anos smallint,
  idade_max_anos smallint,
  -- Nullable dos dois lados para permitir faixa "aberta" (ex.: colesterol
  -- total "até 200" tem valor_min null; HDL "mínimo 40" tem valor_max null).
  valor_min numeric(10, 3),
  valor_max numeric(10, 3),
  fonte text,
  created_at timestamptz not null default now(),
  check (valor_min is not null or valor_max is not null),
  check (idade_min_anos is null or idade_max_anos is null or idade_min_anos <= idade_max_anos)
);

comment on table public.lab_reference_ranges is 'Catálogo de faixas de referência de marcadores laboratoriais. user_id NULL = global (seed do sistema); preenchido = customização do profissional, que prevalece sobre a global na sugestão (ver lib/actions/lab-markers.ts).';

create index if not exists lab_reference_ranges_lookup_idx on public.lab_reference_ranges (nome_marcador, sexo);
create index if not exists lab_reference_ranges_user_id_idx on public.lab_reference_ranges (user_id);

alter table public.lab_reference_ranges enable row level security;

create policy "lab_reference_ranges_select_global_or_own" on public.lab_reference_ranges
  for select using (user_id is null or auth.uid() = user_id);
create policy "lab_reference_ranges_insert_own" on public.lab_reference_ranges
  for insert with check (auth.uid() = user_id);
create policy "lab_reference_ranges_update_own" on public.lab_reference_ranges
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "lab_reference_ranges_delete_own" on public.lab_reference_ranges
  for delete using (auth.uid() = user_id);

-- Ninguém além do service role (que ignora RLS) grava uma linha global
-- (user_id is null) — sem policy de insert/update/delete permitindo isso
-- para a role authenticated, a ausência já nega por padrão.

-- ----------------------------------------------------------------------------
-- 3. LAB_MARKERS — resultados estruturados de um exame.
--    referencia_min/referencia_max são SNAPSHOT (copiados no momento do
--    registro), nunca uma FK para lab_reference_ranges — mesmo princípio de
--    meal_items/recipe_ingredients. Sem deleted_at própria (não pedido —
--    mesmo padrão de recipe_ingredients: remover um marcador é uma exclusão
--    real da linha; a visibilidade do conjunto já depende do exame pai estar
--    visível).
-- ----------------------------------------------------------------------------
create table if not exists public.lab_markers (
  id uuid primary key default uuid_generate_v4(),
  exam_id uuid not null references public.lab_exams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  nome_marcador text not null,
  valor numeric(12, 4) not null,
  unidade text not null,
  referencia_min numeric(10, 3),
  referencia_max numeric(10, 3),
  -- true quando o profissional ajustou manualmente a faixa sugerida antes de
  -- salvar (laboratórios usam métodos diferentes) — não afeta o cálculo de
  -- fora_da_faixa, só documenta que não foi o valor sugerido "cru".
  referencia_editada boolean not null default false,
  fora_da_faixa boolean generated always as (
    (referencia_min is not null and valor < referencia_min)
    or (referencia_max is not null and valor > referencia_max)
  ) stored,
  created_at timestamptz not null default now()
);

comment on column public.lab_markers.referencia_min is 'Snapshot da faixa no momento do registro — nunca uma FK para lab_reference_ranges. Editar o catálogo depois não reinterpreta exames já lançados.';
comment on column public.lab_markers.fora_da_faixa is 'Sinalização neutra (valor fora do intervalo [referencia_min, referencia_max]) — não é um rótulo interpretativo/diagnóstico.';

create index if not exists lab_markers_exam_id_idx on public.lab_markers (exam_id);
create index if not exists lab_markers_user_id_idx on public.lab_markers (user_id);
create index if not exists lab_markers_evolucao_idx on public.lab_markers (user_id, nome_marcador);

alter table public.lab_markers enable row level security;

create policy "lab_markers_select_own" on public.lab_markers
  for select using (auth.uid() = user_id);
create policy "lab_markers_insert_own" on public.lab_markers
  for insert with check (auth.uid() = user_id);
create policy "lab_markers_update_own" on public.lab_markers
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "lab_markers_delete_own" on public.lab_markers
  for delete using (auth.uid() = user_id);
