-- ============================================================================
-- 0048 — Fase 18 (Roadmap 2): alimentos da USDA FoodData Central (SR Legacy).
--
-- Só amplia regras e acrescenta uma coluna. Seguro de aplicar com o site no ar:
-- nenhum dado existente muda.
--
--   * foods.fonte passa a aceitar 'usda' (alimento global, como a TACO: sem dono,
--     só entra pelo script scripts/import-usda/import.mjs com a chave de serviço).
--   * foods.codigo_usda (FDC ID) deixa a importação idempotente.
--   * O snapshot nutricional de item de plano, substituição e ingrediente de
--     receita passa a aceitar fonte_alimento = 'usda'.
--   * food_measures aceita medidas caseiras da USDA (sem dono, como as do IBGE).
--
-- As regras antigas eram CHECKs escritos junto da coluna (nome automático). Para
-- não depender do nome que o Postgres deu, elas são localizadas pelo conteúdo.
-- ============================================================================

-- Remove os CHECKs de uma tabela cuja definição menciona a coluna e a lista de fontes.
create or replace function pg_temp.remover_check_de_fonte(tabela regclass, coluna text)
returns void
language plpgsql
as $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = tabela
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%' || coluna || '%'
      and pg_get_constraintdef(oid) ilike '%personalizado%'
  loop
    execute format('alter table %s drop constraint %I', tabela, c.conname);
  end loop;
end;
$$;

-- ---------------------------------------------------------------- foods
alter table public.foods add column if not exists codigo_usda integer unique;
comment on column public.foods.codigo_usda is 'FDC ID do alimento na USDA FoodData Central (SR Legacy), usado para importação idempotente.';

select pg_temp.remover_check_de_fonte('public.foods', 'fonte');
alter table public.foods drop constraint if exists foods_global_ou_pessoal_check;
alter table public.foods
  add constraint foods_fonte_valida check (fonte in ('taco', 'usda', 'personalizado'));
alter table public.foods
  add constraint foods_global_ou_pessoal_check check (
    (is_global = true and user_id is null and fonte in ('taco', 'usda'))
    or
    (is_global = false and user_id is not null and fonte = 'personalizado')
  );

comment on column public.foods.fonte is 'Origem do alimento: taco ou usda (bases globais) ou personalizado (cadastro do nutricionista).';

-- ---------------------------------------------------------------- snapshots
select pg_temp.remover_check_de_fonte('public.meal_items', 'fonte_alimento');
alter table public.meal_items
  add constraint meal_items_fonte_alimento_valida check (fonte_alimento in ('taco', 'usda', 'personalizado', 'receita'));

select pg_temp.remover_check_de_fonte('public.meal_item_substitutions', 'fonte_alimento');
alter table public.meal_item_substitutions
  add constraint meal_item_substitutions_fonte_alimento_valida check (fonte_alimento in ('taco', 'usda', 'personalizado'));

select pg_temp.remover_check_de_fonte('public.recipe_ingredients', 'fonte_alimento');
alter table public.recipe_ingredients
  add constraint recipe_ingredients_fonte_alimento_valida check (fonte_alimento in ('taco', 'usda', 'personalizado'));

-- ---------------------------------------------------------------- medidas caseiras
select pg_temp.remover_check_de_fonte('public.food_measures', 'fonte');
alter table public.food_measures drop constraint if exists food_measures_fonte_dono;
alter table public.food_measures
  add constraint food_measures_fonte_valida check (fonte in ('ibge', 'usda', 'personalizado'));
-- Medida de base oficial (IBGE ou USDA) nunca tem dono; a do profissional sempre tem.
alter table public.food_measures
  add constraint food_measures_fonte_dono check ((fonte in ('ibge', 'usda')) = (user_id is null));

comment on table public.food_measures is 'Medidas caseiras de um alimento: do IBGE (POF 2008–2009) ou da USDA (user_id nulo), ou criadas pelo profissional.';
