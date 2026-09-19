-- ============================================================================
-- 0018_meal_items_recipe.sql
--
-- Fase 6, Bloco C — permite usar uma RECEITA como item de refeição, além de
-- um alimento avulso. Um meal_item passa a apontar para `food_id` OU
-- `recipe_id`, nunca os dois (CHECK abaixo).
--
-- SNAPSHOT: como já acontece com alimentos (ver comentário de meal_items em
-- 0002_taco_foods.sql), o item de receita grava uma cópia dos valores
-- nutricionais NO MOMENTO em que a receita é adicionada — nunca uma
-- referência "ao vivo". Editar a receita depois não muda planos já
-- montados. Os valores copiados são os EFETIVOS por porção (já considerando
-- `valores_sobrescritos`, se o profissional tiver corrigido algum manualmente
-- — ver recipe-nutrition-panel.tsx), não o bruto calculado a partir dos
-- ingredientes.
--
-- `porcao_referencia_g` (já existente) passa a guardar, para um item de
-- receita, os gramas de UMA porção (rendimento_g / numero_porcoes) — o que
-- faz `calculateMealItemMacros` (quantidade_g / porcao_referencia_g) e a
-- reescala continuar funcionando SEM NENHUMA mudança de fórmula, tratando a
-- receita como "só mais um tipo de item".
--
-- QUANTIDADE EM PORÇÕES: o profissional pensa "1 porção da receita", não em
-- gramas. `quantidade_porcoes` guarda o que foi digitado; `quantidade_g`
-- (coluna já existente, usada pelo cálculo) é derivado como
-- `quantidade_porcoes * porcao_referencia_g` no momento da gravação — a UI
-- mostra porções, o cálculo continua em gramas por baixo.
--
-- FONTE: uma receita pode combinar ingredientes TACO e personalizados.
-- `fonte_alimento` ganha o valor 'receita' (novo, ao lado de
-- 'taco'/'personalizado') para o item em si, e `fontes_ingredientes_receita`
-- guarda o snapshot do CONJUNTO de fontes usadas pelos ingredientes da
-- receita no momento em que ela foi adicionada — é isso que
-- `collectFontesUsadas`/`buildFonteFooter` (lib/nutrition.ts) passam a
-- consultar para não deixar de creditar a TACO quando ela aparece só dentro
-- de uma receita.
-- ============================================================================

alter table public.meal_items
  add column if not exists recipe_id uuid references public.recipes (id) on delete set null,
  add column if not exists quantidade_porcoes numeric(6, 2) check (quantidade_porcoes is null or quantidade_porcoes > 0),
  add column if not exists fontes_ingredientes_receita text[];

comment on column public.meal_items.recipe_id is 'Referência de rastreabilidade a uma receita (mutuamente exclusiva com food_id) — NULL se a receita original for excluída depois; o snapshot abaixo preserva o histórico.';
comment on column public.meal_items.quantidade_porcoes is 'Quantidade em porções da receita, como o profissional digita — NULL para itens de alimento avulso. quantidade_g é derivado a partir deste valor no momento da gravação.';
comment on column public.meal_items.fontes_ingredientes_receita is 'Snapshot do conjunto de fontes (taco/personalizado) dos ingredientes da receita no momento em que foi adicionada ao plano — usado para a atribuição de fonte no PDF/relatório.';

-- Amplia o CHECK de fonte_alimento (criado em 0002 como coluna inline) para
-- aceitar 'receita', sem depender de adivinhar o nome do constraint gerado
-- automaticamente.
do $$
declare
  check_name text;
begin
  select conname into check_name
  from pg_constraint
  where conrelid = 'public.meal_items'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%fonte_alimento%';

  if check_name is not null then
    execute format('alter table public.meal_items drop constraint %I', check_name);
  end if;
end $$;

alter table public.meal_items
  add constraint meal_items_fonte_alimento_check
  check (fonte_alimento in ('taco', 'personalizado', 'receita'));

-- Um item pertence a um alimento OU a uma receita, nunca aos dois nem a
-- nenhum.
alter table public.meal_items
  add constraint meal_items_food_or_recipe_check
  check (
    (food_id is not null and recipe_id is null)
    or (food_id is null and recipe_id is not null)
  );

create index if not exists meal_items_recipe_id_idx on public.meal_items (recipe_id) where deleted_at is null;
