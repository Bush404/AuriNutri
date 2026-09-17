// @vitest-environment node
import { createElement, type ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";

import { PlanPdfDocument } from "./plan-pdf-document";
import { buildPlanPdfViewModel } from "./plan-pdf-data";
import type { MealItem } from "@/lib/types/database.types";
import type { MealWithItems } from "@/lib/nutrition";

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
    observacoes: "Comer com calma.",
    ordem: 0,
    created_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    items: [makeMealItem()],
    ...overrides,
  };
}

describe("PlanPdfDocument — smoke test de renderização real", () => {
  it("gera um buffer PDF válido, sem lançar exceção, mesmo sem logo/assinatura", async () => {
    const viewModel = buildPlanPdfViewModel({
      profissional: {
        nome: "Dra. Teste",
        crn: "12345",
        crnUf: "SP",
        especialidade: "Nutrição esportiva",
        telefone: "(11) 99999-9999",
        endereco: "Rua Teste, 123",
        corMarca: "#2563eb",
        logoUrl: null,
        assinaturaUrl: null,
      },
      pacienteNome: "Paciente Teste",
      plano: {
        nome: "Plano de emagrecimento",
        data_inicio: "2026-01-01",
        observacoes: "Beber bastante água.",
        meta_kcal: 2000,
        meta_proteinas_g: 120,
        meta_carboidratos_g: 200,
        meta_gorduras_g: 60,
      },
      refeicoes: [makeMeal()],
    });

    const element = createElement(PlanPdfDocument, { data: viewModel }) as unknown as ReactElement<DocumentProps>;
    const buffer = await renderToBuffer(element);

    expect(buffer.length).toBeGreaterThan(500);
    expect(buffer.subarray(0, 5).toString("utf-8")).toBe("%PDF-");
  });
});
