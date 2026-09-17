-- ============================================================================
-- AuriNutri - Migration 0007
-- Fase 4, Bloco A — meta nutricional do plano alimentar (opcional), para
-- comparar contra o total calculado a partir dos itens já cadastrados.
-- ============================================================================

alter table public.meal_plans
  add column if not exists meta_kcal numeric(7, 2),
  add column if not exists meta_proteinas_g numeric(7, 2),
  add column if not exists meta_carboidratos_g numeric(7, 2),
  add column if not exists meta_gorduras_g numeric(7, 2);

comment on column public.meal_plans.meta_kcal is 'Meta calórica diária do plano (opcional). Comparada ao total calculado a partir dos itens na tela do plano.';
comment on column public.meal_plans.meta_proteinas_g is 'Meta de proteínas diária do plano (opcional, gramas).';
comment on column public.meal_plans.meta_carboidratos_g is 'Meta de carboidratos diária do plano (opcional, gramas).';
comment on column public.meal_plans.meta_gorduras_g is 'Meta de gorduras diária do plano (opcional, gramas).';
