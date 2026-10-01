/**
 * Evolução física (Fase 15, Bloco D): séries de indicadores ao longo das
 * avaliações do paciente — adultos, crianças, avaliações antigas (antes da
 * Fase 15) e os números digitados de relatórios anexados. Uma série só tem
 * os pontos até a data escolhida ("evolução até esta avaliação").
 *
 * Os valores calculados (massa magra, massa muscular, RCQ...) usam as mesmas
 * funções da tela da avaliação — os números batem com o que foi visto lá.
 */

import { calcularResultados, sexoDasFormulas } from "@/lib/anthropometry-results";
import { idadeNaData } from "@/lib/anthropometry";
import type { AnthropometricAssessment, AnthropometricAttachment, Sexo } from "@/lib/types/database.types";

export type IndicadorEvolucao =
  | "peso"
  | "imc"
  | "altura"
  | "percentual_gordura"
  | "massa_livre_gordura"
  | "massa_muscular"
  | "cintura"
  | "quadril"
  | "abdomen"
  | "rcq"
  | "rcest"
  | "braco"
  | "coxa"
  | "panturrilha"
  | "soma_dobras";

export const INDICADORES_EVOLUCAO: { id: IndicadorEvolucao; label: string; unidade: string; casas: number }[] = [
  { id: "peso", label: "Peso", unidade: "kg", casas: 1 },
  { id: "imc", label: "IMC", unidade: "kg/m²", casas: 1 },
  { id: "altura", label: "Altura", unidade: "cm", casas: 1 },
  { id: "percentual_gordura", label: "% de gordura", unidade: "%", casas: 1 },
  { id: "massa_livre_gordura", label: "Massa livre de gordura", unidade: "kg", casas: 1 },
  { id: "massa_muscular", label: "Massa muscular", unidade: "kg", casas: 1 },
  { id: "cintura", label: "Cintura", unidade: "cm", casas: 1 },
  { id: "quadril", label: "Quadril", unidade: "cm", casas: 1 },
  { id: "abdomen", label: "Abdômen", unidade: "cm", casas: 1 },
  { id: "rcq", label: "Relação cintura/quadril", unidade: "", casas: 2 },
  { id: "rcest", label: "Relação cintura/estatura", unidade: "", casas: 2 },
  { id: "braco", label: "Braço relaxado", unidade: "cm", casas: 1 },
  { id: "coxa", label: "Coxa medial", unidade: "cm", casas: 1 },
  { id: "panturrilha", label: "Panturrilha", unidade: "cm", casas: 1 },
  { id: "soma_dobras", label: "Soma das dobras", unidade: "mm", casas: 1 },
];

export const INDICADOR_EVOLUCAO_INFO = Object.fromEntries(INDICADORES_EVOLUCAO.map((i) => [i.id, i])) as Record<
  IndicadorEvolucao,
  (typeof INDICADORES_EVOLUCAO)[number]
>;

export const MAX_INDICADORES = 5;
export const INDICADORES_PADRAO: IndicadorEvolucao[] = ["peso", "imc", "percentual_gordura", "cintura", "massa_livre_gordura"];

export interface PontoEvolucao {
  data: string;
  valor: number;
  /** De onde veio: avaliação ou relatório anexado. */
  origem: "avaliacao" | "anexo";
}

type Valores = Partial<Record<IndicadorEvolucao, number | null>>;

const lado = (a: AnthropometricAssessment, dir: number | null, esq: number | null) =>
  a.lado_referencia === "esquerdo" ? esq ?? dir : dir ?? esq;

const DOBRAS_COLUNAS = [
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

function valoresDaAvaliacao(a: AnthropometricAssessment, sexoPaciente: Sexo | null, dataNascimento: string | null): Valores {
  const r = calcularResultados(a, {
    sexo: sexoDasFormulas(sexoPaciente, a.sexo_referencia),
    idade: idadeNaData(dataNascimento, a.data_avaliacao),
  });
  // % de gordura: o que foi gravado (protocolo, Slaughter ou digitado à mão
  // numa avaliação antiga); sem isso, o da bioimpedância.
  const pg = a.percentual_gordura ?? a.bio_percentual_gordura ?? null;
  const dobras = DOBRAS_COLUNAS.map((c) => a[c]).filter((v): v is number => v !== null && v !== undefined);
  return {
    peso: a.peso_kg,
    imc: a.imc,
    altura: a.altura_cm,
    percentual_gordura: pg,
    massa_livre_gordura: r.massaLivreGorduraKg ?? a.bio_massa_livre_gordura_kg ?? (pg !== null ? a.peso_kg * (1 - pg / 100) : null),
    massa_muscular: r.massaMuscularKg ?? a.bio_massa_muscular_kg ?? null,
    cintura: a.circunferencia_cintura_cm,
    quadril: a.circunferencia_quadril_cm,
    abdomen: a.circunferencia_abdomen_cm,
    rcq: r.rcq,
    rcest: r.rcest,
    // Avaliações antigas só têm "braço"/"coxa" sem lado.
    braco: lado(a, a.circunferencia_braco_relaxado_dir_cm, a.circunferencia_braco_relaxado_esq_cm) ?? a.circunferencia_braco_cm,
    coxa: lado(a, a.circunferencia_coxa_medial_dir_cm, a.circunferencia_coxa_medial_esq_cm) ?? a.circunferencia_coxa_cm,
    panturrilha: lado(a, a.circunferencia_panturrilha_dir_cm, a.circunferencia_panturrilha_esq_cm),
    soma_dobras: dobras.length ? dobras.reduce((s, v) => s + v, 0) : null,
  };
}

function valoresDoAnexo(x: AnthropometricAttachment): Valores {
  return {
    peso: x.peso_kg,
    percentual_gordura: x.percentual_gordura,
    massa_livre_gordura: x.massa_livre_gordura_kg,
    massa_muscular: x.massa_muscular_kg,
  };
}

export interface EntradaEvolucao {
  assessments: AnthropometricAssessment[];
  attachments: AnthropometricAttachment[];
  sexo: Sexo | null;
  dataNascimento: string | null;
}

/** Séries por indicador, em ordem de data, só com pontos até `ate` (inclusive). */
export function montarSeries({ assessments, attachments, sexo, dataNascimento }: EntradaEvolucao, ate: string | null) {
  const linhas: { data: string; origem: PontoEvolucao["origem"]; v: Valores }[] = [
    ...assessments.map((a) => ({ data: a.data_avaliacao, origem: "avaliacao" as const, v: valoresDaAvaliacao(a, sexo, dataNascimento) })),
    ...attachments.map((x) => ({ data: x.data_avaliacao, origem: "anexo" as const, v: valoresDoAnexo(x) })),
  ]
    .filter((l) => !ate || l.data <= ate)
    .sort((a, b) => a.data.localeCompare(b.data));

  const series = {} as Record<IndicadorEvolucao, PontoEvolucao[]>;
  for (const { id } of INDICADORES_EVOLUCAO) {
    series[id] = linhas.flatMap((l) => {
      const valor = l.v[id];
      return typeof valor === "number" && Number.isFinite(valor) ? [{ data: l.data, valor, origem: l.origem }] : [];
    });
  }
  return series;
}

/** Datas disponíveis para "evolução até", mais recente primeiro. */
export function datasDisponiveis(entrada: EntradaEvolucao): string[] {
  const todas = new Set([...entrada.assessments.map((a) => a.data_avaliacao), ...entrada.attachments.map((x) => x.data_avaliacao)]);
  return [...todas].sort((a, b) => b.localeCompare(a));
}

/** Lê `?ind=peso,imc` — só ids válidos, sem repetir, no máximo 5; vazio = padrão. */
export function parseIndicadores(valor: string | null | undefined): IndicadorEvolucao[] {
  const validos = (valor ?? "")
    .split(",")
    .filter((v, i, arr): v is IndicadorEvolucao => v in INDICADOR_EVOLUCAO_INFO && arr.indexOf(v) === i)
    .slice(0, MAX_INDICADORES);
  return validos.length ? validos : INDICADORES_PADRAO;
}
