/**
 * Substitutos de um alimento do plano (Fase 17, Bloco E): quantidade
 * equivalente por calorias, carboidrato ou proteína, arredondada para a
 * medida caseira quando houver, e a ordem das "sugestões rápidas". Funções
 * puras — os valores vêm do snapshot do item e dos alimentos (por porção).
 */
import type { MacroTotals } from "@/lib/nutrition";

export type CriterioEquivalencia = "kcal" | "carboidratos" | "proteinas";

export const CRITERIOS: { valor: CriterioEquivalencia; rotulo: string }[] = [
  { valor: "kcal", rotulo: "Calorias" },
  { valor: "carboidratos", rotulo: "Carboidrato" },
  { valor: "proteinas", rotulo: "Proteína" },
];

/** Valores de um alimento na porção de referência (como em `foods` e nos snapshots). */
export interface ValoresPorPorcao {
  porcao_referencia_g: number;
  calorias_kcal: number | null;
  proteinas_g: number | null;
  carboidratos_g: number | null;
  gorduras_g: number | null;
  fibras_g?: number | null;
}

export function valorDoCriterio(macros: MacroTotals, criterio: CriterioEquivalencia): number {
  if (criterio === "kcal") return macros.calorias;
  return criterio === "carboidratos" ? macros.carboidratos : macros.proteinas;
}

/** Macros de `gramas` de um alimento. */
export function macrosEm(alimento: ValoresPorPorcao, gramas: number): MacroTotals {
  const fator = gramas / (Number(alimento.porcao_referencia_g) || 100);
  return {
    calorias: Number(alimento.calorias_kcal ?? 0) * fator,
    proteinas: Number(alimento.proteinas_g ?? 0) * fator,
    carboidratos: Number(alimento.carboidratos_g ?? 0) * fator,
    gorduras: Number(alimento.gorduras_g ?? 0) * fator,
    fibras: Number(alimento.fibras_g ?? 0) * fator,
  };
}

/**
 * Gramas do substituto que dão o mesmo valor do critério que o item original.
 * Nulo quando o substituto não tem esse nutriente (ex.: equivaler carboidrato
 * com um alimento sem carboidrato) — não dá para equivaler.
 */
export function gramasEquivalentes(
  original: MacroTotals,
  substituto: ValoresPorPorcao,
  criterio: CriterioEquivalencia,
): number | null {
  const alvo = valorDoCriterio(original, criterio);
  const porGrama = valorDoCriterio(macrosEm(substituto, 1), criterio);
  if (!(alvo > 0) || !(porGrama > 0)) return null;
  return alvo / porGrama;
}

/**
 * Leva os gramas exatos para algo que o paciente consegue medir: em medidas
 * caseiras, de meia em meia (no mínimo meia); sem medida, em gramas inteiros.
 */
export function arredondarQuantidade(
  gramas: number,
  medida: { gramas: number } | null,
): { medidaQuantidade: number | null; gramas: number } {
  if (medida && medida.gramas > 0) {
    const medidaQuantidade = Math.max(0.5, Math.round((gramas / medida.gramas) * 2) / 2);
    return { medidaQuantidade, gramas: Math.round(medidaQuantidade * medida.gramas * 100) / 100 };
  }
  return { medidaQuantidade: null, gramas: Math.max(1, Math.round(gramas)) };
}

/**
 * Quão diferente o substituto fica do original nos outros macronutrientes
 * (soma das diferenças em gramas de proteína, carboidrato e gordura). Menor =
 * troca mais parecida; usado para ordenar as sugestões rápidas.
 */
export function distanciaMacros(original: MacroTotals, substituto: MacroTotals): number {
  return (
    Math.abs(original.proteinas - substituto.proteinas) +
    Math.abs(original.carboidratos - substituto.carboidratos) +
    Math.abs(original.gorduras - substituto.gorduras)
  );
}

/**
 * Ordem das sugestões rápidas: menor = melhor. Soma a diferença nos macros
 * (relativa ao tamanho do original) com uma penalidade por peso muito
 * diferente (trocar 100 g de arroz por 34 g de flocos não é uma troca natural)
 * e dá uma pequena vantagem ao mesmo alimento-base ("Pão, …" por "Pão, …").
 */
export function pontuacaoSugestao(
  original: { nome: string; gramas: number; macros: MacroTotals },
  candidato: { nome: string; gramas: number; macros: MacroTotals },
): number {
  const tamanho = Math.max(1, original.macros.proteinas + original.macros.carboidratos + original.macros.gorduras);
  const macros = distanciaMacros(original.macros, candidato.macros) / tamanho;
  const peso = 0.25 * Math.abs(Math.log2(candidato.gramas / original.gramas));
  const base = (n: string) => normalizar(n).split(/[ ,]/)[0];
  return macros + peso - (base(original.nome) === base(candidato.nome) ? 0.1 : 0);
}

// Ingredientes que não se comem sozinhos (farinha, amido, pó, mistura para…): não viram sugestão,
// a não ser que o próprio original seja um deles.
const INGREDIENTE = /\b(farinha|amido|fuba|fecula|polvilho|po|mistura|fermento|extrato|tablete|gelatina|creme de)\b/;
export const ehIngrediente = (nome: string) => INGREDIENTE.test(normalizar(nome).replace(/,/g, " "));

const PREPARADO = /\b(cozid|frit|assad|grelhad|refogad|ensopad|torrad|empanad)/;
const CRU = /\bcru(a|s|as)?\b/;
const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const estado = (nome: string) =>
  CRU.test(normalizar(nome)) ? "cru" : PREPARADO.test(normalizar(nome)) ? "preparado" : "pronto";

/**
 * Sugestão só faz sentido no mesmo estado: fruta crua troca por fruta crua;
 * arroz cozido não troca por feijão cru. "Pronto" (pão, queijo) e "preparado"
 * (cozido, assado…) podem trocar entre si; cru só com cru.
 */
export function mesmoEstado(nomeOriginal: string, nomeSubstituto: string): boolean {
  const a = estado(nomeOriginal);
  const b = estado(nomeSubstituto);
  return a === "cru" ? b === "cru" : b !== "cru";
}
