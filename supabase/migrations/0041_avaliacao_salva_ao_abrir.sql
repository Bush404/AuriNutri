-- ============================================================================
-- 0041 — Fase 15, ajuste pós-uso: a avaliação é salva assim que é aberta.
--
-- "Nova avaliação" passa a criar o registro na hora (como no WebDiet), e o
-- formulário salva sozinho a cada alteração. Por isso a avaliação existe
-- antes de o peso ser digitado: peso e altura deixam de ser obrigatórios.
--
-- Só afrouxa: nenhuma linha existente muda. As checagens "> 0" continuam
-- valendo quando há valor. O IMC (coluna gerada) fica vazio sem peso/altura.
-- Telas e PDFs tratam avaliação sem peso (ex.: "última pesagem" a ignora).
-- Seguro de aplicar com o site no ar.
-- ============================================================================

alter table public.anthropometric_assessments
  alter column peso_kg drop not null,
  alter column altura_cm drop not null;

comment on column public.anthropometric_assessments.peso_kg is
  'Vazio enquanto a avaliação recém-aberta não tem o peso digitado (migration 0041).';
