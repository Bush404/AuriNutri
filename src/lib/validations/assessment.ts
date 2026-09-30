import { z } from "zod";

import { PROTOCOLOS } from "@/lib/anthropometry";
import { optionalPositiveNumber, optionalText } from "@/lib/validations/patient";

/** Colunas numéricas opcionais da avaliação (mm, cm, kg, %) — nomes iguais aos do banco. */
export const CAMPOS_DOBRAS = [
  "dobra_triceps_mm",
  "dobra_biceps_mm",
  "dobra_abdominal_mm",
  "dobra_subescapular_mm",
  "dobra_axilar_media_mm",
  "dobra_coxa_mm",
  "dobra_peitoral_mm",
  "dobra_suprailiaca_mm",
  "dobra_panturrilha_mm",
  "dobra_supraespinhal_mm",
] as const;

export const CAMPOS_CIRCUNFERENCIAS_TRONCO = [
  "circunferencia_pescoco_cm",
  "circunferencia_torax_cm",
  "circunferencia_ombro_cm",
  "circunferencia_cintura_cm",
  "circunferencia_quadril_cm",
  "circunferencia_abdomen_cm",
] as const;

/** Membros, em pares [direito, esquerdo]. */
export const CAMPOS_CIRCUNFERENCIAS_MEMBROS = [
  ["circunferencia_braco_relaxado_dir_cm", "circunferencia_braco_relaxado_esq_cm"],
  ["circunferencia_braco_contraido_dir_cm", "circunferencia_braco_contraido_esq_cm"],
  ["circunferencia_antebraco_dir_cm", "circunferencia_antebraco_esq_cm"],
  ["circunferencia_coxa_proximal_dir_cm", "circunferencia_coxa_proximal_esq_cm"],
  ["circunferencia_coxa_medial_dir_cm", "circunferencia_coxa_medial_esq_cm"],
  ["circunferencia_coxa_distal_dir_cm", "circunferencia_coxa_distal_esq_cm"],
  ["circunferencia_panturrilha_dir_cm", "circunferencia_panturrilha_esq_cm"],
] as const;

/** Só existem em avaliações antigas (antes da Fase 15): aparecem no formulário apenas se preenchidas. */
export const CAMPOS_ANTIGOS = ["circunferencia_braco_cm", "circunferencia_coxa_cm", "percentual_gordura"] as const;

export const CAMPOS_DIAMETROS = ["diametro_umero_cm", "diametro_punho_cm", "diametro_femur_cm"] as const;

export const CAMPOS_BIOIMPEDANCIA = [
  "bio_percentual_gordura",
  "bio_massa_gorda_kg",
  "bio_percentual_massa_muscular",
  "bio_massa_muscular_kg",
  "bio_massa_livre_gordura_kg",
  "bio_peso_osseo_kg",
  "bio_gordura_visceral",
  "bio_agua_corporal_percentual",
] as const;

export const CAMPOS_NUMERICOS = [
  "altura_sentado_cm",
  "altura_joelho_cm",
  ...CAMPOS_DOBRAS,
  ...CAMPOS_CIRCUNFERENCIAS_TRONCO,
  ...CAMPOS_CIRCUNFERENCIAS_MEMBROS.flat(),
  ...CAMPOS_ANTIGOS,
  ...CAMPOS_DIAMETROS,
  ...CAMPOS_BIOIMPEDANCIA,
] as const;

export type CampoNumerico = (typeof CAMPOS_NUMERICOS)[number];

const medidas = Object.fromEntries(CAMPOS_NUMERICOS.map((c) => [c, optionalPositiveNumber()])) as Record<
  CampoNumerico,
  ReturnType<typeof optionalPositiveNumber>
>;

/** "" (select sem escolha) vira undefined. */
const optionalEnum = <T extends [string, ...string[]]>(values: T) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), z.enum(values).optional());

export const assessmentSchema = z.object({
  data_avaliacao: z.string().min(1, "Informe a data da avaliação"),
  peso_kg: z.coerce.number({ invalid_type_error: "Informe o peso" }).positive("Peso deve ser maior que zero"),
  altura_cm: z.coerce
    .number({ invalid_type_error: "Informe a altura" })
    .positive("Altura deve ser maior que zero"),
  peso_estimado: z.boolean().default(false),
  altura_estimada: z.boolean().default(false),
  ...medidas,
  bio_idade_metabolica: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : v),
    z.coerce.number().int("Idade em anos inteiros").positive("Deve ser maior que zero").optional()
  ),
  lado_referencia: z.enum(["direito", "esquerdo"]).default("direito"),
  protocolo_dobras: optionalEnum(PROTOCOLOS as [string, ...string[]]),
  formula_densidade: z.enum(["brozek", "siri"]).default("brozek"),
  sexo_referencia: optionalEnum(["masculino", "feminino"]),
  observacoes: optionalText(),
});

export type AssessmentInput = z.input<typeof assessmentSchema>;
export type AssessmentData = z.output<typeof assessmentSchema>;
