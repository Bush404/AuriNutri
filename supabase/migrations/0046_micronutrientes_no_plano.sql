-- ============================================================================
-- 0046 — Fase 17, Bloco F (Roadmap 2): micronutrientes nos itens do plano.
--
-- Só acrescenta colunas que aceitam vazio + preenche as antigas da TACO.
-- Seguro de aplicar com o site no ar.
--
-- Até aqui meal_items e meal_item_substitutions guardavam a cópia (snapshot)
-- só dos macronutrientes. Para comparar o cardápio com as DRI, passam a
-- guardar também os micronutrientes — mesmas colunas e precisão de
-- recipe_ingredients (0013), nulas quando a origem não tem o dado, e o mapa
-- valores_especiais (traço / não analisado / não informado).
--
-- Itens já existentes: os que vieram da TACO recebem os micronutrientes do
-- alimento da TACO. Exceção consciente à regra "nunca reler o alimento ao
-- vivo": a TACO é tabela de referência que o app não edita (só entra pelo
-- script de importação, com os mesmos números), então copiar agora dá o
-- mesmo valor que teria sido copiado no dia. Itens de alimentos próprios e
-- de receitas ficam sem micronutrientes (podem ter sido editados depois) —
-- a tela avisa quantos itens ficaram sem o dado.
-- ============================================================================

do $$
declare
  tabela text;
begin
  foreach tabela in array array['meal_items', 'meal_item_substitutions'] loop
    execute format($f$
      alter table public.%I
        add column if not exists umidade_g numeric(7, 2),
        add column if not exists cinzas_g numeric(7, 2),
        add column if not exists colesterol_mg numeric(9, 2),
        add column if not exists calcio_mg numeric(9, 2),
        add column if not exists magnesio_mg numeric(9, 2),
        add column if not exists manganes_mg numeric(9, 3),
        add column if not exists fosforo_mg numeric(9, 2),
        add column if not exists ferro_mg numeric(9, 3),
        add column if not exists sodio_mg numeric(9, 2),
        add column if not exists potassio_mg numeric(9, 2),
        add column if not exists cobre_mg numeric(9, 3),
        add column if not exists zinco_mg numeric(9, 3),
        add column if not exists retinol_mcg numeric(9, 2),
        add column if not exists re_mcg numeric(9, 2),
        add column if not exists rae_mcg numeric(9, 2),
        add column if not exists tiamina_mg numeric(9, 3),
        add column if not exists riboflavina_mg numeric(9, 3),
        add column if not exists piridoxina_mg numeric(9, 3),
        add column if not exists niacina_mg numeric(9, 3),
        add column if not exists vitamina_c_mg numeric(9, 2),
        add column if not exists gordura_saturada_g numeric(7, 2),
        add column if not exists gordura_monoinsaturada_g numeric(7, 2),
        add column if not exists gordura_poliinsaturada_g numeric(7, 2),
        add column if not exists valores_especiais jsonb,
        add column if not exists micros_copiados boolean not null default false
    $f$, tabela);

    -- Itens antigos vindos da TACO: copia os micronutrientes do alimento da TACO.
    execute format($f$
      update public.%I t set
        umidade_g = f.umidade_g, cinzas_g = f.cinzas_g, colesterol_mg = f.colesterol_mg,
        calcio_mg = f.calcio_mg, magnesio_mg = f.magnesio_mg, manganes_mg = f.manganes_mg,
        fosforo_mg = f.fosforo_mg, ferro_mg = f.ferro_mg, sodio_mg = f.sodio_mg,
        potassio_mg = f.potassio_mg, cobre_mg = f.cobre_mg, zinco_mg = f.zinco_mg,
        retinol_mcg = f.retinol_mcg, re_mcg = f.re_mcg, rae_mcg = f.rae_mcg,
        tiamina_mg = f.tiamina_mg, riboflavina_mg = f.riboflavina_mg, piridoxina_mg = f.piridoxina_mg,
        niacina_mg = f.niacina_mg, vitamina_c_mg = f.vitamina_c_mg,
        gordura_saturada_g = f.gordura_saturada_g, gordura_monoinsaturada_g = f.gordura_monoinsaturada_g,
        gordura_poliinsaturada_g = f.gordura_poliinsaturada_g,
        valores_especiais = f.valores_especiais,
        micros_copiados = true
      from public.foods f
      where f.id = t.food_id and f.is_global and t.fonte_alimento = 'taco' and not t.micros_copiados
    $f$, tabela);
  end loop;
end $$;

comment on column public.meal_items.micros_copiados is 'true = os micronutrientes deste item foram copiados (snapshot); false = item antigo sem micronutrientes (a análise de DRI conta como "sem dado").';
comment on column public.meal_item_substitutions.micros_copiados is 'Mesmo significado de meal_items.micros_copiados.';
