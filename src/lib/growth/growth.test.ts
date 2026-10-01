import { describe, expect, it } from "vitest";
import {
  calcularResultadosCrianca,
  classificarCrescimento,
  classificarGorduraInfantil,
  escoreZ,
  formatarIdadeMeses,
  gorduraInfantil,
  idadeEmMeses,
  lmsEm,
  percentil,
  valorNoZ,
  type IndicadorCrescimento,
} from "./growth";

/**
 * Pontos de controle: valores de −2, +2 e +3 DP publicados pela própria OMS nas
 * planilhas de onde saíram os coeficientes (colunas SD2neg/SD2/SD3). As tabelas
 * de 0–5 anos vêm arredondadas a 0,1; as de 5–19, a 0,001.
 */
const CONTROLE: [IndicadorCrescimento, "masculino" | "feminino", number, number, number, number, number][] = [
  // indicador, sexo, x, SD2neg, SD2, SD3, casas
  ["peso_idade", "masculino", 12, 7.7, 12.0, 13.3, 1],
  ["peso_idade", "feminino", 36, 10.8, 18.1, 20.9, 1],
  ["peso_idade", "masculino", 96, 19.472, 34.727, 41.521, 3],
  ["altura_idade", "feminino", 6, 61.2, 70.3, 72.5, 1],
  ["altura_idade", "masculino", 48, 94.9, 111.7, 115.9, 1],
  ["altura_idade", "feminino", 150, 140.196, 167.812, 174.716, 3],
  ["imc_idade", "masculino", 18, 13.9, 19.0, 20.8, 1],
  ["imc_idade", "feminino", 180, 15.871, 28.224, 35.538, 3],
  ["imc_idade", "masculino", 120, 13.735, 21.4, 26.073, 3],
  ["peso_comprimento", "masculino", 75, 8.1, 11.3, 12.3, 1],
  ["peso_estatura", "feminino", 100, 12.8, 18.4, 20.3, 1],
];

describe("coeficientes da OMS conferem com as tabelas oficiais", () => {
  it.each(CONTROLE)("%s %s em %s: −2, +2 e +3 DP", (indicador, sexo, x, sd2neg, sd2, sd3, casas) => {
    const lms = lmsEm(indicador, sexo, x)!;
    const tol = casas === 1 ? 0.05 + 1e-9 : 0.0005 + 1e-9;
    expect(Math.abs(valorNoZ(lms, -2) - sd2neg)).toBeLessThanOrEqual(tol);
    expect(Math.abs(valorNoZ(lms, 2) - sd2)).toBeLessThanOrEqual(tol);
    expect(Math.abs(valorNoZ(lms, 3) - sd3)).toBeLessThanOrEqual(tol);
  });

  it("na mediana (M) o escore-z é 0 e o percentil é 50", () => {
    // Menino de 12 meses: M = 9,6479 kg.
    const z = escoreZ("peso_idade", "masculino", 12, 9.6479)!;
    expect(z).toBeCloseTo(0, 4);
    expect(percentil(z)).toBeCloseTo(50, 3);
  });

  it("na linha de +2 DP (5–19, 3 casas) o escore-z é 2", () => {
    expect(escoreZ("imc_idade", "feminino", 180, 28.224)!).toBeCloseTo(2, 3);
  });
});

describe("escore-z", () => {
  it("interpola entre meses", () => {
    const a = lmsEm("peso_idade", "masculino", 12)!;
    const b = lmsEm("peso_idade", "masculino", 13)!;
    const meio = lmsEm("peso_idade", "masculino", 12.5)!;
    expect(meio[2]).toBeCloseTo((a[2] + b[2]) / 2, 10);
  });

  it("z restrito acima de +3 (peso/IMC): 3 + distância em unidades de (SD3 − SD2)", () => {
    const lms = lmsEm("imc_idade", "masculino", 120)!;
    const sd3 = valorNoZ(lms, 3);
    const sd2 = valorNoZ(lms, 2);
    const valor = sd3 + (sd3 - sd2) * 0.5;
    expect(escoreZ("imc_idade", "masculino", 120, valor)!).toBeCloseTo(3.5, 6);
  });

  it("fora da tabela: nulo", () => {
    expect(escoreZ("peso_idade", "feminino", 130, 30)).toBeNull();
    expect(escoreZ("peso_comprimento", "masculino", 40, 3)).toBeNull();
  });

  it("percentil: z = −2 → 2,28; z = +1 → 84,13", () => {
    expect(percentil(-2)).toBeCloseTo(2.275, 2);
    expect(percentil(1)).toBeCloseTo(84.134, 2);
  });
});

describe("classificação SISVAN", () => {
  it("IMC/idade muda os nomes aos 5 anos (60 meses)", () => {
    expect(classificarCrescimento("imc_idade", 1.5, 48).label).toBe("Risco de sobrepeso");
    expect(classificarCrescimento("imc_idade", 1.5, 60).label).toBe("Sobrepeso");
    expect(classificarCrescimento("imc_idade", 2.5, 48).label).toBe("Sobrepeso");
    expect(classificarCrescimento("imc_idade", 2.5, 100).label).toBe("Obesidade");
    expect(classificarCrescimento("imc_idade", 3.5, 100).label).toBe("Obesidade grave");
  });

  it("limites: −2 é adequado; +1 é eutrofia; +2 é peso adequado", () => {
    expect(classificarCrescimento("altura_idade", -2, 30).label).toBe("Estatura adequada para a idade");
    expect(classificarCrescimento("peso_estatura", 1, 30).label).toBe("Eutrofia");
    expect(classificarCrescimento("peso_idade", 2, 30).label).toBe("Peso adequado para a idade");
  });
});

describe("calcularResultadosCrianca", () => {
  it("criança de 3 anos: peso/idade, altura/idade, IMC/idade e peso/estatura", () => {
    const r = calcularResultadosCrianca({ sexo: "feminino", meses: 36, pesoKg: 13.85, alturaCm: 95.1 });
    expect(r.indicadores.map((i) => i.indicador)).toEqual(["peso_idade", "altura_idade", "imc_idade", "peso_estatura"]);
  });

  it("bebê de 8 meses usa peso/comprimento", () => {
    const r = calcularResultadosCrianca({ sexo: "masculino", meses: 8, pesoKg: 8.6, alturaCm: 70.6 });
    expect(r.indicadores.map((i) => i.indicador)).toContain("peso_comprimento");
  });

  it("12 anos: sem peso/idade (OMS só até 10) e sem peso/estatura", () => {
    const r = calcularResultadosCrianca({ sexo: "masculino", meses: 149, pesoKg: 40, alturaCm: 150 });
    expect(r.indicadores.map((i) => i.indicador)).toEqual(["altura_idade", "imc_idade"]);
    expect(r.foraDaFaixa[0].indicador).toBe("peso_idade");
  });
});

describe("idade", () => {
  it("meses com fração e texto", () => {
    expect(idadeEmMeses("2014-05-01", "2026-09-30")).toBeCloseTo(149.0, 0);
    expect(formatarIdadeMeses(149.9)).toBe("12 anos e 5 meses");
    expect(formatarIdadeMeses(8)).toBe("8 meses");
    expect(formatarIdadeMeses(24)).toBe("2 anos");
  });
});

describe("% de gordura infantil (Slaughter)", () => {
  it("tríceps + panturrilha — menino: 0,735 × Σ + 1,0; menina: 0,610 × Σ + 5,1", () => {
    const m = gorduraInfantil({ sexo: "masculino", idadeAnos: 12, tricepsMm: 10, subescapularMm: 8, panturrilhaMm: 12 });
    expect(m?.ok && m.percentualGordura).toBeCloseTo(0.735 * 22 + 1.0, 6);
    const f = gorduraInfantil({ sexo: "feminino", idadeAnos: 12, tricepsMm: 14, subescapularMm: null, panturrilhaMm: 16 });
    expect(f?.ok && f.percentualGordura).toBeCloseTo(0.61 * 30 + 5.1, 6);
  });

  it("tríceps + subescapular — menina ≤35: 1,33Σ − 0,013Σ² − 2,5; >35: 0,546Σ + 9,7", () => {
    const a = gorduraInfantil({ sexo: "feminino", idadeAnos: 10, tricepsMm: 12, subescapularMm: 10, panturrilhaMm: null });
    expect(a?.ok && a.percentualGordura).toBeCloseTo(1.33 * 22 - 0.013 * 22 * 22 - 2.5, 6);
    const b = gorduraInfantil({ sexo: "feminino", idadeAnos: 10, tricepsMm: 20, subescapularMm: 20, panturrilhaMm: null });
    expect(b?.ok && b.percentualGordura).toBeCloseTo(0.546 * 40 + 9.7, 6);
  });

  it("menino com tríceps + subescapular ≤ 35 mm: pede a panturrilha", () => {
    const r = gorduraInfantil({ sexo: "masculino", idadeAnos: 10, tricepsMm: 10, subescapularMm: 8, panturrilhaMm: null });
    expect(r?.ok).toBe(false);
  });

  it("fora de 8–18 anos: não calcula", () => {
    expect(gorduraInfantil({ sexo: "feminino", idadeAnos: 6, tricepsMm: 10, subescapularMm: 8, panturrilhaMm: 9 })?.ok).toBe(false);
  });

  it("classificação Lohman 1987", () => {
    expect(classificarGorduraInfantil(15, "masculino").label).toBe("Adequada");
    expect(classificarGorduraInfantil(15, "feminino").label).toBe("Baixa");
    expect(classificarGorduraInfantil(37, "feminino").label).toBe("Excessivamente alta");
  });
});
