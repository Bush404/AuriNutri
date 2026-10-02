import { describe, expect, it } from "vitest";

import { formatarMedida, medidaUsual, quantidadeDoItem } from "./household-measures";

describe("medidaUsual", () => {
  it("sem medidas, nenhuma", () => {
    expect(medidaUsual([])).toBeNull();
  });

  it("prefere a última medida criada pelo profissional", () => {
    const m = medidaUsual([
      { nome: "unidade média", gramas: 50, fonte: "ibge" as const },
      { nome: "potinho", gramas: 80, fonte: "personalizado" as const },
      { nome: "pote grande", gramas: 150, fonte: "personalizado" as const },
    ]);
    expect(m?.nome).toBe("pote grande");
  });

  it("entre as do IBGE, segue a ordem de preferência", () => {
    const m = medidaUsual([
      { nome: "1/2 unidade", gramas: 25 },
      { nome: "porção guia alimentar", gramas: 50 },
      { nome: "unidade média", gramas: 50 },
    ]);
    expect(m?.nome).toBe("unidade média");
  });

  it("sem nenhuma preferida, pula as frações", () => {
    const m = medidaUsual([
      { nome: "1/4 pacote", gramas: 50 },
      { nome: "pacote", gramas: 200 },
    ]);
    expect(m?.nome).toBe("pacote");
  });
});

describe("formatarMedida", () => {
  it("uma medida", () => {
    expect(formatarMedida(1, "unidade média", 50)).toBe("1 unidade média (50 g)");
  });

  it("medida que já começa com fração não ganha o 1 na frente", () => {
    expect(formatarMedida(1, "1/2 unidade", 25)).toBe("1/2 unidade (25 g)");
  });

  it("várias medidas, com vírgula", () => {
    expect(formatarMedida(1.5, "colher de sopa cheia", 25)).toBe("1,5 × colher de sopa cheia (37,5 g)");
    expect(formatarMedida(2, "1/2 unidade", 25)).toBe("2 × 1/2 unidade (50 g)");
  });
});

describe("quantidadeDoItem", () => {
  it("item antigo, só em gramas", () => {
    expect(quantidadeDoItem({ quantidade_g: 120 })).toBe("120 g");
    expect(
      quantidadeDoItem({ quantidade_g: 12.5, medida_nome: null, medida_gramas: null, medida_quantidade: null }),
    ).toBe("12,5 g");
  });

  it("item com medida caseira", () => {
    expect(
      quantidadeDoItem({ quantidade_g: 100, medida_nome: "unidade média", medida_gramas: 50, medida_quantidade: 2 }),
    ).toBe("2 × unidade média (100 g)");
  });
});
