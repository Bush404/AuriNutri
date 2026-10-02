-- ============================================================================
-- 0047 — Fase 17, Bloco G (Roadmap 2): lista de planos e modelos.
--
-- Só acrescenta colunas com padrão. Seguro de aplicar com o site no ar.
--
-- meal_plans.favorito — o plano vira MODELO: aparece em "Novo plano → De um
--   modelo" para qualquer paciente do mesmo profissional (como no WebDiet).
--   A RLS de meal_plans (auth.uid() = user_id) já garante que cada profissional
--   só vê os próprios modelos.
-- meal_plans.ordem — "Ordenar planos" na aba do paciente. Nulo = ainda não
--   ordenado à mão: fica no topo, do mais novo para o mais antigo.
-- ============================================================================

alter table public.meal_plans
  add column if not exists favorito boolean not null default false,
  add column if not exists ordem integer;

create index if not exists meal_plans_user_favorito_idx on public.meal_plans (user_id) where favorito;

comment on column public.meal_plans.favorito is 'Plano favorito = modelo para começar planos de outros pacientes (Fase 17, Bloco G).';
comment on column public.meal_plans.ordem is 'Ordem manual na lista do paciente; nulo = sem ordem manual (vem primeiro, mais novo antes).';
