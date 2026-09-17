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

/** Campos de snapshot nutricional compartilhados por meal_items e meal_item_substitutions. */
export type NutritionSnapshot = Pick<
  MealItem,
  "porcao_referencia_g" | "quantidade_g" | "calorias_kcal" | "proteinas_g" | "carboidratos_g" | "gorduras_g" | "fibras_g"
>;

/**
 * Calcula os macronutrientes de um item de refeição (ou de uma substituição
 * sugerida, que tem o mesmo formato de snapshot) a partir do SEU PRÓPRIO
 * snapshot — nunca a partir do alimento "ao vivo". Isso é o que garante que
 * um plano alimentar não mude se o alimento original for editado ou excluído
 * depois de já ter sido usado em um plano.
 */
export function calculateMealItemMacros(item: NutritionSnapshot): MacroTotals {
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

/**
 * Monta o snapshot nutricional de um alimento no formato gravado em
 * `meal_items` / `meal_item_substitutions` — centraliza essa cópia de
 * campos num único lugar, reusada sempre que um alimento real é incorporado
 * a um plano de verdade (item novo, substituição ou item aplicado de um
 * template), para nunca reimplementar essa lógica em mais de um ponto.
 */
export function buildFoodSnapshot(food: Food) {
  return {
    nome_alimento: food.nome,
    fonte_alimento: food.fonte,
    fonte_descricao_alimento: food.fonte_descricao,
    porcao_referencia_g: food.porcao_referencia_g,
    calorias_kcal: food.calorias_kcal ?? 0,
    proteinas_g: food.proteinas_g ?? 0,
    carboidratos_g: food.carboidratos_g ?? 0,
    gorduras_g: food.gorduras_g ?? 0,
    fibras_g: food.fibras_g ?? 0,
  };
}

/**
 * Gramas de `food` necessárias para chegar perto de `targetKcal` — usado
 * para sugerir a quantidade de um alimento substituto com aporte calórico
 * semelhante ao do item original. Retorna null quando o alimento não tem
 * calorias cadastradas (não dá pra escalar por proporção nesse caso).
 */
export function calculateQuantityForTargetCalories(food: Food, targetKcal: number): number | null {
  const caloriasPorPorcao = Number(food.calorias_kcal);
  if (!caloriasPorPorcao || caloriasPorPorcao <= 0) return null;
  const porcao = Number(food.porcao_referencia_g) || 100;
  return (targetKcal / caloriasPorPorcao) * porcao;
}

export interface PlanMetas {
  meta_kcal: number | null;
  meta_proteinas_g: number | null;
  meta_carboidratos_g: number | null;
  meta_gorduras_g: number | null;
}

export interface GoalComparison {
  label: "Dentro da meta" | "Acima da meta" | "Abaixo da meta";
  tone: "success" | "warning";
  diff: number;
  detail: string;
}

const TOLERANCIA_PERCENTUAL_META = 5;

/**
 * Compara um total calculado com a meta definida para o plano, com uma
 * tolerância de 5% pra não marcar como "fora da meta" uma diferença
 * irrisória. Usado tanto na tela (DailyTotalsCard) quanto no PDF do plano —
 * mesma função, mesmo resultado nos dois lugares.
 */
export function compareToGoal(total: number, meta: number | null, unit: string, decimals: number): GoalComparison | null {
  if (meta === null || meta === undefined) return null;

  const diff = total - meta;
  const percentual = meta > 0 ? (diff / meta) * 100 : 0;
  const detail = `${diff > 0 ? "+" : ""}${diff.toFixed(decimals)} ${unit}`;

  if (Math.abs(percentual) <= TOLERANCIA_PERCENTUAL_META) {
    return { label: "Dentro da meta", tone: "success", diff, detail };
  }
  return { label: diff > 0 ? "Acima da meta" : "Abaixo da meta", tone: "warning", diff, detail };
}
