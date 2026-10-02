/**
 * Adequação dos micronutrientes do cardápio às DRI (Fase 17, Bloco F).
 * Valores em ./dri-tabela.ts (gerado da fonte oficial, ver docs/FASE_17_DRI.md).
 */
import { calculateMealItemMacros, somarMicrosDosItens, type MicronutrientTotals } from "@/lib/nutrition";
import { idadeNaData } from "@/lib/anthropometry";
import type { MealItem, Sexo } from "@/lib/types/database.types";
import { MICRONUTRIENTE_LABELS, type MicronutrienteKey } from "@/lib/validations/food";
import { DRI, FASES_DA_VIDA, type FaseDaVida, type NutrienteDri, type TipoReferencia } from "@/lib/dri-tabela";

export type Condicao = "nenhuma" | "gestante" | "lactante";

/** Faixa da tabela para a pessoa; nula para menores de 1 ano ou sem sexo de referência. */
export function faseDaVida(
  sexo: Sexo | null,
  idadeAnos: number | null,
  condicao: Condicao = "nenhuma",
): FaseDaVida | null {
  if (idadeAnos === null || idadeAnos < 1) return null;
  if (idadeAnos < 4) return "c1";
  if (idadeAnos < 9) return "c4";
  if (sexo === "feminino" && condicao !== "nenhuma") {
    const p = condicao === "gestante" ? "g" : "l";
    return `${p}${idadeAnos < 19 ? 14 : idadeAnos < 31 ? 19 : 31}` as FaseDaVida;
  }
  if (sexo !== "feminino" && sexo !== "masculino") return null;
  const p = sexo === "feminino" ? "f" : "m";
  const faixa =
    idadeAnos < 14 ? 9 : idadeAnos < 19 ? 14 : idadeAnos < 31 ? 19 : idadeAnos < 51 ? 31 : idadeAnos < 71 ? 51 : 70;
  return `${p}${faixa}` as FaseDaVida;
}

export const ROTULO_FASE: Record<FaseDaVida, string> = {
  c1: "Criança, 1–3 anos",
  c4: "Criança, 4–8 anos",
  m9: "Homem, 9–13 anos",
  m14: "Homem, 14–18 anos",
  m19: "Homem, 19–30 anos",
  m31: "Homem, 31–50 anos",
  m51: "Homem, 51–70 anos",
  m70: "Homem, mais de 70 anos",
  f9: "Mulher, 9–13 anos",
  f14: "Mulher, 14–18 anos",
  f19: "Mulher, 19–30 anos",
  f31: "Mulher, 31–50 anos",
  f51: "Mulher, 51–70 anos",
  f70: "Mulher, mais de 70 anos",
  g14: "Gestante, 14–18 anos",
  g19: "Gestante, 19–30 anos",
  g31: "Gestante, 31–50 anos",
  l14: "Lactante, 14–18 anos",
  l19: "Lactante, 19–30 anos",
  l31: "Lactante, 31–50 anos",
};

/**
 * Sódio: além da AI, a DRI de 2019 traz a CDRR — "reduzir se acima de" —,
 * usada aqui como limite (o sódio não tem UL).
 */
export function cdrrSodio(fase: FaseDaVida): number {
  if (fase === "c1") return 1200;
  if (fase === "c4") return 1500;
  if (fase === "m9" || fase === "f9") return 1800;
  return 2300;
}

/** Ordem da tabela na tela e no PDF. */
const ORDEM: NutrienteDri[] = [
  "fibras_g",
  "calcio_mg",
  "ferro_mg",
  "magnesio_mg",
  "fosforo_mg",
  "zinco_mg",
  "cobre_mg",
  "manganes_mg",
  "potassio_mg",
  "sodio_mg",
  "rae_mcg",
  "retinol_mcg",
  "vitamina_c_mg",
  "tiamina_mg",
  "riboflavina_mg",
  "niacina_mg",
  "piridoxina_mg",
];

/** Sem DRI, só mostrados com o total. */
export const SEM_REFERENCIA: MicronutrienteKey[] = [
  "colesterol_mg",
  "gordura_saturada_g",
  "gordura_monoinsaturada_g",
  "gordura_poliinsaturada_g",
];

export type Situacao = "abaixo" | "adequado" | "acima" | "so_limite" | "sem_dado";

export interface LinhaAdequacao {
  chave: NutrienteDri;
  rotulo: string;
  unidade: string;
  /** Total do cardápio; null quando nenhum item tem o dado. */
  consumo: number | null;
  /** Itens do cardápio sem o dado (o total é parcial). */
  itensSemDado: number;
  recomendacao: number | null;
  tipo: TipoReferencia | null;
  /** UL; no sódio, a CDRR. */
  limite: number | null;
  /** % da recomendação. */
  percentual: number | null;
  situacao: Situacao;
  acimaDoLimite: boolean;
}

/** Faixa de ±20% em torno da recomendação, como no WebDiet (lista R7 da Fase 17). */
export const TOLERANCIA = 0.2;

export function situacaoPorPercentual(percentual: number): "abaixo" | "adequado" | "acima" {
  if (percentual < (1 - TOLERANCIA) * 100) return "abaixo";
  if (percentual > (1 + TOLERANCIA) * 100) return "acima";
  return "adequado";
}

/**
 * Compara o total diário do cardápio com a recomendação da faixa de vida.
 * `fibras` vem dos macros (sempre presente); o resto, de somarMicrosDosItens.
 */
export function avaliarAdequacao(
  micros: MicronutrientTotals,
  fibrasG: number,
  totalDeItens: number,
  fase: FaseDaVida,
): LinhaAdequacao[] {
  const i = FASES_DA_VIDA.indexOf(fase);
  return ORDEM.map((chave) => {
    const [recomendacao, tipo, ul] = DRI[chave][i];
    const limite = chave === "sodio_mg" ? cdrrSodio(fase) : ul;
    const agregado = chave === "fibras_g" ? null : micros[chave as MicronutrienteKey];
    const itensSemDado = agregado?.ingredientesSemDado ?? 0;
    const consumo =
      chave === "fibras_g" ? fibrasG : totalDeItens > 0 && itensSemDado >= totalDeItens ? null : (agregado?.valor ?? 0);
    const percentual = consumo !== null && recomendacao ? (consumo / recomendacao) * 100 : null;
    const situacao: Situacao =
      consumo === null ? "sem_dado" : percentual === null ? "so_limite" : situacaoPorPercentual(percentual);
    const label = chave === "fibras_g" ? { label: "Fibras", unit: "g" } : MICRONUTRIENTE_LABELS[chave];
    return {
      chave,
      rotulo:
        chave === "rae_mcg"
          ? "Vitamina A (RAE)"
          : chave === "retinol_mcg"
            ? "Retinol (vitamina A pré-formada)"
            : label.label,
      unidade: label.unit,
      consumo,
      itensSemDado,
      recomendacao,
      tipo,
      limite,
      percentual,
      situacao,
      acimaDoLimite: consumo !== null && limite !== null && consumo > limite,
    };
  });
}

export interface NutrientesDoCardapio {
  /** "Mulher, 19–30 anos"; null quando não dá para escolher a faixa (sem sexo/idade). */
  faixa: string | null;
  linhas: LinhaAdequacao[];
  semReferencia: { rotulo: string; unidade: string; valor: number | null }[];
  /** Itens do cardápio sem micronutrientes (adicionados antes de 02/10/2026, de alimentos próprios ou receitas). */
  itensSemMicros: number;
}

/** Micronutrientes do cardápio × DRI — mesma conta da tela "Ver todos os nutrientes". */
export function nutrientesDoCardapio(
  itens: MealItem[],
  paciente: { sexo: Sexo | null; data_nascimento: string | null } | undefined,
  condicao: Condicao,
  hoje: string,
): NutrientesDoCardapio {
  const micros = somarMicrosDosItens(itens);
  const fibras = itens.reduce((s, i) => s + calculateMealItemMacros(i).fibras, 0);
  const fase = faseDaVida(paciente?.sexo ?? null, idadeNaData(paciente?.data_nascimento, hoje), condicao);
  return {
    faixa: fase ? ROTULO_FASE[fase] : null,
    linhas: fase ? avaliarAdequacao(micros, fibras, itens.length, fase) : [],
    semReferencia: SEM_REFERENCIA.map((k) => ({
      rotulo: MICRONUTRIENTE_LABELS[k].label,
      unidade: MICRONUTRIENTE_LABELS[k].unit,
      valor: itens.length > 0 && micros[k].ingredientesSemDado >= itens.length ? null : micros[k].valor,
    })),
    itensSemMicros: itens.filter((i) => !i.micros_copiados).length,
  };
}
