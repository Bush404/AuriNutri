/**
 * Planejamento teórico do plano alimentar (Fase 17, Bloco A — lista aprovada
 * em docs/FASE_17_PLANO.md, seção 7).
 *
 * Duas formas de distribuir os macronutrientes, como no WebDiet:
 *  - fórmula de bolso: gramas por kg de peso → o GET é a soma das kcal dos macros;
 *  - percentual do GET: o GET é informado (ou importado do cálculo energético
 *    da Fase 16) e cada macro recebe uma fração dele.
 *
 * kcal por grama pelos fatores de Atwater: proteína 4, lipídio 9, carboidrato 4.
 * O "teórico" é gravado nas metas do plano (meta_kcal, meta_*_g, migration 0007),
 * então os planos antigos com metas digitadas continuam funcionando igual.
 */

import type { MacroTotals } from "@/lib/nutrition";

export const KCAL_POR_G = { proteinas: 4, lipidios: 9, carboidratos: 4 } as const;

/** g de nitrogênio = g de proteína ÷ 6,25. */
const PROTEINA_POR_G_NITROGENIO = 6.25;

export type ModoDistribuicao = "g_kg" | "percentual";

export interface EntradaPlanejamento {
  modo: ModoDistribuicao;
  pesoKg: number | null;
  /** Só no modo percentual; no g/kg é calculado. */
  getKcal: number | null;
  /** g/kg no modo g_kg; % do GET no modo percentual. */
  proteinas: number | null;
  lipidios: number | null;
  carboidratos: number | null;
}

export interface MetasPlanejamento {
  kcal: number;
  proteinas_g: number;
  lipidios_g: number;
  carboidratos_g: number;
}

export type ResultadoPlanejamento = { ok: true; metas: MetasPlanejamento } | { ok: false; motivo: string };

const positivo = (v: number | null): v is number => v !== null && Number.isFinite(v) && v > 0;
const naoNegativo = (v: number | null): v is number => v !== null && Number.isFinite(v) && v >= 0;

export function distribuirMacros(e: EntradaPlanejamento): ResultadoPlanejamento {
  if (!naoNegativo(e.proteinas) || !naoNegativo(e.lipidios) || !naoNegativo(e.carboidratos)) {
    return { ok: false, motivo: "Preencha proteínas, lipídios e carboidratos." };
  }

  if (e.modo === "g_kg") {
    if (!positivo(e.pesoKg)) return { ok: false, motivo: "Informe o peso do paciente." };
    const proteinas_g = e.proteinas * e.pesoKg;
    const lipidios_g = e.lipidios * e.pesoKg;
    const carboidratos_g = e.carboidratos * e.pesoKg;
    const kcal =
      proteinas_g * KCAL_POR_G.proteinas + lipidios_g * KCAL_POR_G.lipidios + carboidratos_g * KCAL_POR_G.carboidratos;
    return { ok: true, metas: { kcal, proteinas_g, lipidios_g, carboidratos_g } };
  }

  if (!positivo(e.getKcal)) return { ok: false, motivo: "Informe o gasto energético total (GET)." };
  const soma = e.proteinas + e.lipidios + e.carboidratos;
  // Tolerância para casas decimais digitadas (ex.: 33,3 + 33,3 + 33,4).
  if (Math.abs(soma - 100) > 0.05) {
    return { ok: false, motivo: `Os percentuais somam ${soma.toLocaleString("pt-BR")}%; precisam somar 100%.` };
  }
  return {
    ok: true,
    metas: {
      kcal: e.getKcal,
      proteinas_g: (e.getKcal * e.proteinas) / 100 / KCAL_POR_G.proteinas,
      lipidios_g: (e.getKcal * e.lipidios) / 100 / KCAL_POR_G.lipidios,
      carboidratos_g: (e.getKcal * e.carboidratos) / 100 / KCAL_POR_G.carboidratos,
    },
  };
}

/** Os mesmos gramas vistos das duas formas (para a tela mostrar g/kg e % juntos). */
export function equivalencias(metas: MetasPlanejamento, pesoKg: number | null) {
  const pct = (g: number, fator: number) => (metas.kcal > 0 ? (g * fator * 100) / metas.kcal : null);
  const gkg = (g: number) => (positivo(pesoKg) ? g / pesoKg : null);
  return {
    proteinas: { pct: pct(metas.proteinas_g, KCAL_POR_G.proteinas), gkg: gkg(metas.proteinas_g) },
    lipidios: { pct: pct(metas.lipidios_g, KCAL_POR_G.lipidios), gkg: gkg(metas.lipidios_g) },
    carboidratos: { pct: pct(metas.carboidratos_g, KCAL_POR_G.carboidratos), gkg: gkg(metas.carboidratos_g) },
    kcalPorKg: positivo(pesoKg) ? metas.kcal / pesoKg : null,
  };
}

/** kcal não proteicas por grama de nitrogênio. `null` sem proteína. */
export function kcalNaoProteicaPorGN(kcal: number, proteinasG: number): number | null {
  if (!(proteinasG > 0)) return null;
  return (kcal - proteinasG * KCAL_POR_G.proteinas) / (proteinasG / PROTEINA_POR_G_NITROGENIO);
}

export interface LinhaAnalise {
  parametro: string;
  unidade: "g" | "kcal" | "kcal/g";
  prescrito: number | null;
  teorico: number | null;
  /** prescrito − teórico; null quando falta um dos dois. */
  diferenca: number | null;
}

export interface MetasDoPlano {
  meta_kcal: number | null;
  meta_proteinas_g: number | null;
  meta_carboidratos_g: number | null;
  meta_gorduras_g: number | null;
}

/**
 * Tabela "Análise de nutrientes do cardápio": o prescrito (soma dos alimentos)
 * contra o teórico (metas do plano). Carboidratos livres = carboidratos − fibras
 * (na TACO o carboidrato total inclui a fibra). Densidade calórica = kcal ÷ peso
 * total dos alimentos.
 */
export function analisarCardapio(totais: MacroTotals, pesoTotalG: number, metas: MetasDoPlano): LinhaAnalise[] {
  const linha = (
    parametro: string,
    unidade: LinhaAnalise["unidade"],
    prescrito: number | null,
    teorico: number | null,
  ) => ({
    parametro,
    unidade,
    prescrito,
    teorico,
    diferenca: prescrito !== null && teorico !== null ? prescrito - teorico : null,
  });
  const teoricoNaoProteica =
    metas.meta_kcal !== null && metas.meta_proteinas_g !== null
      ? kcalNaoProteicaPorGN(metas.meta_kcal, metas.meta_proteinas_g)
      : null;

  return [
    linha("Proteínas totais", "g", totais.proteinas, metas.meta_proteinas_g),
    linha("Lipídios totais", "g", totais.gorduras, metas.meta_gorduras_g),
    linha("Carboidratos totais", "g", totais.carboidratos, metas.meta_carboidratos_g),
    linha("Fibras totais", "g", totais.fibras, null),
    linha("Carboidratos livres", "g", Math.max(0, totais.carboidratos - totais.fibras), null),
    linha("Calorias totais", "kcal", totais.calorias, metas.meta_kcal),
    linha(
      "Kcal não proteica / g N",
      "kcal",
      kcalNaoProteicaPorGN(totais.calorias, totais.proteinas),
      teoricoNaoProteica,
    ),
    linha("Densidade calórica", "kcal/g", pesoTotalG > 0 ? totais.calorias / pesoTotalG : null, null),
  ];
}

/** Fatia de cada macro nas kcal do cardápio (rosca da análise). */
export function distribuicaoCalorica(totais: MacroTotals) {
  const kcal = {
    proteinas: totais.proteinas * KCAL_POR_G.proteinas,
    lipidios: totais.gorduras * KCAL_POR_G.lipidios,
    carboidratos: totais.carboidratos * KCAL_POR_G.carboidratos,
  };
  const soma = kcal.proteinas + kcal.lipidios + kcal.carboidratos;
  const pct = (v: number) => (soma > 0 ? (v * 100) / soma : 0);
  return {
    proteinas: { kcal: kcal.proteinas, pct: pct(kcal.proteinas) },
    lipidios: { kcal: kcal.lipidios, pct: pct(kcal.lipidios) },
    carboidratos: { kcal: kcal.carboidratos, pct: pct(kcal.carboidratos) },
    total: totais.calorias,
  };
}

/**
 * Densidade calórica (kcal/g) de uma refeição, nas faixas de Ledikwe et al.
 * (2005), as mesmas do WebDiet: muito baixa < 0,6; baixa 0,6–1,5; média
 * 1,5–4,0; alta > 4,0 kcal/g.
 */
export function classificarDensidade(kcal: number, pesoG: number) {
  if (!(pesoG > 0)) return null;
  const valor = kcal / pesoG;
  const faixa =
    valor < 0.6
      ? { rotulo: "muito baixa", faixa: "até 0,6 kcal/g" }
      : valor < 1.5
        ? { rotulo: "baixa", faixa: "0,6 a 1,5 kcal/g" }
        : valor <= 4
          ? { rotulo: "média", faixa: "1,5 a 4,0 kcal/g" }
          : { rotulo: "alta", faixa: "acima de 4,0 kcal/g" };
  return { valor, ...faixa };
}

// ============================================================================
// Lista de planos do paciente (Fase 17, Bloco G)
// ============================================================================

/** Calorias de um dia do plano, pela cópia nutricional de cada item. */
export function kcalDoPlano(
  itens: { quantidade_g: number; porcao_referencia_g: number; calorias_kcal: number }[],
): number {
  return itens.reduce(
    (s, i) => s + Number(i.calorias_kcal) * (Number(i.quantidade_g) / (Number(i.porcao_referencia_g) || 100)),
    0,
  );
}

/** kcal/kg do plano; nulo sem peso. */
export function kcalPorKg(kcal: number, pesoKg: number | null): number | null {
  return pesoKg && pesoKg > 0 ? kcal / pesoKg : null;
}

/**
 * Ordem da lista: os que ainda não foram ordenados à mão (ordem nula) vêm
 * primeiro, do mais novo para o mais antigo; depois, a ordem escolhida.
 */
export function ordenarPlanos<T extends { ordem: number | null; created_at: string }>(planos: T[]): T[] {
  return planos.slice().sort((a, b) => {
    if (a.ordem === null && b.ordem === null) return b.created_at.localeCompare(a.created_at);
    if (a.ordem === null) return -1;
    if (b.ordem === null) return 1;
    return a.ordem - b.ordem;
  });
}
