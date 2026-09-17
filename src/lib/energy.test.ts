import { describe, expect, it } from "vitest";
import { calcularGET, calcularTMB, FATORES_ATIVIDADE } from "./energy";

describe("calcularTMB", () => {
  it("Mifflin-St Jeor (padrão) — homem, 70kg, 175cm, 30 anos", () => {
    expect(calcularTMB({ pesoKg: 70, alturaCm: 175, idade: 30, sexo: "masculino" })).toBeCloseTo(1648.75, 2);
  });

  it("Mifflin-St Jeor (padrão) — mulher, 60kg, 165cm, 25 anos", () => {
    expect(calcularTMB({ pesoKg: 60, alturaCm: 165, idade: 25, sexo: "feminino" })).toBeCloseTo(1345.25, 2);
  });

  it("Mifflin-St Jeor é a fórmula padrão quando nenhuma é informada", () => {
    const explicit = calcularTMB({ pesoKg: 70, alturaCm: 175, idade: 30, sexo: "masculino", formula: "mifflin_st_jeor" });
    const implicit = calcularTMB({ pesoKg: 70, alturaCm: 175, idade: 30, sexo: "masculino" });
    expect(implicit).toBe(explicit);
  });

  it("Harris-Benedict — homem, 70kg, 175cm, 30 anos", () => {
    expect(
      calcularTMB({ pesoKg: 70, alturaCm: 175, idade: 30, sexo: "masculino", formula: "harris_benedict" })
    ).toBeCloseTo(1702.03, 2);
  });

  it("Harris-Benedict — mulher, 60kg, 165cm, 25 anos", () => {
    expect(
      calcularTMB({ pesoKg: 60, alturaCm: 165, idade: 25, sexo: "feminino", formula: "harris_benedict" })
    ).toBeCloseTo(1417.23, 2);
  });

  it("as duas fórmulas dão resultados diferentes para os mesmos dados", () => {
    const mifflin = calcularTMB({ pesoKg: 70, alturaCm: 175, idade: 30, sexo: "masculino", formula: "mifflin_st_jeor" });
    const harris = calcularTMB({ pesoKg: 70, alturaCm: 175, idade: 30, sexo: "masculino", formula: "harris_benedict" });
    expect(mifflin).not.toBeCloseTo(harris, 2);
  });
});

describe("calcularGET", () => {
  it("aplica o fator sedentário (1.2)", () => {
    expect(calcularGET(1648.75, "sedentario")).toBeCloseTo(1648.75 * 1.2, 2);
  });

  it("aplica o fator moderado (1.55)", () => {
    expect(calcularGET(1648.75, "moderado")).toBeCloseTo(2555.5625, 2);
  });

  it("aplica o fator extremamente ativo (1.9)", () => {
    expect(calcularGET(1648.75, "muito_intenso")).toBeCloseTo(1648.75 * 1.9, 2);
  });

  it("todos os fatores de atividade são maiores que 1 (o GET nunca é menor que a TMB)", () => {
    for (const fator of Object.values(FATORES_ATIVIDADE)) {
      expect(fator).toBeGreaterThan(1);
    }
  });
});
