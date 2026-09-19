import { describe, expect, it } from "vitest";
import type { Food, MealItem, Recipe, RecipeIngredient } from "@/lib/types/database.types";
import {
  buildFonteFooter,
  buildRecipeSnapshot,
  calculateFoodMacros,
  calculateMealItemMacros,
  calculateMealTotals,
  calculatePlanTotals,
  calculateRecipeEffectivePerPortion,
  calculateRecipePer100g,
  calculateRecipePerPortion,
  calculateRecipeTotals,
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
    deleted_at: null,
    ...overrides,
  };
}

function makeMealItem(overrides: Partial<MealItem> = {}): MealItem {
  return {
    id: "item-1",
    meal_id: "meal-1",
    food_id: "food-1",
    recipe_id: null,
    user_id: "user-1",
    quantidade_g: 100,
    quantidade_porcoes: null,
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
    fontes_ingredientes_receita: null,
    created_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

function makeRecipeIngredient(overrides: Partial<RecipeIngredient> = {}): RecipeIngredient {
  return {
    id: "ri-1",
    recipe_id: "recipe-1",
    food_id: "food-1",
    user_id: "user-1",
    quantidade_g: 100,
    ordem: 0,
    nome_alimento: "Arroz cru",
    fonte_alimento: "taco",
    fonte_descricao_alimento: null,
    porcao_referencia_g: 100,
    calorias_kcal: 130,
    proteinas_g: 2.7,
    carboidratos_g: 28,
    gorduras_g: 0.3,
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
    ...overrides,
  };
}

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: "recipe-1",
    user_id: "user-1",
    nome: "Panqueca de banana",
    descricao: null,
    modo_preparo: null,
    imagem_url: null,
    rendimento_g: 200,
    numero_porcoes: 2,
    tempo_preparo_min: null,
    tags: [],
    valores_sobrescritos: {},
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
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
    expect(footer).toMatch(/NEPA/);
    expect(footer).toMatch(/UNICAMP/);
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
    expect(footer).toBeNull();
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

describe("calculateRecipeTotals — soma macros e micros a partir do snapshot dos ingredientes", () => {
  it("soma os macros dos ingredientes (mesma fórmula de calculateMealItemMacros)", () => {
    const ingredients = [
      makeRecipeIngredient({ id: "i1", calorias_kcal: 130, quantidade_g: 100, porcao_referencia_g: 100 }),
      makeRecipeIngredient({ id: "i2", calorias_kcal: 165, quantidade_g: 200, porcao_referencia_g: 100 }),
    ];
    const totals = calculateRecipeTotals(ingredients);
    expect(totals.macros.calorias).toBe(130 + 165 * 2);
  });

  it("retorna zero e nenhum micro parcial para uma receita sem ingredientes", () => {
    const totals = calculateRecipeTotals([]);
    expect(totals.macros).toEqual(ZERO_MACROS);
    expect(totals.micros.ferro_mg).toEqual({ valor: 0, parcial: false, ingredientesSemDado: 0 });
  });

  it("usa o snapshot do ingrediente, nunca um alimento atual editado depois", () => {
    const ingredient = makeRecipeIngredient({ calorias_kcal: 130, quantidade_g: 100, porcao_referencia_g: 100 });

    // Simula o alimento de origem sendo editado após já ter sido incluído na receita.
    const foodEditadoDepois = makeFood({ id: "food-1", calorias_kcal: 999 });

    const totals = calculateRecipeTotals([ingredient]);

    expect(totals.macros.calorias).toBe(130);
    expect(totals.macros.calorias).not.toBe(foodEditadoDepois.calorias_kcal);
  });

  it("continua calculando corretamente mesmo com o alimento de origem excluído (food_id null)", () => {
    const ingredient = makeRecipeIngredient({ food_id: null, calorias_kcal: 130, quantidade_g: 200, porcao_referencia_g: 100 });
    const totals = calculateRecipeTotals([ingredient]);
    expect(totals.macros.calorias).toBe(260);
  });
});

describe("calculateRecipeTotals — micronutriente parcial nunca vira zero", () => {
  it("soma só os ingredientes que têm o dado e marca o total como parcial", () => {
    const ingredients = [
      makeRecipeIngredient({ id: "i1", ferro_mg: 4, quantidade_g: 100, porcao_referencia_g: 100 }),
      makeRecipeIngredient({ id: "i2", ferro_mg: null, quantidade_g: 100, porcao_referencia_g: 100 }),
    ];
    const totals = calculateRecipeTotals(ingredients);

    expect(totals.micros.ferro_mg.valor).toBe(4);
    expect(totals.micros.ferro_mg.parcial).toBe(true);
    expect(totals.micros.ferro_mg.ingredientesSemDado).toBe(1);
  });

  it("não fica parcial quando todos os ingredientes têm o dado", () => {
    const ingredients = [
      makeRecipeIngredient({ id: "i1", sodio_mg: 10, quantidade_g: 100, porcao_referencia_g: 100 }),
      makeRecipeIngredient({ id: "i2", sodio_mg: 20, quantidade_g: 100, porcao_referencia_g: 100 }),
    ];
    const totals = calculateRecipeTotals(ingredients);

    expect(totals.micros.sodio_mg).toEqual({ valor: 30, parcial: false, ingredientesSemDado: 0 });
  });

  it("fica parcial mesmo quando NENHUM ingrediente tem o dado (soma 0, mas marcado como incompleto)", () => {
    const ingredients = [
      makeRecipeIngredient({ id: "i1", zinco_mg: null }),
      makeRecipeIngredient({ id: "i2", zinco_mg: null }),
    ];
    const totals = calculateRecipeTotals(ingredients);

    expect(totals.micros.zinco_mg.valor).toBe(0);
    expect(totals.micros.zinco_mg.parcial).toBe(true);
    expect(totals.micros.zinco_mg.ingredientesSemDado).toBe(2);
  });
});

describe("calculateRecipePerPortion / calculateRecipePer100g — fator de cocção", () => {
  it("por porção divide pelo número de porções informado, não pela contagem de ingredientes", () => {
    const ingredients = [
      makeRecipeIngredient({ id: "i1", calorias_kcal: 100, quantidade_g: 100, porcao_referencia_g: 100 }),
      makeRecipeIngredient({ id: "i2", calorias_kcal: 200, quantidade_g: 100, porcao_referencia_g: 100 }),
    ];
    // Total = 300 kcal, dividido em 4 porções (não em 2, que é o nº de ingredientes).
    const perPortion = calculateRecipePerPortion(ingredients, 4);
    expect(perPortion.macros.calorias).toBe(75);
  });

  it("por 100g usa o rendimento informado quando é MENOR que a soma dos ingredientes (perda de água/cocção)", () => {
    // 200g de ingredientes crus, mas a preparação pronta rende só 150g (ex.: carne grelhada).
    const ingredients = [makeRecipeIngredient({ calorias_kcal: 200, quantidade_g: 200, porcao_referencia_g: 100 })];
    const per100g = calculateRecipePer100g(ingredients, 150);
    // Total = 400 kcal (200 * 2) em 150g de preparação pronta => 400/150*100.
    expect(per100g.macros.calorias).toBeCloseTo((400 / 150) * 100, 5);
  });

  it("por 100g usa o rendimento informado quando é MAIOR que a soma dos ingredientes (absorção de água)", () => {
    // 100g de arroz cru rendem 250g de arroz cozido (absorve água).
    const ingredients = [makeRecipeIngredient({ calorias_kcal: 130, quantidade_g: 100, porcao_referencia_g: 100 })];
    const per100g = calculateRecipePer100g(ingredients, 250);
    // Total = 130 kcal em 250g de preparação pronta => 130/250*100.
    expect(per100g.macros.calorias).toBeCloseTo((130 / 250) * 100, 5);
  });

  it("escala o valor do micronutriente mas preserva a marca de parcial", () => {
    const ingredients = [
      makeRecipeIngredient({ id: "i1", ferro_mg: 10, quantidade_g: 100, porcao_referencia_g: 100 }),
      makeRecipeIngredient({ id: "i2", ferro_mg: null, quantidade_g: 100, porcao_referencia_g: 100 }),
    ];
    const per100g = calculateRecipePer100g(ingredients, 200);
    expect(per100g.micros.ferro_mg.valor).toBe(5); // 10 em 200g de rendimento => 10/200*100
    expect(per100g.micros.ferro_mg.parcial).toBe(true);
    expect(per100g.micros.ferro_mg.ingredientesSemDado).toBe(1);
  });
});

describe("calculateRecipeEffectivePerPortion — correção manual do profissional prevalece sobre o calculado", () => {
  it("usa o calculado quando não há override para 'porcao.<campo>'", () => {
    const ingredients = [makeRecipeIngredient({ calorias_kcal: 100, quantidade_g: 100, porcao_referencia_g: 100 })];
    const macros = calculateRecipeEffectivePerPortion(ingredients, 2, {});
    expect(macros.calorias).toBe(50); // 100 kcal / 2 porções
  });

  it("usa o valor sobrescrito quando 'porcao.calorias' está definido, mesmo que difira do calculado", () => {
    const ingredients = [makeRecipeIngredient({ calorias_kcal: 100, quantidade_g: 100, porcao_referencia_g: 100 })];
    const macros = calculateRecipeEffectivePerPortion(ingredients, 2, { "porcao.calorias": 999 });
    expect(macros.calorias).toBe(999);
    expect(macros.proteinas).not.toBe(999); // só o campo sobrescrito muda, os outros continuam calculados
  });
});

describe("buildRecipeSnapshot — receita usada como item de refeição (Fase 6, Bloco C)", () => {
  it("porcao_referencia_g vira os gramas de UMA porção (rendimento_g / numero_porcoes)", () => {
    const recipe = makeRecipe({ rendimento_g: 200, numero_porcoes: 4 });
    const snapshot = buildRecipeSnapshot(recipe, []);
    expect(snapshot.porcao_referencia_g).toBe(50);
  });

  it("aplica valores_sobrescritos da receita ao snapshot, não o bruto calculado", () => {
    const recipe = makeRecipe({
      rendimento_g: 200,
      numero_porcoes: 2,
      valores_sobrescritos: { "porcao.calorias": 300 },
    });
    const ingredients = [makeRecipeIngredient({ calorias_kcal: 100, quantidade_g: 100, porcao_referencia_g: 100 })];
    const snapshot = buildRecipeSnapshot(recipe, ingredients);
    expect(snapshot.calorias_kcal).toBe(300);
  });

  it("marca fonte_alimento como 'receita' e reúne o CONJUNTO de fontes dos ingredientes", () => {
    const recipe = makeRecipe();
    const ingredients = [
      makeRecipeIngredient({ id: "i1", fonte_alimento: "taco" }),
      makeRecipeIngredient({ id: "i2", fonte_alimento: "personalizado" }),
      makeRecipeIngredient({ id: "i3", fonte_alimento: "taco" }), // duplicata não deve aparecer duas vezes
    ];
    const snapshot = buildRecipeSnapshot(recipe, ingredients);
    expect(snapshot.fonte_alimento).toBe("receita");
    expect(snapshot.fontes_ingredientes_receita.sort()).toEqual(["personalizado", "taco"]);
  });

  it("editar a receita depois de tirar o snapshot NÃO altera o snapshot já tirado (mesmo princípio de calculateRecipeTotals)", () => {
    const recipeV1 = makeRecipe({ rendimento_g: 200, numero_porcoes: 2 });
    const ingredientsV1 = [makeRecipeIngredient({ calorias_kcal: 100, quantidade_g: 100, porcao_referencia_g: 100 })];

    const snapshotTiradoAoAdicionarAoPlano = buildRecipeSnapshot(recipeV1, ingredientsV1);

    // A receita é editada DEPOIS: ingrediente trocado por um bem mais calórico.
    const recipeV2Ingredients = [makeRecipeIngredient({ calorias_kcal: 900, quantidade_g: 100, porcao_referencia_g: 100 })];
    const snapshotSeFosseTiradoAgora = buildRecipeSnapshot(recipeV1, recipeV2Ingredients);

    expect(snapshotTiradoAoAdicionarAoPlano.calorias_kcal).toBe(50); // 100 kcal / 2 porções, congelado
    expect(snapshotSeFosseTiradoAgora.calorias_kcal).toBe(450); // o que teria sido se tirado só agora
    expect(snapshotTiradoAoAdicionarAoPlano.calorias_kcal).not.toBe(snapshotSeFosseTiradoAgora.calorias_kcal);
  });
});

describe("collectFontesUsadas / buildFonteFooter — item de receita credita as fontes dos SEUS ingredientes", () => {
  it("um item de receita contribui com o conjunto de fontes de fontes_ingredientes_receita, não com 'receita'", () => {
    const itemReceita: MealItem = {
      id: "item-receita",
      meal_id: "meal-1",
      food_id: null,
      recipe_id: "recipe-1",
      user_id: "user-1",
      quantidade_g: 100,
      quantidade_porcoes: 2,
      ordem: 0,
      nome_alimento: "Panqueca de banana",
      fonte_alimento: "receita",
      fonte_descricao_alimento: null,
      porcao_referencia_g: 50,
      calorias_kcal: 100,
      proteinas_g: 5,
      carboidratos_g: 10,
      gorduras_g: 2,
      fibras_g: 1,
      fontes_ingredientes_receita: ["taco"],
      created_at: "2026-01-01T00:00:00Z",
      deleted_at: null,
    };

    const fontes = collectFontesUsadas([{ items: [itemReceita] }]);
    expect(fontes).toEqual(["taco"]);
  });

  it("um plano com só um item de receita que usa TACO ainda credita o NEPA/UNICAMP no rodapé", () => {
    const itemReceita: MealItem = {
      id: "item-receita",
      meal_id: "meal-1",
      food_id: null,
      recipe_id: "recipe-1",
      user_id: "user-1",
      quantidade_g: 100,
      quantidade_porcoes: 2,
      ordem: 0,
      nome_alimento: "Panqueca de banana",
      fonte_alimento: "receita",
      fonte_descricao_alimento: null,
      porcao_referencia_g: 50,
      calorias_kcal: 100,
      proteinas_g: 5,
      carboidratos_g: 10,
      gorduras_g: 2,
      fibras_g: 1,
      fontes_ingredientes_receita: ["taco", "personalizado"],
      created_at: "2026-01-01T00:00:00Z",
      deleted_at: null,
    };

    const footer = buildFonteFooter(collectFontesUsadas([{ items: [itemReceita] }]));
    expect(footer).toContain("TACO");
  });
});

describe("calculateMealItemMacros — item de receita (quantidade em porções convertida para gramas no snapshot)", () => {
  it("bate com o cálculo manual: quantidade_porcoes * macros por porção", () => {
    // Receita: 200 kcal por porção (porcao_referencia_g = 50g/porção, calorias_kcal = 200 nessa porção).
    const item = {
      porcao_referencia_g: 50,
      quantidade_g: 2 * 50, // 2 porções, já convertido para gramas como addMealItemRecipe faz
      calorias_kcal: 200,
      proteinas_g: 10,
      carboidratos_g: 20,
      gorduras_g: 5,
      fibras_g: 3,
    };
    const macros = calculateMealItemMacros(item);
    // Cálculo manual: 2 porções inteiras => o dobro dos valores por porção.
    expect(macros.calorias).toBe(400);
    expect(macros.proteinas).toBe(20);
    expect(macros.carboidratos).toBe(40);
    expect(macros.gorduras).toBe(10);
  });
});
