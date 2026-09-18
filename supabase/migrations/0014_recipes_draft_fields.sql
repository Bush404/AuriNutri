-- ============================================================================
-- 0014_recipes_draft_fields.sql
--
-- Fase 6, Bloco B — a criação de receita é um wizard de 4 etapas que salva
-- rascunho a cada etapa (ver prompt do usuário). rendimento_g e
-- numero_porcoes só são coletados na Etapa 4, mas o rascunho precisa
-- existir a partir da Etapa 1 (só com `nome`) para os ingredientes da
-- Etapa 2 poderem referenciar `recipe_id`. Por isso essas duas colunas
-- deixam de ser NOT NULL — os CHECK (> 0) já existentes continuam válidos,
-- porque uma CHECK constraint não é violada por NULL.
-- ============================================================================

alter table public.recipes
  alter column rendimento_g drop not null,
  alter column numero_porcoes drop not null;

comment on column public.recipes.rendimento_g is 'Peso da preparação PRONTA, informado pelo profissional na Etapa 4 — NULL enquanto a receita é um rascunho. Nunca calculado pela soma dos ingredientes crus.';
comment on column public.recipes.numero_porcoes is 'Informado na Etapa 4 — NULL enquanto a receita é um rascunho.';
