import type { Food, Meal, MealItem, FonteAlimento } from "@/lib/types/database.types";

export interface MacroTotals {
  calorias: number;
  proteinas: number;
  carboidratos: number;
  gorduras: number;
  fibras: number;
}

export const ZERO_MACROS: MacroTotals = {
  calorias: 0,
  proteinas: 0,
  carboidratos: 0,
  gorduras: 0,
  fibras: 0,
};

/** Textos de atribuição de fonte, usados na UI e em relatórios/PDFs futuros. */
export const FONTE_LABELS: Record<FonteAlimento, string> = {
  taco: "TACO",
  personalizado: "Personalizado",
};

export const FONTE_DESCRICAO_PADRAO: Record<FonteAlimento, string> = {
  taco: "Tabela Brasileira de Composição de Alimentos (TACO) — NEPA/UNICAMP, 4ª edição ampliada e revisada.",
  personalizado: "Cadastro próprio do nutricionista.",
};

export const TACO_ATRIBUICAO_LONGA =
  "Tabela Brasileira de Composição de Alimentos (TACO), elaborada pelo NEPA — Núcleo de Estudos e Pesquisas em Alimentação, Universidade Estadual de Campinas (UNICAMP), 4ª edição ampliada e revisada.";

/**
 * Gera a nota de rodapé apropriada para um plano/relatório, considerando as
 * fontes realmente utilizadas nos itens (TACO, personalizado, ou ambos).
 * Nunca atribui um alimento personalizado à TACO.
 */
export function buildFonteFooter(fontesUsadas: FonteAlimento[]): string | null {
  const unicas = Array.from(new Set(fontesUsadas));
  if (unicas.length === 0) return null;

  const usaTaco = unicas.includes("taco");
  const usaPersonalizado = unicas.includes("personalizado");

  if (usaTaco && usaPersonalizado) {
    return "Os valores nutricionais apresentados neste documento utilizam como referência dados da Tabela Brasileira de Composição de Alimentos (TACO — NEPA/UNICAMP) e/ou alimentos cadastrados pelo profissional responsável.";
  }
  if (usaTaco) {
    return `Dados nutricionais baseados na ${TACO_ATRIBUICAO_LONGA}`;
  }
  return null; // Só alimentos personalizados: nenhuma atribuição externa necessária.
}

/**
 * Calcula os macronutrientes de uma quantidade (em gramas) de um alimento,
 * a partir dos valores nutricionais cadastrados para a porção de referência.
 * Valores ausentes (traço / não analisado / não informado) contam como 0
 * apenas para fins de SOMA — o valor original ausente nunca é sobrescrito
 * na tabela `foods`, apenas tratado como 0 neste cálculo agregado.
 */
export function calculateFoodMacros(food: Food, quantidadeGramas: number): MacroTotals {
  const porcao = Number(food.porcao_referencia_g) || 100;
  const fator = quantidadeGramas / porcao;

  return {
    calorias: Number(food.calorias_kcal ?? 0) * fator,
    proteinas: Number(food.proteinas_g ?? 0) * fator,
    carboidratos: Number(food.carboidratos_g ?? 0) * fator,
    gorduras: Number(food.gorduras_g ?? 0) * fator,
    fibras: Number(food.fibras_g ?? 0) * fator,
  };
}

/**
 * Calcula os macronutrientes de um item de refeição a partir do SEU PRÓPRIO
 * snapshot (nunca a partir do alimento "ao vivo"). Isso é o que garante que
 * um plano alimentar não mude se o alimento original for editado ou excluído
 * depois de já ter sido usado em um plano.
 */
export function calculateMealItemMacros(item: MealItem): MacroTotals {
  const porcao = Number(item.porcao_referencia_g) || 100;
  const fator = Number(item.quantidade_g) / porcao;

  return {
    calorias: Number(item.calorias_kcal) * fator,
    proteinas: Number(item.proteinas_g) * fator,
    carboidratos: Number(item.carboidratos_g) * fator,
    gorduras: Number(item.gorduras_g) * fator,
    fibras: Number(item.fibras_g) * fator,
  };
}

export function sumMacros(items: MacroTotals[]): MacroTotals {
  return items.reduce(
    (acc, item) => ({
      calorias: acc.calorias + item.calorias,
      proteinas: acc.proteinas + item.proteinas,
      carboidratos: acc.carboidratos + item.carboidratos,
      gorduras: acc.gorduras + item.gorduras,
      fibras: acc.fibras + item.fibras,
    }),
    { ...ZERO_MACROS }
  );
}

/** Calcula o total de macros de uma refeição, a partir do snapshot de seus itens. */
export function calculateMealTotals(items: MealItem[]): MacroTotals {
  return sumMacros(items.map(calculateMealItemMacros));
}

/** Calcula o total diário do plano, somando todas as refeições. */
export function calculatePlanTotals(meals: { items: MealItem[] }[]): MacroTotals {
  return sumMacros(meals.map((meal) => calculateMealTotals(meal.items)));
}

/** Reúne as fontes distintas realmente usadas em um plano, para atribuição em relatórios. */
export function collectFontesUsadas(meals: { items: MealItem[] }[]): FonteAlimento[] {
  return meals.flatMap((meal) => meal.items.map((item) => item.fonte_alimento));
}

export function formatMacro(value: number, unit = "g") {
  return `${value.toFixed(1)}${unit}`;
}

/** Formata um valor nutricional respeitando "traço" / "não analisado" / "não informado". */
export function formatNutrientValue(food: Food, campo: keyof Food, unit: string): string {
  const valor = food[campo];
  const especial = food.valores_especiais?.[campo as string];

  if (especial === "traco") return "traço";
  if (especial === "nao_analisado") return "não analisado";
  if (especial === "nao_informado" || valor === null || valor === undefined) return "—";

  return `${Number(valor).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${unit}`;
}

export type MealWithItems = Meal & { items: MealItem[] };
