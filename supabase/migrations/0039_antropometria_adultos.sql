-- ============================================================================
-- 0039 — Fase 15, Bloco A (Roadmap 2): antropometria de adultos e idosos.
--
-- Só acrescenta colunas (todas opcionais) em anthropometric_assessments.
-- Nenhuma linha existente é alterada: avaliações antigas continuam com os
-- mesmos valores, e as colunas antigas (circunferencia_braco_cm,
-- circunferencia_coxa_cm, percentual_gordura) seguem valendo. Seguro de
-- aplicar com o site antigo no ar. RLS e auditoria da tabela já cobrem as
-- colunas novas — nenhuma política nova.
--
-- Os resultados (IMC, % de gordura, RCQ, CMB, massas...) são calculados pela
-- aplicação a partir destas medidas (src/lib/anthropometry.ts). Só o % de
-- gordura e a densidade do protocolo escolhido são gravados, como foto do
-- momento, para a evolução, o PDF e a Central de Envio.
-- ============================================================================

alter table public.anthropometric_assessments
  -- Dados básicos
  add column if not exists altura_sentado_cm numeric(6, 2) check (altura_sentado_cm > 0),
  add column if not exists altura_joelho_cm numeric(6, 2) check (altura_joelho_cm > 0),
  add column if not exists peso_estimado boolean not null default false,
  add column if not exists altura_estimada boolean not null default false,

  -- Dobras cutâneas (mm)
  add column if not exists dobra_triceps_mm numeric(6, 2) check (dobra_triceps_mm > 0),
  add column if not exists dobra_biceps_mm numeric(6, 2) check (dobra_biceps_mm > 0),
  add column if not exists dobra_abdominal_mm numeric(6, 2) check (dobra_abdominal_mm > 0),
  add column if not exists dobra_subescapular_mm numeric(6, 2) check (dobra_subescapular_mm > 0),
  add column if not exists dobra_axilar_media_mm numeric(6, 2) check (dobra_axilar_media_mm > 0),
  add column if not exists dobra_coxa_mm numeric(6, 2) check (dobra_coxa_mm > 0),
  add column if not exists dobra_peitoral_mm numeric(6, 2) check (dobra_peitoral_mm > 0),
  add column if not exists dobra_suprailiaca_mm numeric(6, 2) check (dobra_suprailiaca_mm > 0),
  add column if not exists dobra_panturrilha_mm numeric(6, 2) check (dobra_panturrilha_mm > 0),
  add column if not exists dobra_supraespinhal_mm numeric(6, 2) check (dobra_supraespinhal_mm > 0),

  -- Circunferências (cm) — as de membros, dos dois lados (um lado basta)
  add column if not exists circunferencia_torax_cm numeric(6, 2) check (circunferencia_torax_cm > 0),
  add column if not exists circunferencia_ombro_cm numeric(6, 2) check (circunferencia_ombro_cm > 0),
  add column if not exists circunferencia_abdomen_cm numeric(6, 2) check (circunferencia_abdomen_cm > 0),
  add column if not exists circunferencia_braco_relaxado_dir_cm numeric(6, 2) check (circunferencia_braco_relaxado_dir_cm > 0),
  add column if not exists circunferencia_braco_relaxado_esq_cm numeric(6, 2) check (circunferencia_braco_relaxado_esq_cm > 0),
  add column if not exists circunferencia_braco_contraido_dir_cm numeric(6, 2) check (circunferencia_braco_contraido_dir_cm > 0),
  add column if not exists circunferencia_braco_contraido_esq_cm numeric(6, 2) check (circunferencia_braco_contraido_esq_cm > 0),
  add column if not exists circunferencia_antebraco_dir_cm numeric(6, 2) check (circunferencia_antebraco_dir_cm > 0),
  add column if not exists circunferencia_antebraco_esq_cm numeric(6, 2) check (circunferencia_antebraco_esq_cm > 0),
  add column if not exists circunferencia_coxa_proximal_dir_cm numeric(6, 2) check (circunferencia_coxa_proximal_dir_cm > 0),
  add column if not exists circunferencia_coxa_proximal_esq_cm numeric(6, 2) check (circunferencia_coxa_proximal_esq_cm > 0),
  add column if not exists circunferencia_coxa_medial_dir_cm numeric(6, 2) check (circunferencia_coxa_medial_dir_cm > 0),
  add column if not exists circunferencia_coxa_medial_esq_cm numeric(6, 2) check (circunferencia_coxa_medial_esq_cm > 0),
  add column if not exists circunferencia_coxa_distal_dir_cm numeric(6, 2) check (circunferencia_coxa_distal_dir_cm > 0),
  add column if not exists circunferencia_coxa_distal_esq_cm numeric(6, 2) check (circunferencia_coxa_distal_esq_cm > 0),
  add column if not exists circunferencia_panturrilha_dir_cm numeric(6, 2) check (circunferencia_panturrilha_dir_cm > 0),
  add column if not exists circunferencia_panturrilha_esq_cm numeric(6, 2) check (circunferencia_panturrilha_esq_cm > 0),
  -- Lado usado nos cálculos que pedem um braço/panturrilha só (CMB, peso estimado)
  add column if not exists lado_referencia text not null default 'direito' check (lado_referencia in ('direito', 'esquerdo')),

  -- Diâmetros ósseos (cm)
  add column if not exists diametro_umero_cm numeric(5, 2) check (diametro_umero_cm > 0),
  add column if not exists diametro_punho_cm numeric(5, 2) check (diametro_punho_cm > 0),
  add column if not exists diametro_femur_cm numeric(5, 2) check (diametro_femur_cm > 0),

  -- Bioimpedância (valores digitados do aparelho)
  add column if not exists bio_percentual_gordura numeric(5, 2) check (bio_percentual_gordura > 0),
  add column if not exists bio_massa_gorda_kg numeric(6, 2) check (bio_massa_gorda_kg > 0),
  add column if not exists bio_percentual_massa_muscular numeric(5, 2) check (bio_percentual_massa_muscular > 0),
  add column if not exists bio_massa_muscular_kg numeric(6, 2) check (bio_massa_muscular_kg > 0),
  add column if not exists bio_massa_livre_gordura_kg numeric(6, 2) check (bio_massa_livre_gordura_kg > 0),
  add column if not exists bio_peso_osseo_kg numeric(5, 2) check (bio_peso_osseo_kg > 0),
  add column if not exists bio_gordura_visceral numeric(5, 1) check (bio_gordura_visceral > 0),
  add column if not exists bio_agua_corporal_percentual numeric(5, 2) check (bio_agua_corporal_percentual > 0),
  add column if not exists bio_idade_metabolica integer check (bio_idade_metabolica > 0),

  -- Protocolo de dobras e base das fórmulas
  add column if not exists protocolo_dobras text check (
    protocolo_dobras in ('pollock_3', 'pollock_7', 'petroski', 'guedes', 'durnin', 'faulkner')
  ),
  add column if not exists formula_densidade text not null default 'brozek' check (formula_densidade in ('brozek', 'siri')),
  add column if not exists sexo_referencia text check (sexo_referencia in ('masculino', 'feminino')),
  add column if not exists densidade_corporal numeric(7, 5);

comment on column public.anthropometric_assessments.protocolo_dobras is 'Protocolo de % de gordura por dobras (Fase 15). Nulo = nenhum (ou avaliação antiga, cujo percentual_gordura foi digitado à mão).';
comment on column public.anthropometric_assessments.sexo_referencia is 'Base masculino/feminino usada nas fórmulas nesta avaliação. Para paciente "outro"/sem sexo é escolhida pelo profissional — nunca assumida.';
comment on column public.anthropometric_assessments.percentual_gordura is 'Com protocolo_dobras: % calculado pelo protocolo no momento de salvar. Sem protocolo (avaliação antiga): valor digitado à mão.';
comment on column public.anthropometric_assessments.peso_estimado is 'Peso veio da estimativa de Chumlea (paciente que não pode ser pesado).';
comment on column public.anthropometric_assessments.altura_estimada is 'Altura veio da estimativa pela altura do joelho (Chumlea).';

-- Data da última edição. A Central de Envio reaproveita o PDF já gerado de uma
-- avaliação; com isto, se a avaliação foi editada depois do PDF, gera de novo
-- (antes, mandava o PDF desatualizado). Linhas antigas recebem a data de hoje,
-- o que só faz o próximo envio gerar o PDF uma vez a mais.
alter table public.anthropometric_assessments
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists set_updated_at on public.anthropometric_assessments;
create trigger set_updated_at before update on public.anthropometric_assessments
  for each row execute procedure public.set_updated_at();
