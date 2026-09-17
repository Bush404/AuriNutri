import { describe, expect, it } from "vitest";
import type { MealItem } from "@/lib/types/database.types";
import { calculatePlanTotals, type MealWithItems } from "@/lib/nutrition";
import { buildPlanPdfViewModel } from "./plan-pdf-data";

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
    deleted_at: null,
    ...overrides,
  };
}

function makeMeal(overrides: Partial<MealWithItems> = {}): MealWithItems {
  return {
    id: "meal-1",
    meal_plan_id: "plan-1",
    user_id: "user-1",
    nome: "Café da manhã",
    horario: "08:00:00",
    observacoes: null,
    ordem: 0,
    created_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    items: [makeMealItem()],
    ...overrides,
  };
}

const PLANO_BASE = {
  nome: "Plano de teste",
  data_inicio: "2026-01-01",
  observacoes: null,
  meta_kcal: null,
  meta_proteinas_g: null,
  meta_carboidratos_g: null,
  meta_gorduras_g: null,
};

const PROFISSIONAL_BASE = {
  nome: "Dra. Teste",
  crn: "12345",
  crnUf: "SP",
  especialidade: null,
  telefone: null,
  endereco: null,
  corMarca: null,
  logoUrl: null,
  assinaturaUrl: null,
};

describe("buildPlanPdfViewModel — os totais do PDF são os MESMOS da tela", () => {
  it("o total geral do PDF é idêntico ao de calculatePlanTotals (mesma função, não uma reimplementação)", () => {
    const refeicoes = [
      makeMeal({
        id: "meal-1",
        items: [
          makeMealItem({ id: "item-1", quantidade_g: 150, calorias_kcal: 128, proteinas_g: 2.5, carboidratos_g: 28.1, gorduras_g: 0.2, fibras_g: 1.6, porcao_referencia_g: 100 }),
          makeMealItem({ id: "item-2", nome_alimento: "Ovo cozido", quantidade_g: 50, calorias_kcal: 155, proteinas_g: 13, carboidratos_g: 1.1, gorduras_g: 11, fibras_g: 0, porcao_referencia_g: 100 }),
        ],
      }),
      makeMeal({
        id: "meal-2",
        nome: "Almoço",
        ordem: 1,
        items: [
          makeMealItem({ id: "item-3", meal_id: "meal-2", nome_alimento: "Frango grelhado", quantidade_g: 120, calorias_kcal: 165, proteinas_g: 31, carboidratos_g: 0, gorduras_g: 3.6, fibras_g: 0, porcao_referencia_g: 100 }),
        ],
      }),
    ];

    const totalDaTela = calculatePlanTotals(refeicoes);

    const viewModel = buildPlanPdfViewModel({
      profissional: PROFISSIONAL_BASE,
      pacienteNome: "Paciente Teste",
      plano: PLANO_BASE,
      refeicoes,
    });

    expect(viewModel.totais).toEqual(totalDaTela);
  });

  it("o total de cada refeição no PDF bate com a soma dos itens dela", () => {
    const refeicoes = [
      makeMeal({
        items: [
          makeMealItem({ quantidade_g: 200, calorias_kcal: 50, proteinas_g: 1, carboidratos_g: 10, gorduras_g: 0.5, fibras_g: 2 }),
        ],
      }),
    ];

    const viewModel = buildPlanPdfViewModel({
      profissional: PROFISSIONAL_BASE,
      pacienteNome: "Paciente Teste",
      plano: PLANO_BASE,
      refeicoes,
    });

    expect(viewModel.refeicoes[0].totais.calorias).toBeCloseTo(100, 5); // 50 kcal/100g * 200g
    expect(viewModel.totais.calorias).toBeCloseTo(viewModel.refeicoes[0].totais.calorias, 5);
  });

  it("não recalcula nada quando não há meta — comparativos ficam null", () => {
    const viewModel = buildPlanPdfViewModel({
      profissional: PROFISSIONAL_BASE,
      pacienteNome: "Paciente Teste",
      plano: PLANO_BASE,
      refeicoes: [makeMeal()],
    });

    expect(viewModel.temMeta).toBe(false);
    expect(viewModel.comparativos.calorias).toBeNull();
  });

  it("com meta definida, o comparativo usa o mesmo total já calculado (não um valor à parte)", () => {
    const refeicoes = [makeMeal({ items: [makeMealItem({ quantidade_g: 100, calorias_kcal: 2000, proteinas_g: 0, carboidratos_g: 0, gorduras_g: 0, fibras_g: 0, porcao_referencia_g: 100 })] })];

    const viewModel = buildPlanPdfViewModel({
      profissional: PROFISSIONAL_BASE,
      pacienteNome: "Paciente Teste",
      plano: { ...PLANO_BASE, meta_kcal: 2000 },
      refeicoes,
    });

    expect(viewModel.temMeta).toBe(true);
    expect(viewModel.comparativos.calorias).not.toBeNull();
    expect(viewModel.comparativos.calorias?.label).toBe("Dentro da meta");
  });

  it("preserva fonte_alimento de cada item, para a atribuição da TACO ficar correta no PDF", () => {
    const refeicoes = [
      makeMeal({
        items: [
          makeMealItem({ id: "item-taco", fonte_alimento: "taco" }),
          makeMealItem({ id: "item-custom", fonte_alimento: "personalizado" }),
        ],
      }),
    ];

    const viewModel = buildPlanPdfViewModel({
      profissional: PROFISSIONAL_BASE,
      pacienteNome: "Paciente Teste",
      plano: PLANO_BASE,
      refeicoes,
    });

    expect(viewModel.refeicoes[0].itens.map((i) => i.fonteAlimento)).toEqual(["taco", "personalizado"]);
    expect(viewModel.fonteFooter).toContain("TACO");
  });
});
