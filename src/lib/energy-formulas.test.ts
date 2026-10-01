import { describe, expect, it } from "vitest";

import { ajusteVenta, calcularFormula, calcularGETFinal, formulasParaIdade, type DadosEnergia, type FormulaEnergia } from "./energy-formulas";

const adulto = (d: Partial<DadosEnergia>): DadosEnergia => ({
  sexo: "masculino",
  idadeAnos: 30,
  idadeMeses: 360,
  pesoKg: 70,
  alturaCm: 175,
  mlgKg: null,
  ...d,
});

function kcal(f: FormulaEnergia, d: DadosEnergia) {
  const r = calcularFormula(f, d);
  if (!r.ok) throw new Error(r.motivo);
  return r.kcal;
}

describe("EER 2023 — exemplos do folheto oficial (National Academies, jan/2023)", () => {
  it("mulher de 22 anos, 165 cm, 63 kg, pouco ativa → 2.275 kcal/dia", () => {
    const d = adulto({ sexo: "feminino", idadeAnos: 22, idadeMeses: 264, pesoKg: 63, alturaCm: 165, nivelEER: "pouco_ativo" });
    expect(kcal("eer_2023", d)).toBeCloseTo(2275.37, 2);
  });

  it("menino de 2 anos, 98 cm, 15,5 kg (sem nível de atividade, + 20 de crescimento) → 1.281 kcal/dia", () => {
    const d = adulto({ idadeAnos: 2, idadeMeses: 24, pesoKg: 15.5, alturaCm: 98 });
    expect(kcal("eer_2023", d)).toBeCloseTo(1281.34, 2);
  });

  it("a partir de 3 anos exige o nível de atividade", () => {
    const r = calcularFormula("eer_2023", adulto({ idadeAnos: 5, idadeMeses: 60, pesoKg: 18, alturaCm: 110 }));
    expect(r.ok).toBe(false);
  });
});

describe("EER/IOM 2005 — tabela oficial do Food and Nutrition Board (30 anos, 1,65 m)", () => {
  // Valores da tabela "EER for Men and Women 30 Years of Age" (IOM, 2002/2005). A tabela usa o peso
  // exato do IMC 18,5 ou 24,99 (mostra 50,4 e 68,0 kg arredondados).
  const pesoDoImc = (imc: number) => imc * 1.65 ** 2;
  const casos: [DadosEnergia["sexo"], number, Record<string, number>][] = [
    ["masculino", pesoDoImc(18.5), { inativo: 2068, pouco_ativo: 2254, ativo: 2490, muito_ativo: 2880 }],
    ["masculino", pesoDoImc(24.99), { inativo: 2349, pouco_ativo: 2566, ativo: 2842, muito_ativo: 3296 }],
    ["feminino", pesoDoImc(18.5), { inativo: 1816, pouco_ativo: 2016, ativo: 2267, muito_ativo: 2567 }],
    ["feminino", pesoDoImc(24.99), { inativo: 1982, pouco_ativo: 2202, ativo: 2477, muito_ativo: 2807 }],
  ];
  for (const [sexo, peso, esperado] of casos) {
    for (const [nivel, valor] of Object.entries(esperado)) {
      it(`${sexo}, ${peso.toFixed(1)} kg, ${nivel} → ${valor}`, () => {
        const d = adulto({ sexo, pesoKg: peso, alturaCm: 165, nivelEER: nivel as DadosEnergia["nivelEER"] });
        expect(Math.abs(kcal("eer_iom_2005", d) - valor)).toBeLessThanOrEqual(1);
      });
    }
  }

  it("bebê de 6 meses, 7,8 kg: (89 × peso − 100) + 56", () => {
    expect(kcal("eer_iom_2005", adulto({ idadeAnos: 0, idadeMeses: 6, pesoKg: 7.8, alturaCm: 67 }))).toBeCloseTo(650.2, 2);
  });

  it("menino de 6 anos, 1,15 m, 20 kg, ativo (PA 1,26, + 20 de crescimento)", () => {
    const d = adulto({ idadeAnos: 6, idadeMeses: 72, pesoKg: 20, alturaCm: 115, nivelEER: "ativo" });
    expect(kcal("eer_iom_2005", d)).toBeCloseTo(1718.39, 2);
  });
});

describe("FAO/OMS 2004", () => {
  it("exemplo do próprio documento da FAO: homem de 20–25 anos, 70 kg → ~1.745 kcal", () => {
    expect(Math.abs(kcal("fao_oms_2004", adulto({ idadeAnos: 22, pesoKg: 70 })) - 1745)).toBeLessThanOrEqual(2);
  });
});

describe("Henry/Oxford 2005 — EAR do relatório SACN 2011 (Tabela 40: BMR × 1,63, em MJ)", () => {
  const casos: [string, Partial<DadosEnergia>, number][] = [
    ["homem 19–24 anos, 178 cm, 71,5 kg", { idadeAnos: 22, pesoKg: 71.5, alturaCm: 178 }, 11.6],
    ["homem 45–54 anos, 175 cm, 68,8 kg", { idadeAnos: 50, pesoKg: 68.8, alturaCm: 175 }, 10.8],
    ["homem 65–74 anos, 173 cm, 67,0 kg", { idadeAnos: 70, pesoKg: 67, alturaCm: 173 }, 9.8],
    ["mulher 19–24 anos, 163 cm, 59,9 kg", { sexo: "feminino", idadeAnos: 22, pesoKg: 59.9, alturaCm: 163 }, 9.1],
    ["mulher 35–44 anos, 163 cm, 59,9 kg", { sexo: "feminino", idadeAnos: 40, pesoKg: 59.9, alturaCm: 163 }, 8.8],
  ];
  for (const [nome, d, ear] of casos) {
    it(`${nome} → EAR ${ear} MJ/dia`, () => {
      const mj = (kcal("henry_oxford_2005", adulto(d)) * 4.184) / 1000;
      expect(Number((mj * 1.63).toFixed(1))).toBe(ear);
    });
  }
});

describe("fórmulas de TMB conferidas à mão", () => {
  it("Harris-Benedict 1984 (Roza & Shizgal) — homem 70 kg, 175 cm, 30 anos", () => {
    expect(kcal("harris_benedict_1984", adulto({}))).toBeCloseTo(1695.667, 3);
  });

  it("Harris-Benedict 1984 — mulher 60 kg, 165 cm, 25 anos", () => {
    const d = adulto({ sexo: "feminino", idadeAnos: 25, pesoKg: 60, alturaCm: 165 });
    expect(kcal("harris_benedict_1984", d)).toBeCloseTo(1405.333, 3);
  });

  it("Harris-Benedict 1919 e Mifflin-St Jeor batem com o cálculo já existente (src/lib/energy.ts)", () => {
    expect(kcal("harris_benedict_1919", adulto({}))).toBeCloseTo(1702.03, 2);
    expect(kcal("mifflin_st_jeor", adulto({}))).toBeCloseTo(1648.75, 2);
  });

  it("Henry & Rees 1991 — homem 25 anos, 70 kg: (0,056 × 70 + 2,800) MJ", () => {
    expect(kcal("henry_rees_1991", adulto({ idadeAnos: 25 }))).toBeCloseTo((6.72 * 1000) / 4.184, 2);
  });

  it("Schofield 1985 (peso e altura) — menina 8 anos, 25 kg, 125 cm", () => {
    const d = adulto({ sexo: "feminino", idadeAnos: 8, idadeMeses: 96, pesoKg: 25, alturaCm: 125 });
    expect(kcal("schofield_1985", d)).toBeCloseTo(997.7, 2);
  });

  it("fórmulas por massa livre de gordura (60 kg)", () => {
    const d = adulto({ mlgKg: 60 });
    expect(kcal("katch_mcardle", d)).toBeCloseTo(1666, 6);
    expect(kcal("cunningham", d)).toBeCloseTo(1820, 6);
    expect(kcal("mifflin_st_jeor_mlg", d)).toBeCloseTo(1595, 6);
    expect(kcal("tinsley_mlg", d)).toBeCloseTo(1838, 6);
  });

  it("Tinsley por peso — 80 kg", () => {
    expect(kcal("tinsley_peso", adulto({ pesoKg: 80 }))).toBeCloseTo(1994, 6);
  });
});

describe("quando a fórmula não se aplica", () => {
  it("fórmula de adulto em criança", () => {
    expect(calcularFormula("mifflin_st_jeor", adulto({ idadeAnos: 10, idadeMeses: 120 })).ok).toBe(false);
  });

  it("Schofield infantil em adulto", () => {
    expect(calcularFormula("schofield_1985", adulto({})).ok).toBe(false);
  });

  it("Henry & Rees não tem faixa a partir de 60 anos", () => {
    expect(calcularFormula("henry_rees_1991", adulto({ idadeAnos: 65 })).ok).toBe(false);
    expect(formulasParaIdade(65)).not.toContain("henry_rees_1991");
  });

  it("fórmula por massa magra sem massa magra", () => {
    const r = calcularFormula("cunningham", adulto({}));
    expect(r.ok).toBe(false);
  });

  it("crianças não veem as fórmulas só de adultos", () => {
    const lista = formulasParaIdade(8);
    expect(lista).toContain("schofield_1985");
    expect(lista).toContain("eer_2023");
    expect(lista).not.toContain("harris_benedict_1984");
  });
});

describe("GET final e ajustes", () => {
  it("TMB × atividade × injúria + adicionais", () => {
    expect(calcularGETFinal({ ok: true, tipo: "tmb", kcal: 1500 }, { atividade: 1.55, injuria: 1.2 }, 300)).toEqual({
      tmb: 1500,
      get: 3090,
    });
  });

  it("nas EER (já é GET) os fatores não entram", () => {
    expect(calcularGETFinal({ ok: true, tipo: "get", kcal: 2275 }, { atividade: 1.55, injuria: 1.2 }, 0)).toEqual({
      tmb: null,
      get: 2275,
    });
  });

  it("VENTA: perder 3 kg em 90 dias = −256,7 kcal/dia (7.700 kcal por kg)", () => {
    expect(ajusteVenta(-3, 90)).toBeCloseTo(-256.67, 2);
    expect(ajusteVenta(2, 0)).toBe(0);
  });
});
