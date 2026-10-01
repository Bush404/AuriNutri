-- ============================================================================
-- 0043 — Fase 17, Bloco A (Roadmap 2): planejamento teórico do plano.
--
-- Só acrescenta colunas opcionais em meal_plans. Seguro de aplicar com o site
-- no ar; planos existentes ficam com tudo nulo e continuam iguais.
--
-- O RESULTADO do planejamento continua nas metas da migration 0007
-- (meta_kcal, meta_proteinas_g, meta_gorduras_g, meta_carboidratos_g) — é o
-- "teórico" da tabela Prescrito × Teórico. Estas colunas guardam COMO ele foi
-- feito, para a janela reabrir igual: o modo de distribuição, o peso, os
-- valores digitados (g/kg ou % do GET) e o cálculo energético de origem
-- (Fase 16, só rastreio — os números ficam copiados aqui).
-- ============================================================================

alter table public.meal_plans
  add column if not exists planejamento_modo text check (planejamento_modo in ('g_kg', 'percentual')),
  add column if not exists planejamento_peso_kg numeric(6, 2) check (planejamento_peso_kg > 0),
  add column if not exists planejamento_proteinas numeric(6, 2) check (planejamento_proteinas >= 0),
  add column if not exists planejamento_lipidios numeric(6, 2) check (planejamento_lipidios >= 0),
  add column if not exists planejamento_carboidratos numeric(6, 2) check (planejamento_carboidratos >= 0),
  add column if not exists planejamento_calculo_id uuid references public.energy_calculations (id) on delete set null;

comment on column public.meal_plans.planejamento_modo is 'g_kg = fórmula de bolso (g por kg de peso); percentual = % do GET (Fase 17).';
comment on column public.meal_plans.planejamento_proteinas is 'Valor digitado: g/kg no modo g_kg, % do GET no modo percentual.';
comment on column public.meal_plans.planejamento_calculo_id is 'Cálculo energético (Fase 16) importado — só rastreio; o GET fica em meta_kcal.';
