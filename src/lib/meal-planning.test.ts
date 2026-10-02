import { describe, expect, it } from "vitest";

import {
  analisarCardapio,
  classificarDensidade,
  distribuicaoCalorica,
  distribuirMacros,
  equivalencias,
  kcalDoPlano,
  kcalNaoProteicaPorGN,
  kcalPorKg,
  ordenarPlanos,
} from "./meal-planning";

describe("distribuirMacros — fórmula de bolso (g/kg)", () => {
  it("80 kg com 2 / 1 / 4 g/kg → 160 g PTN, 80 g LIP, 320 g CHO e 2.640 kcal", () => {
    const r = distribuirMacros({ modo: "g_kg", pesoKg: 80, getKcal: null, proteinas: 2, lipidios: 1, carboidratos: 4 });
    expect(r).toEqual({ ok: true, metas: { kcal: 2640, proteinas_g: 160, lipidios_g: 80, carboidratos_g: 320 } });
  });

  it("sem peso, pede o peso", () => {
    const r = distribuirMacros({
      modo: "g_kg",
      pesoKg: null,
      getKcal: null,
      proteinas: 2,
      lipidios: 1,
      carboidratos: 4,
    });
    expect(r.ok).toBe(false);
  });
});

describe("distribuirMacros — percentual do GET", () => {
  it("2.000 kcal com 20 / 30 / 50% → 100 g PTN, 66,7 g LIP, 250 g CHO", () => {
    const r = distribuirMacros({
      modo: "percentual",
      pesoKg: 70,
      getKcal: 2000,
      proteinas: 20,
      lipidios: 30,
      carboidratos: 50,
    });
    if (!r.ok) throw new Error(r.motivo);
    expect(r.metas.kcal).toBe(2000);
    expect(r.metas.proteinas_g).toBeCloseTo(100, 6);
    expect(r.metas.lipidios_g).toBeCloseTo(66.667, 3);
    expect(r.metas.carboidratos_g).toBeCloseTo(250, 6);
  });

  it("percentuais que não somam 100% são recusados (com tolerância de casas decimais)", () => {
    expect(
      distribuirMacros({ modo: "percentual", pesoKg: 70, getKcal: 2000, proteinas: 20, lipidios: 30, carboidratos: 40 })
        .ok,
    ).toBe(false);
    expect(
      distribuirMacros({
        modo: "percentual",
        pesoKg: 70,
        getKcal: 2000,
        proteinas: 33.3,
        lipidios: 33.3,
        carboidratos: 33.4,
      }).ok,
    ).toBe(true);
  });
});

describe("equivalencias", () => {
  it("mostra os mesmos gramas em % e em g/kg", () => {
    const e = equivalencias({ kcal: 2640, proteinas_g: 160, lipidios_g: 80, carboidratos_g: 320 }, 80);
    expect(e.proteinas.gkg).toBe(2);
    expect(e.proteinas.pct).toBeCloseTo((640 * 100) / 2640, 6);
    expect(e.lipidios.pct).toBeCloseTo((720 * 100) / 2640, 6);
    expect(e.kcalPorKg).toBe(33);
  });
});

describe("análise do cardápio", () => {
  const totais = { calorias: 2000, proteinas: 100, carboidratos: 250, gorduras: 60, fibras: 30 };

  it("kcal não proteica por g de N: (2.000 − 400) ÷ (100 ÷ 6,25) = 100", () => {
    expect(kcalNaoProteicaPorGN(2000, 100)).toBeCloseTo(100, 6);
    expect(kcalNaoProteicaPorGN(2000, 0)).toBeNull();
  });

  it("prescrito × teórico × diferença, carboidratos livres e densidade calórica", () => {
    const linhas = analisarCardapio(totais, 1600, {
      meta_kcal: 2200,
      meta_proteinas_g: 110,
      meta_carboidratos_g: 275,
      meta_gorduras_g: 73,
    });
    const por = Object.fromEntries(linhas.map((l) => [l.parametro, l]));
    expect(por["Proteínas totais"].diferenca).toBe(-10);
    expect(por["Calorias totais"].diferenca).toBe(-200);
    expect(por["Carboidratos livres"].prescrito).toBe(220);
    expect(por["Densidade calórica"].prescrito).toBe(1.25);
    expect(por["Fibras totais"].teorico).toBeNull();
  });

  it("plano sem metas: teórico e diferença vazios", () => {
    const linhas = analisarCardapio(totais, 0, {
      meta_kcal: null,
      meta_proteinas_g: null,
      meta_carboidratos_g: null,
      meta_gorduras_g: null,
    });
    expect(linhas.every((l) => l.teorico === null && l.diferenca === null)).toBe(true);
    expect(linhas.find((l) => l.parametro === "Densidade calórica")!.prescrito).toBeNull();
  });

  it("distribuição calórica em % das kcal dos macros", () => {
    const d = distribuicaoCalorica(totais);
    expect(d.proteinas.kcal).toBe(400);
    expect(d.lipidios.kcal).toBe(540);
    expect(d.proteinas.pct + d.lipidios.pct + d.carboidratos.pct).toBeCloseTo(100, 6);
  });
});

describe("classificarDensidade (Ledikwe et al., 2005)", () => {
  it("pão francês: 150 kcal em 50 g = 3,0 kcal/g → média (como no WebDiet)", () => {
    expect(classificarDensidade(150, 50)).toMatchObject({ valor: 3, rotulo: "média" });
  });
  it("faixas e refeição vazia", () => {
    expect(classificarDensidade(50, 100)?.rotulo).toBe("muito baixa");
    expect(classificarDensidade(100, 100)?.rotulo).toBe("baixa");
    expect(classificarDensidade(500, 100)?.rotulo).toBe("alta");
    expect(classificarDensidade(0, 0)).toBeNull();
  });
});

describe("lista de planos (Fase 17, Bloco G)", () => {
  it("kcal do plano e kcal/kg", () => {
    const kcal = kcalDoPlano([
      { quantidade_g: 50, porcao_referencia_g: 100, calorias_kcal: 300 },
      { quantidade_g: 1, porcao_referencia_g: 1, calorias_kcal: 200 },
    ]);
    expect(kcal).toBe(350);
    expect(kcalPorKg(kcal, 70)).toBe(5);
    expect(kcalPorKg(kcal, null)).toBeNull();
  });

  it("sem ordem manual no topo (mais novo antes), depois a ordem escolhida", () => {
    const planos = [
      { id: "a", ordem: 1, created_at: "2026-01-01" },
      { id: "b", ordem: null, created_at: "2026-02-01" },
      { id: "c", ordem: 0, created_at: "2026-03-01" },
      { id: "d", ordem: null, created_at: "2026-04-01" },
    ];
    expect(ordenarPlanos(planos).map((p) => p.id)).toEqual(["d", "b", "c", "a"]);
  });
});
