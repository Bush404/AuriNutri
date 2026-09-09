import { describe, expect, it } from "vitest";
import type { Food, MealItem } from "@/lib/types/database.types";
import {
  buildFonteFooter,
  calculateFoodMacros,
  calculateMealItemMacros,
  calculateMealTotals,
  calculatePlanTotals,
  collectFontesUsadas,
  formatMacro,
  formatNutrientValue,
  sumMacros,
  ZERO_MACROS,
} from "./nutrition";

function makeFood(overrides: Partial<Food> = {}): Food {
  return {
    id: "food-1",
    user_id: null,
    nome: "Arroz branco cozido",
    categoria: "Cereais e grãos",
    marca: null,
    fonte: "taco",
    fonte_descricao: null,
    is_global: true,
    codigo_taco: 1,
    porcao_referencia_g: 100,
    calorias_kcal: 128,
    proteinas_g: 2.5,
    carboidratos_g: 28.1,
    gorduras_g: 0.2,
    fibras_g: 1.6,
    umidade_g: null,
    cinzas_g: null,
    colesterol_mg: null,
    calcio_mg: null,
    magnesio_mg: null,
    manganes_mg: null,
    fosforo_mg: null,
    ferro_mg: null,
    sodio_mg: null,
    potassio_mg: null,
    cobre_mg: null,
    zinco_mg: null,
    retinol_mcg: null,
    re_mcg: null,
    rae_mcg: null,
    tiamina_mg: null,
    riboflavina_mg: null,
    piridoxina_mg: null,
    niacina_mg: null,
    vitamina_c_mg: null,
    gordura_saturada_g: null,
    gordura_monoinsaturada_g: null,
    gordura_poliinsaturada_g: null,
    valores_especiais: {},
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeMealItem(overrides: Partial<MealItem> = {}): MealItem {
  return {
    id: "item-1",
    meal_id: "meal-1",
    food_id: "food-1",
    user_id: "user-1",
    quantidade_g: 100,
    ordem: 0,
    nome_alimento: "Arroz branco cozido",
    fonte_alimento: "taco",
    fonte_descricao_alimento: null,
    porcao_referencia_g: 100,
    calorias_kcal: 128,
    proteinas_g: 2.5,
    carboidratos_g: 28.1,
    gorduras_g: 0.2,
    fibras_g: 1.6,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("calculateFoodMacros — proporção por quantidade vs. porção de referência", () => {
  it("retorna os valores base quando a quantidade é igual à porção de referência", () => {
    const food = makeFood({ porcao_referencia_g: 100, calorias_kcal: 128, proteinas_g: 2.5 });
    const macros = calculateFoodMacros(food, 100);
    expect(macros.calorias).toBe(128);
    expect(macros.proteinas).toBe(2.5);
  });

  it("aplica o fator proporcional quando a quantidade é metade da porção de referência", () => {
    const food = makeFood({ porcao_referencia_g: 100, calorias_kcal: 128, proteinas_g: 2.5 });
    const macros = calculateFoodMacros(food, 50);
    expect(macros.calorias).toBe(64);
    expect(macros.proteinas).toBe(1.25);
  });

  it("aplica o fator proporcional quando a quantidade é o dobro da porção de referência", () => {
    const food = makeFood({ porcao_referencia_g: 100, calorias_kcal: 128 });
    const macros = calculateFoodMacros(food, 200);
    expect(macros.calorias).toBe(256);
  });

  it("respeita uma porção de referência diferente de 100g", () => {
    // Ex.: alimento cadastrado com referência de 30g (ex.: uma fatia de pão).
    const food = makeFood({ porcao_referencia_g: 30, calorias_kcal: 90 });
    const macros = calculateFoodMacros(food, 60);
    expect(macros.calorias).toBe(180);
  });

  it("usa 100g como fallback se a porção de referência for 0/ausente", () => {
    const food = makeFood({ porcao_referencia_g: 0, calorias_kcal: 100 });
    const macros = calculateFoodMacros(food, 100);
    expect(macros.calorias).toBe(100);
  });
});

describe("calculateFoodMacros — valores nulos tratados como 0 na soma, sem sobrescrever a origem", () => {
  it("trata macronutrientes ausentes (null) como 0 no total calculado", () => {
    const food = makeFood({
      calorias_kcal: null,
      proteinas_g: null,
      carboidratos_g: null,
      gorduras_g: null,
      fibras_g: null,
    });

    const macros = calculateFoodMacros(food, 100);

    expect(macros).toEqual(ZERO_MACROS);
  });

  it("não sobrescreve o valor null original do alimento ao calcular", () => {
    const food = makeFood({ fibras_g: null });
    calculateFoodMacros(food, 250);
    expect(food.fibras_g).toBeNull();
  });

  it("soma parcialmente quando só alguns nutrientes estão ausentes", () => {
    const food = makeFood({ calorias_kcal: 100, fibras_g: null });
    const macros = calculateFoodMacros(food, 100);
    expect(macros.calorias).toBe(100);
    expect(macros.fibras).toBe(0);
  });
});

describe("calculateMealItemMacros — calcula a partir do snapshot do item, nunca do alimento atual", () => {
  it("usa os valores gravados no item, não os de um alimento que tenha sido editado depois", () => {
    const item = makeMealItem({ calorias_kcal: 128, quantidade_g: 100, porcao_referencia_g: 100 });

    // Simula o alimento de origem sendo editado após o item já ter sido adicionado ao plano.
    const foodEditadoDepois = makeFood({ id: "food-1", calorias_kcal: 999 });

    const macros = calculateMealItemMacros(item);

    expect(macros.calorias).toBe(128);
    expect(macros.calorias).not.toBe(foodEditadoDepois.calorias_kcal);
  });

  it("continua calculando corretamente mesmo se o alimento de origem foi excluído (food_id null)", () => {
    const item = makeMealItem({ food_id: null, calorias_kcal: 128, quantidade_g: 200, porcao_referencia_g: 100 });
    const macros = calculateMealItemMacros(item);
    expect(macros.calorias).toBe(256);
  });

  it("aplica a proporção da quantidade do item sobre a porção de referência do próprio snapshot", () => {
    const item = makeMealItem({ porcao_referencia_g: 50, calorias_kcal: 90, quantidade_g: 100 });
    const macros = calculateMealItemMacros(item);
    expect(macros.calorias).toBe(180);
  });
});

describe("soma por refeição e total diário", () => {
  it("sumMacros soma uma lista de totais e retorna ZERO_MACROS para lista vazia", () => {
    expect(sumMacros([])).toEqual(ZERO_MACROS);

    const total = sumMacros([
      { calorias: 100, proteinas: 10, carboidratos: 20, gorduras: 5, fibras: 2 },
      { calorias: 50, proteinas: 5, carboidratos: 10, gorduras: 2, fibras: 1 },
    ]);
    expect(total).toEqual({ calorias: 150, proteinas: 15, carboidratos: 30, gorduras: 7, fibras: 3 });
  });

  it("calculateMealTotals soma os itens de uma refeição a partir do snapshot de cada item", () => {
    const items = [
      makeMealItem({ id: "i1", calorias_kcal: 128, quantidade_g: 100, porcao_referencia_g: 100 }),
      makeMealItem({ id: "i2", calorias_kcal: 52, quantidade_g: 150, porcao_referencia_g: 100 }),
    ];
    const totals = calculateMealTotals(items);
    expect(totals.calorias).toBe(128 + 52 * 1.5);
  });

  it("calculatePlanTotals soma os totais de todas as refeições do plano", () => {
    const meals = [
      { items: [makeMealItem({ id: "i1", calorias_kcal: 100, quantidade_g: 100, porcao_referencia_g: 100 })] },
      { items: [makeMealItem({ id: "i2", calorias_kcal: 200, quantidade_g: 100, porcao_referencia_g: 100 })] },
    ];
    const totals = calculatePlanTotals(meals);
    expect(totals.calorias).toBe(300);
  });

  it("calculatePlanTotals retorna zero para um plano sem refeições/itens", () => {
    expect(calculatePlanTotals([])).toEqual(ZERO_MACROS);
    expect(calculatePlanTotals([{ items: [] }])).toEqual(ZERO_MACROS);
  });
});

describe("buildFonteFooter", () => {
  it("retorna null quando nenhuma fonte foi usada", () => {
    expect(buildFonteFooter([])).toBeNull();
  });

  it("atribui à TACO quando só alimentos TACO foram usados", () => {
    const footer = buildFonteFooter(["taco"]);
    expect(footer).toMatch(/TACO/);
    expect(footer).toMatch(/NEPA\/UNICAMP/);
  });

  it("não gera nenhuma atribuição quando só alimentos personalizados foram usados", () => {
    expect(buildFonteFooter(["personalizado"])).toBeNull();
  });

  it("gera a nota combinada quando o plano mistura TACO e personalizados", () => {
    const footer = buildFonteFooter(["taco", "personalizado"]);
    expect(footer).toMatch(/TACO/);
    expect(footer).toMatch(/profissional responsável/);
  });

  it("nunca atribui um alimento personalizado à TACO", () => {
    const footer = buildFonteFooter(["personalizado", "personalizado"]);
    expect(footer).not.toMatch(/TACO/);
  });
});

describe("collectFontesUsadas", () => {
  it("reúne as fontes de todos os itens de todas as refeições, com duplicatas", () => {
    const meals = [
      { items: [makeMealItem({ fonte_alimento: "taco" }), makeMealItem({ fonte_alimento: "personalizado" })] },
      { items: [makeMealItem({ fonte_alimento: "taco" })] },
    ];
    expect(collectFontesUsadas(meals)).toEqual(["taco", "personalizado", "taco"]);
  });

  it("retorna lista vazia para plano sem itens", () => {
    expect(collectFontesUsadas([{ items: [] }])).toEqual([]);
  });
});

describe("formatMacro", () => {
  it("formata com uma casa decimal e unidade padrão 'g'", () => {
    expect(formatMacro(12.345)).toBe("12.3g");
  });

  it("aceita uma unidade customizada", () => {
    expect(formatMacro(500, "mg")).toBe("500.0mg");
  });
});

describe("formatNutrientValue", () => {
  it("exibe 'traço' quando o valor está marcado como traço", () => {
    const food = makeFood({ fibras_g: null, valores_especiais: { fibras_g: "traco" } });
    expect(formatNutrientValue(food, "fibras_g", "g")).toBe("traço");
  });

  it("exibe 'não analisado' quando marcado como tal", () => {
    const food = makeFood({ ferro_mg: null, valores_especiais: { ferro_mg: "nao_analisado" } });
    expect(formatNutrientValue(food, "ferro_mg", "mg")).toBe("não analisado");
  });

  it("exibe travessão quando o valor é null sem motivo especial registrado", () => {
    const food = makeFood({ sodio_mg: null });
    expect(formatNutrientValue(food, "sodio_mg", "mg")).toBe("—");
  });

  it("formata um valor numérico normal com a unidade informada", () => {
    const food = makeFood({ calcio_mg: 12.5 });
    expect(formatNutrientValue(food, "calcio_mg", "mg")).toBe("12,5mg");
  });
});
