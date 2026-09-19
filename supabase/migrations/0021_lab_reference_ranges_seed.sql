-- ============================================================================
-- 0021_lab_reference_ranges_seed.sql
--
-- Fase 7, Bloco B — catálogo inicial de faixas de referência (20
-- marcadores de uso frequente em nutrição clínica), revisado com o
-- profissional (usuário) antes de aplicar. São valores comumente publicados
-- na literatura clínica — não uma fonte auditada/atualizada em tempo real —
-- por isso todo o modelo (lab_reference_ranges) permite ao profissional
-- criar sua própria faixa customizada, que prevalece sobre esta quando
-- existir (ver getReferenceRangeSuggestion em lib/actions/lab-markers.ts).
-- Editar estas linhas globais NUNCA reinterpreta um lab_markers já
-- registrado (snapshot, não FK).
--
-- Todas as faixas aqui são "adulto" (idade_min_anos = 18, sem limite
-- superior) — pediatria está fora de escopo deste bloco.
-- ============================================================================

insert into public.lab_reference_ranges
  (user_id, nome_marcador, unidade, sexo, idade_min_anos, idade_max_anos, valor_min, valor_max, fonte)
values
  (null, 'Glicemia de jejum', 'mg/dL', 'ambos', 18, null, 70, 99, 'SBD 2023'),
  (null, 'Hemoglobina glicada (HbA1c)', '%', 'ambos', 18, null, 4.0, 5.6, 'SBD 2023'),
  (null, 'Insulina de jejum', 'µUI/mL', 'ambos', 18, null, 2.6, 24.9, 'Referência laboratorial usual'),
  (null, 'Colesterol total', 'mg/dL', 'ambos', 18, null, null, 190, 'SBC — Diretriz de Dislipidemias 2017'),
  (null, 'LDL colesterol', 'mg/dL', 'ambos', 18, null, null, 130, 'SBC 2017'),
  (null, 'HDL colesterol', 'mg/dL', 'M', 18, null, 40, null, 'SBC 2017'),
  (null, 'HDL colesterol', 'mg/dL', 'F', 18, null, 50, null, 'SBC 2017'),
  (null, 'Triglicerídeos (jejum)', 'mg/dL', 'ambos', 18, null, null, 150, 'SBC 2017'),
  (null, 'TSH', 'mUI/L', 'ambos', 18, null, 0.4, 4.0, 'SBEM'),
  (null, 'T4 livre', 'ng/dL', 'ambos', 18, null, 0.7, 1.8, 'SBEM'),
  (null, 'Vitamina D (25-OH)', 'ng/mL', 'ambos', 18, null, 30, 100, 'SBEM / Endocrine Society'),
  (null, 'Vitamina B12', 'pg/mL', 'ambos', 18, null, 200, 900, 'Referência laboratorial usual'),
  (null, 'Ácido fólico', 'ng/mL', 'ambos', 18, null, 3.1, 17.5, 'Referência laboratorial usual'),
  (null, 'Ferritina', 'ng/mL', 'M', 18, null, 30, 400, 'Referência laboratorial usual'),
  (null, 'Ferritina', 'ng/mL', 'F', 18, null, 13, 150, 'Referência laboratorial usual'),
  (null, 'Ferro sérico', 'µg/dL', 'M', 18, null, 65, 175, 'Referência laboratorial usual'),
  (null, 'Ferro sérico', 'µg/dL', 'F', 18, null, 50, 170, 'Referência laboratorial usual'),
  (null, 'Hemoglobina', 'g/dL', 'M', 18, null, 13.5, 17.5, 'OMS / referência usual'),
  (null, 'Hemoglobina', 'g/dL', 'F', 18, null, 12.0, 15.5, 'OMS / referência usual'),
  (null, 'Hematócrito', '%', 'M', 18, null, 41, 53, 'Referência laboratorial usual'),
  (null, 'Hematócrito', '%', 'F', 18, null, 36, 46, 'Referência laboratorial usual'),
  (null, 'Leucócitos', '/mm³', 'ambos', 18, null, 4000, 11000, 'Referência laboratorial usual'),
  (null, 'Plaquetas', '/mm³', 'ambos', 18, null, 150000, 450000, 'Referência laboratorial usual'),
  (null, 'Proteína C reativa (PCR US)', 'mg/L', 'ambos', 18, null, null, 3.0, 'AHA/CDC'),
  (null, 'Ácido úrico', 'mg/dL', 'M', 18, null, 3.4, 7.0, 'Referência laboratorial usual'),
  (null, 'Ácido úrico', 'mg/dL', 'F', 18, null, 2.4, 6.0, 'Referência laboratorial usual');
