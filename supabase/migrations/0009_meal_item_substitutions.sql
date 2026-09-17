-- ============================================================================
-- AuriNutri - Migration 0009
-- Fase 4, Bloco B, item 3 — alimentos substitutos/equivalentes por item de
-- refeição, com aporte calórico semelhante, para o paciente variar.
--
-- DECISÃO DE ARQUITETURA: ao contrário de meal_template_items, esta tabela
-- GUARDA snapshot nutricional completo (mesmos campos de meal_items). Uma
-- substituição está sempre pendurada num meal_item de um plano real, já
-- potencialmente entregue ao paciente — precisa da mesma garantia de nunca
-- mudar se o alimento de origem for editado ou excluído depois.
-- ============================================================================

create table public.meal_item_substitutions (
  id uuid primary key default uuid_generate_v4(),
  meal_item_id uuid not null references public.meal_items (id) on delete cascade,
  food_id uuid references public.foods (id) on delete set null,
  user_id uuid not null references auth.users (id) on delete cascade,
  quantidade_g numeric(7, 2) not null check (quantidade_g > 0),
  ordem integer not null default 0,
  -- Snapshot nutricional — mesma filosofia e mesmos campos de meal_items.
  nome_alimento text not null,
  fonte_alimento text not null check (fonte_alimento in ('taco', 'personalizado')),
  fonte_descricao_alimento text,
  porcao_referencia_g numeric(7, 2) not null,
  calorias_kcal numeric(9, 2) not null,
  proteinas_g numeric(9, 2) not null,
  carboidratos_g numeric(9, 2) not null,
  gorduras_g numeric(9, 2) not null,
  fibras_g numeric(9, 2) not null,
  created_at timestamptz not null default now()
);

comment on table public.meal_item_substitutions is 'Alimentos equivalentes sugeridos para um item de refeição real, com aporte calórico semelhante ao item original. Snapshot próprio — nunca recalculado a partir do alimento ao vivo.';

create index meal_item_substitutions_meal_item_id_idx on public.meal_item_substitutions (meal_item_id);
create index meal_item_substitutions_user_id_idx on public.meal_item_substitutions (user_id);
create index meal_item_substitutions_food_id_idx on public.meal_item_substitutions (food_id);

alter table public.meal_item_substitutions enable row level security;

create policy "meal_item_substitutions_select_own" on public.meal_item_substitutions
  for select using (auth.uid() = user_id);
create policy "meal_item_substitutions_insert_own" on public.meal_item_substitutions
  for insert with check (auth.uid() = user_id);
create policy "meal_item_substitutions_update_own" on public.meal_item_substitutions
  for update using (auth.uid() = user_id);
create policy "meal_item_substitutions_delete_own" on public.meal_item_substitutions
  for delete using (auth.uid() = user_id);
