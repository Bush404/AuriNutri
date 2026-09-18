-- ============================================================================
-- 0013_recipes.sql
--
-- Fase 6, Bloco A — backend de receitas.
--
-- FATOR DE COCÇÃO: o peso dos ingredientes crus somados não é igual ao peso
-- da preparação pronta (arroz absorve água e pesa mais depois de cozido,
-- carne perde peso ao grelhar). Por isso `rendimento_g` é um valor
-- INFORMADO pelo profissional, nunca calculado pela soma de
-- `recipe_ingredients.quantidade_g` — ver src/lib/nutrition.ts
-- (calculateRecipePer100g usa rendimento_g, nunca a soma dos ingredientes).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. RECIPES
-- ----------------------------------------------------------------------------
create table if not exists public.recipes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nome text not null,
  descricao text,
  modo_preparo text,
  imagem_url text,
  -- Peso da preparação PRONTA — informado, nunca derivado da soma dos
  -- ingredientes (ver nota de fator de cocção acima).
  rendimento_g numeric(8, 2) not null check (rendimento_g > 0),
  numero_porcoes integer not null check (numero_porcoes > 0),
  tempo_preparo_min integer check (tempo_preparo_min is null or tempo_preparo_min >= 0),
  tags text[] not null default '{}',
  -- {campo: valor} — quando o profissional prefere digitar um valor à mão
  -- em vez de aceitar o calculado a partir dos ingredientes.
  valores_sobrescritos jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on column public.recipes.rendimento_g is 'Peso da preparação PRONTA, informado pelo profissional — nunca calculado pela soma dos ingredientes crus (cocção altera peso por perda de água ou absorção).';
comment on column public.recipes.valores_sobrescritos is 'Mapa {campo: valor} para quando o profissional prefere digitar um valor manualmente em vez de aceitar o calculado a partir dos ingredientes.';
comment on column public.recipes.deleted_at is 'Soft delete — mesmo padrão de anamnesis.deleted_at (migration 0005).';

create index if not exists recipes_user_id_idx on public.recipes (user_id) where deleted_at is null;

drop trigger if exists set_updated_at on public.recipes;
create trigger set_updated_at before update on public.recipes
  for each row execute procedure public.set_updated_at();

alter table public.recipes enable row level security;

create policy "recipes_select_own" on public.recipes
  for select using (auth.uid() = user_id and deleted_at is null);
create policy "recipes_insert_own" on public.recipes
  for insert with check (auth.uid() = user_id);
create policy "recipes_update_own" on public.recipes
  for update using (auth.uid() = user_id);
create policy "recipes_delete_own" on public.recipes
  for delete using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 2. RECIPE_INGREDIENTS — snapshot nutricional completo por ingrediente,
--    mesmo princípio de meal_items (migration 0002): a receita não muda se
--    o alimento de origem for editado ou excluído depois de já ter sido
--    incluído aqui. Sem deleted_at própria (não pedido) — remover um
--    ingrediente é uma exclusão real da linha.
-- ----------------------------------------------------------------------------
create table if not exists public.recipe_ingredients (
  id uuid primary key default uuid_generate_v4(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  food_id uuid references public.foods (id) on delete set null,
  user_id uuid not null references auth.users (id) on delete cascade,
  quantidade_g numeric(8, 2) not null check (quantidade_g > 0),
  ordem integer not null default 0,
  -- Snapshot dos macros — mesmas colunas/precisão de meal_items, sempre
  -- NOT NULL (ausência já é tratada como 0 no momento da cópia, igual
  -- buildFoodSnapshot faz para meal_items).
  nome_alimento text not null,
  fonte_alimento text not null check (fonte_alimento in ('taco', 'personalizado')),
  fonte_descricao_alimento text,
  porcao_referencia_g numeric(7, 2) not null,
  calorias_kcal numeric(9, 2) not null,
  proteinas_g numeric(9, 2) not null,
  carboidratos_g numeric(9, 2) not null,
  gorduras_g numeric(9, 2) not null,
  fibras_g numeric(9, 2) not null,
  -- Snapshot dos micronutrientes — mesmas colunas/precisão de foods,
  -- NULLABLE de propósito: a origem pode não ter o dado, e essa ausência
  -- precisa ser preservada (nunca virar 0 na cópia). Ver valores_especiais.
  umidade_g numeric(7, 2),
  cinzas_g numeric(7, 2),
  colesterol_mg numeric(9, 2),
  calcio_mg numeric(9, 2),
  magnesio_mg numeric(9, 2),
  manganes_mg numeric(9, 3),
  fosforo_mg numeric(9, 2),
  ferro_mg numeric(9, 3),
  sodio_mg numeric(9, 2),
  potassio_mg numeric(9, 2),
  cobre_mg numeric(9, 3),
  zinco_mg numeric(9, 3),
  retinol_mcg numeric(9, 2),
  re_mcg numeric(9, 2),
  rae_mcg numeric(9, 2),
  tiamina_mg numeric(9, 3),
  riboflavina_mg numeric(9, 3),
  piridoxina_mg numeric(9, 3),
  niacina_mg numeric(9, 3),
  vitamina_c_mg numeric(9, 2),
  gordura_saturada_g numeric(7, 2),
  gordura_monoinsaturada_g numeric(7, 2),
  gordura_poliinsaturada_g numeric(7, 2),
  valores_especiais jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on column public.recipe_ingredients.food_id is 'Referência de rastreabilidade; fica NULL se o alimento original for excluído depois — o snapshot abaixo preserva o histórico nutricional completo.';
comment on column public.recipe_ingredients.valores_especiais is 'Snapshot do mapa {coluna: motivo} do alimento de origem no momento da inclusão — preserva traço/não analisado/não informado, mesmo padrão de foods.valores_especiais.';

create index if not exists recipe_ingredients_recipe_id_idx on public.recipe_ingredients (recipe_id);
create index if not exists recipe_ingredients_food_id_idx on public.recipe_ingredients (food_id);
create index if not exists recipe_ingredients_user_id_idx on public.recipe_ingredients (user_id);

alter table public.recipe_ingredients enable row level security;

create policy "recipe_ingredients_select_own" on public.recipe_ingredients
  for select using (auth.uid() = user_id);
create policy "recipe_ingredients_insert_own" on public.recipe_ingredients
  for insert with check (auth.uid() = user_id);
create policy "recipe_ingredients_update_own" on public.recipe_ingredients
  for update using (auth.uid() = user_id);
create policy "recipe_ingredients_delete_own" on public.recipe_ingredients
  for delete using (auth.uid() = user_id);
