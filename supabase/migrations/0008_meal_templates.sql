-- ============================================================================
-- AuriNutri - Migration 0008
-- Fase 4, Bloco B — templates de refeição (item 2) + observações por
-- refeição (item 4, agrupado aqui por ser uma coluna pequena da mesma
-- área de "refeições").
--
-- DECISÃO DE ARQUITETURA: meal_template_items NÃO guarda snapshot
-- nutricional (diferente de meal_items). Um template é uma lista reutilizável
-- de "alimento + quantidade" que vive na biblioteca pessoal do profissional
-- — o mesmo status de `foods`, não de um plano já entregue a um paciente.
-- Quando o template é aplicado numa refeição de verdade, É NESSE MOMENTO que
-- o snapshot é gerado (via buildFoodSnapshot, o mesmo helper usado ao
-- adicionar qualquer item), puxando os valores atuais do alimento — assim
-- correções futuras num alimento se refletem em usos futuros do template,
-- sem jamais alterar refeições que já usaram esse template no passado
-- (essas já têm seu próprio snapshot congelado em meal_items).
-- ============================================================================

alter table public.meals add column if not exists observacoes text;
comment on column public.meals.observacoes is 'Observações do profissional sobre esta refeição (ex: pode substituir por X, comer com Y).';

create table public.meal_templates (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nome text not null,
  created_at timestamptz not null default now()
);

comment on table public.meal_templates is 'Refeições salvas pelo profissional para reutilizar em outros planos (ex: "Café da manhã padrão").';

create index meal_templates_user_id_idx on public.meal_templates (user_id);

create table public.meal_template_items (
  id uuid primary key default uuid_generate_v4(),
  meal_template_id uuid not null references public.meal_templates (id) on delete cascade,
  food_id uuid references public.foods (id) on delete set null,
  user_id uuid not null references auth.users (id) on delete cascade,
  quantidade_g numeric(7, 2) not null check (quantidade_g > 0),
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

comment on column public.meal_template_items.food_id is 'Se o alimento original for excluído, o item fica com food_id nulo e é ignorado ao aplicar o template (não há snapshot aqui pra recuperar).';

create index meal_template_items_template_id_idx on public.meal_template_items (meal_template_id);
create index meal_template_items_user_id_idx on public.meal_template_items (user_id);
create index meal_template_items_food_id_idx on public.meal_template_items (food_id);

alter table public.meal_templates enable row level security;
alter table public.meal_template_items enable row level security;

create policy "meal_templates_select_own" on public.meal_templates
  for select using (auth.uid() = user_id);
create policy "meal_templates_insert_own" on public.meal_templates
  for insert with check (auth.uid() = user_id);
create policy "meal_templates_update_own" on public.meal_templates
  for update using (auth.uid() = user_id);
create policy "meal_templates_delete_own" on public.meal_templates
  for delete using (auth.uid() = user_id);

create policy "meal_template_items_select_own" on public.meal_template_items
  for select using (auth.uid() = user_id);
create policy "meal_template_items_insert_own" on public.meal_template_items
  for insert with check (auth.uid() = user_id);
create policy "meal_template_items_update_own" on public.meal_template_items
  for update using (auth.uid() = user_id);
create policy "meal_template_items_delete_own" on public.meal_template_items
  for delete using (auth.uid() = user_id);
