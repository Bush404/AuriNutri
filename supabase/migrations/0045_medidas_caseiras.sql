-- ============================================================================
-- 0045 — Fase 17, Bloco D (Roadmap 2): medidas caseiras.
--
-- Só acrescenta (tabela nova + colunas que aceitam vazio). Seguro de aplicar
-- com o site no ar; planos antigos continuam só em gramas, sem mudança.
--
-- food_measures — medidas caseiras de um alimento ("unidade média" = 50 g).
--   * user_id NULL  = medida do IBGE (POF 2008–2009, tabela de medidas
--     referidas), ligada aos alimentos da TACO. Só entra pelo script
--     scripts/import-medidas/import.mjs (chave de serviço), como a TACO.
--   * user_id preenchido = medida que o profissional criou (vale para
--     alimento da TACO ou dele mesmo). Só ele vê.
--   Excluir uma medida apaga a linha: os itens de plano guardam a própria
--   cópia (snapshot) do nome e dos gramas, então nada muda nos planos.
--
-- meal_items / meal_item_substitutions — a medida escolhida, como cópia:
--   medida_nome, medida_gramas (gramas de 1 medida) e medida_quantidade
--   (quantas medidas). quantidade_g continua sendo o que o cálculo usa e passa
--   a ser medida_quantidade × medida_gramas. Tudo vazio = item em gramas.
-- ============================================================================

create table if not exists public.food_measures (
  id uuid primary key default uuid_generate_v4(),
  food_id uuid not null references public.foods (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 80),
  gramas numeric(7, 2) not null check (gramas > 0),
  fonte text not null check (fonte in ('ibge', 'personalizado')),
  created_at timestamptz not null default now(),
  -- Medida do IBGE nunca tem dono; a do profissional sempre tem.
  constraint food_measures_fonte_dono check ((fonte = 'ibge') = (user_id is null))
);

comment on table public.food_measures is 'Medidas caseiras de um alimento: do IBGE (POF 2008–2009, user_id nulo) ou criadas pelo profissional (Fase 17, Bloco D).';

create index if not exists food_measures_food_id_idx on public.food_measures (food_id);
create index if not exists food_measures_user_id_idx on public.food_measures (user_id);

alter table public.food_measures enable row level security;

-- Vê as do IBGE e as próprias.
create policy "food_measures_select" on public.food_measures
  for select using (user_id is null or auth.uid() = user_id);
-- Só cria medida própria, e só para alimento que enxerga (TACO ou o próprio).
create policy "food_measures_insert_own" on public.food_measures
  for insert with check (
    auth.uid() = user_id
    and fonte = 'personalizado'
    and exists (
      select 1 from public.foods f
      where f.id = food_id and (f.is_global or f.user_id = auth.uid())
    )
  );
create policy "food_measures_delete_own" on public.food_measures
  for delete using (auth.uid() = user_id);

alter table public.meal_items
  add column if not exists medida_nome text,
  add column if not exists medida_gramas numeric(7, 2),
  add column if not exists medida_quantidade numeric(7, 2);

alter table public.meal_items drop constraint if exists meal_items_medida_completa;
alter table public.meal_items add constraint meal_items_medida_completa check (
  (medida_nome is null and medida_gramas is null and medida_quantidade is null)
  or (medida_nome is not null and medida_gramas > 0 and medida_quantidade > 0)
);

alter table public.meal_item_substitutions
  add column if not exists medida_nome text,
  add column if not exists medida_gramas numeric(7, 2),
  add column if not exists medida_quantidade numeric(7, 2);

alter table public.meal_item_substitutions drop constraint if exists meal_item_substitutions_medida_completa;
alter table public.meal_item_substitutions add constraint meal_item_substitutions_medida_completa check (
  (medida_nome is null and medida_gramas is null and medida_quantidade is null)
  or (medida_nome is not null and medida_gramas > 0 and medida_quantidade > 0)
);

comment on column public.meal_items.medida_nome is 'Cópia do nome da medida caseira escolhida (ex: "unidade média"); nulo = item em gramas.';
comment on column public.meal_items.medida_gramas is 'Cópia dos gramas de 1 medida no momento da escolha.';
comment on column public.meal_items.medida_quantidade is 'Quantas medidas (ex: 1,5). quantidade_g = medida_quantidade × medida_gramas.';
