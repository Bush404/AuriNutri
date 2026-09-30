import { describe, expect, it } from "vitest";
import {
  calcularCmb,
  calcularImc,
  calcularPercentualGordura,
  calcularPesoOsseo,
  calcularPesoResidual,
  classificarCmb,
  classificarImc,
  classificarPercentualGordura,
  classificarRcest,
  classificarRcq,
  densidadeParaPercentualGordura,
  estimarAlturaPeloJoelho,
  estimarPesoAcamado,
  faixaPesoIdeal,
  idadeNaData,
  type CalcularGorduraInput,
} from "./anthropometry";

/**
 * Valores de referência calculados à parte, direto da equação publicada com os
 * números do caso (não pelo código testado) — padrão de energy.test.ts.
 */

const base: Omit<CalcularGorduraInput, "protocolo" | "sexo" | "dobras"> = {
  formulaDensidade: "brozek",
  idade: 30,
  pesoKg: 70,
  alturaCm: 170,
};

function gordura(input: Partial<CalcularGorduraInput> & Pick<CalcularGorduraInput, "protocolo" | "sexo" | "dobras">) {
  const r = calcularPercentualGordura({ ...base, ...input });
  if (!r.ok) throw new Error(r.motivo);
  return r;
}

describe("densidade → % de gordura", () => {
  it("Brozek: (4,57/D − 4,142) × 100", () => {
    expect(densidadeParaPercentualGordura(1.05, "brozek")).toBeCloseTo((4.57 / 1.05 - 4.142) * 100, 6);
  });
  it("Siri: (4,95/D − 4,50) × 100", () => {
    expect(densidadeParaPercentualGordura(1.05, "siri")).toBeCloseTo((4.95 / 1.05 - 4.5) * 100, 6);
  });
});

describe("protocolos de dobras cutâneas", () => {
  it("Pollock 3 homem — peitoral 10 + abdominal 20 + coxa 15, 30 anos", () => {
    const r = gordura({ protocolo: "pollock_3", sexo: "masculino", dobras: { peitoral: 10, abdominal: 20, coxa: 15 } });
    expect(r.somaDobras).toBe(45);
    expect(r.densidade).toBeCloseTo(1.067697, 6);
    expect(r.percentualGordura).toBeCloseTo(13.8243, 3);
  });

  it("Pollock 3 homem com Siri", () => {
    const r = gordura({
      protocolo: "pollock_3",
      sexo: "masculino",
      formulaDensidade: "siri",
      dobras: { peitoral: 10, abdominal: 20, coxa: 15 },
    });
    expect(r.percentualGordura).toBeCloseTo(13.6149, 3);
    expect(r.fonte).toBe("Jackson & Pollock, 1978 + Siri, 1961");
  });

  it("Pollock 3 mulher — tríceps 20 + suprailíaca 15 + coxa 25, 25 anos", () => {
    const r = gordura({ protocolo: "pollock_3", sexo: "feminino", idade: 25, dobras: { triceps: 20, suprailiaca: 15, coxa: 25 } });
    expect(r.densidade).toBeCloseTo(1.044718, 6);
    expect(r.percentualGordura).toBeCloseTo(23.2386, 3);
  });

  it("Pollock 7 homem — soma 100, 40 anos", () => {
    const r = gordura({
      protocolo: "pollock_7",
      sexo: "masculino",
      idade: 40,
      dobras: { peitoral: 10, axilar_media: 15, triceps: 12, subescapular: 18, abdominal: 20, suprailiaca: 10, coxa: 15 },
    });
    expect(r.somaDobras).toBe(100);
    expect(r.densidade).toBeCloseTo(1.062471, 6);
    expect(r.percentualGordura).toBeCloseTo(15.9295, 3);
  });

  it("Pollock 7 mulher — soma 120, 35 anos", () => {
    const r = gordura({
      protocolo: "pollock_7",
      sexo: "feminino",
      idade: 35,
      dobras: { peitoral: 10, axilar_media: 15, triceps: 20, subescapular: 15, abdominal: 25, suprailiaca: 15, coxa: 20 },
    });
    expect(r.densidade).toBeCloseTo(1.044209, 6);
    expect(r.percentualGordura).toBeCloseTo(23.4518, 3);
  });

  it("Petroski homem — subescapular + tríceps + suprailíaca + panturrilha = 50, 30 anos", () => {
    const r = gordura({
      protocolo: "petroski",
      sexo: "masculino",
      dobras: { subescapular: 15, triceps: 12, suprailiaca: 13, panturrilha: 10 },
    });
    expect(r.densidade).toBeCloseTo(1.05944, 5);
    expect(r.percentualGordura).toBeCloseTo(17.16, 2);
  });

  it("Petroski mulher — usa peso e altura, com Siri; 60 kg, 165 cm, 30 anos, soma 80", () => {
    const r = gordura({
      protocolo: "petroski",
      sexo: "feminino",
      formulaDensidade: "siri",
      pesoKg: 60,
      alturaCm: 165,
      dobras: { axilar_media: 15, suprailiaca: 20, coxa: 25, panturrilha: 20 },
    });
    expect(r.densidade).toBeCloseTo(1.042159, 6);
    expect(r.percentualGordura).toBeCloseTo(24.9755, 3);
  });

  it("Guedes homem — log10(tríceps + suprailíaca + abdominal = 40), não usa idade", () => {
    const r = gordura({
      protocolo: "guedes",
      sexo: "masculino",
      idade: null,
      dobras: { triceps: 10, suprailiaca: 12, abdominal: 18 },
    });
    expect(r.densidade).toBeCloseTo(1.063926, 6);
    expect(r.percentualGordura).toBeCloseTo(15.3412, 3);
  });

  it("Guedes mulher — log10(subescapular + suprailíaca + coxa = 60)", () => {
    const r = gordura({ protocolo: "guedes", sexo: "feminino", dobras: { subescapular: 15, suprailiaca: 20, coxa: 25 } });
    expect(r.densidade).toBeCloseTo(1.040909, 6);
    expect(r.percentualGordura).toBeCloseTo(24.8393, 3);
  });

  it("Durnin homem 35 anos — faixa 30–39 (c 1,1422, m 0,0544), soma 40", () => {
    const r = gordura({
      protocolo: "durnin",
      sexo: "masculino",
      idade: 35,
      dobras: { biceps: 5, triceps: 10, subescapular: 15, suprailiaca: 10 },
    });
    expect(r.densidade).toBeCloseTo(1.055048, 6);
    expect(r.percentualGordura).toBeCloseTo(18.9557, 3);
  });

  it("Durnin mulher 55 anos — faixa 50+ (c 1,1339, m 0,0645), soma 70", () => {
    const r = gordura({
      protocolo: "durnin",
      sexo: "feminino",
      idade: 55,
      dobras: { biceps: 10, triceps: 25, subescapular: 20, suprailiaca: 15 },
    });
    expect(r.densidade).toBeCloseTo(1.014891, 6);
    expect(r.percentualGordura).toBeCloseTo(36.0946, 3);
  });

  it("Durnin abaixo de 17 anos não calcula", () => {
    const r = calcularPercentualGordura({
      ...base,
      protocolo: "durnin",
      sexo: "masculino",
      idade: 16,
      dobras: { biceps: 5, triceps: 10, subescapular: 15, suprailiaca: 10 },
    });
    expect(r.ok).toBe(false);
  });

  it("Faulkner — % direto: Σ4 × 0,153 + 5,783, sem densidade", () => {
    const r = gordura({
      protocolo: "faulkner",
      sexo: "feminino",
      dobras: { triceps: 15, subescapular: 15, suprailiaca: 12, abdominal: 18 },
    });
    expect(r.densidade).toBeNull();
    expect(r.percentualGordura).toBeCloseTo(14.963, 3);
  });

  it("dobra faltando: não calcula e diz qual falta", () => {
    const r = calcularPercentualGordura({ ...base, protocolo: "pollock_3", sexo: "masculino", dobras: { peitoral: 10, coxa: 15 } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toContain("abdominal");
  });

  it("protocolo que usa idade, sem data de nascimento: não calcula", () => {
    const r = calcularPercentualGordura({
      ...base,
      idade: null,
      protocolo: "pollock_3",
      sexo: "masculino",
      dobras: { peitoral: 10, abdominal: 20, coxa: 15 },
    });
    expect(r.ok).toBe(false);
  });
});

describe("IMC", () => {
  it("calcula peso / altura²", () => {
    expect(calcularImc(70, 175)).toBeCloseTo(22.857, 3);
  });

  it("adulto usa OMS", () => {
    expect(classificarImc(24.9, 40).label).toBe("Eutrofia");
    expect(classificarImc(25, 40).label).toBe("Sobrepeso");
    expect(classificarImc(36.9, 40).label).toBe("Obesidade grau II");
  });

  it("60 anos ou mais usa Lipschitz — IMC 36,9 é 'Sobrepeso' (conferido no WebDiet, paciente de 63 anos)", () => {
    const c = classificarImc(36.9, 63);
    expect(c.label).toBe("Sobrepeso");
    expect(c.fonte).toBe("Lipschitz, 1994");
    expect(classificarImc(21.9, 60).label).toBe("Baixo peso");
    expect(classificarImc(27, 60).label).toBe("Eutrofia");
  });

  it("faixa de peso ideal bate com o WebDiet: 1,84 m adulto = 62,6–84,3 kg; 1,55 m idoso = 52,9–64,9 kg", () => {
    const adulto = faixaPesoIdeal(184, 24);
    expect(adulto.minKg).toBeCloseTo(62.6, 1);
    expect(adulto.maxKg).toBeCloseTo(84.3, 1);
    const idoso = faixaPesoIdeal(155, 63);
    expect(idoso.minKg).toBeCloseTo(52.9, 1);
    expect(idoso.maxKg).toBeCloseTo(64.9, 1);
  });
});

describe("indicadores de risco", () => {
  it("RCQ: corte 0,90 homem / 0,85 mulher", () => {
    expect(classificarRcq(0.89, "masculino").label).toBe("Sem risco aumentado");
    expect(classificarRcq(0.9, "masculino").label).toBe("Risco aumentado");
    expect(classificarRcq(0.85, "feminino").label).toBe("Risco aumentado");
  });

  it("RCEst: 0,5 e 0,6", () => {
    expect(classificarRcest(0.49).label).toBe("Sem risco aumentado");
    expect(classificarRcest(0.5).label).toBe("Risco aumentado");
    expect(classificarRcest(0.6).label).toBe("Risco muito aumentado");
  });

  it("% de gordura (Lohman)", () => {
    expect(classificarPercentualGordura(15.5, "masculino").label).toBe("Média");
    expect(classificarPercentualGordura(25, "masculino").label).toBe("Risco (obesidade)");
    expect(classificarPercentualGordura(20, "feminino").label).toBe("Abaixo da média");
    expect(classificarPercentualGordura(8, "feminino").label).toBe("Risco (desnutrição)");
  });
});

describe("CMB", () => {
  it("CMB = CB − π × DCT/10; homem 30 anos: P50 = 27,9 (Frisancho 1981)", () => {
    const cmb = calcularCmb(30, 15);
    expect(cmb).toBeCloseTo(25.2876, 3);
    const c = classificarCmb(cmb, "masculino", 30)!;
    expect(c.adequacaoPercentual).toBeCloseTo(90.6366, 3);
    expect(c.adequacao.label).toBe("Eutrofia");
    expect(c.percentil.label).toContain("P10 a P90");
  });

  it("abaixo de 18 anos não classifica (tabela infantil fica para o Bloco B)", () => {
    expect(classificarCmb(20, "feminino", 17)).toBeNull();
  });

  it("acima de 74 anos usa a última faixa e avisa", () => {
    expect(classificarCmb(22, "feminino", 80)?.acimaDaTabela).toBe(true);
  });
});

describe("fracionamento", () => {
  it("peso ósseo (Rocha): 1,75 m, punho 5,7 cm, fêmur 9,7 cm", () => {
    expect(calcularPesoOsseo(175, 5.7, 9.7)).toBeCloseTo(11.7903, 3);
  });

  it("peso residual (Würch) — confere com o WebDiet: 88,7 kg mulher = 18,5 kg", () => {
    expect(calcularPesoResidual(88.7, "feminino")).toBeCloseTo(18.54, 2);
    expect(calcularPesoResidual(100, "masculino")).toBeCloseTo(24.1, 6);
  });
});

describe("estimativas (Chumlea)", () => {
  it("altura pelo joelho — homem 70 anos, AJ 50: 162,39 cm; mulher 70 anos, AJ 48: 155,92 cm", () => {
    expect(estimarAlturaPeloJoelho(50, 70, "masculino")).toBeCloseTo(162.39, 2);
    expect(estimarAlturaPeloJoelho(48, 70, "feminino")).toBeCloseTo(155.92, 2);
  });

  it("peso de acamado", () => {
    expect(
      estimarPesoAcamado({
        sexo: "masculino",
        alturaJoelhoCm: 50,
        circunferenciaBracoCm: 28,
        circunferenciaPanturrilhaCm: 33,
        dobraSubescapularMm: 15,
      })
    ).toBeCloseTo(62.64, 2);
    expect(
      estimarPesoAcamado({
        sexo: "feminino",
        alturaJoelhoCm: 48,
        circunferenciaBracoCm: 27,
        circunferenciaPanturrilhaCm: 32,
        dobraSubescapularMm: 14,
      })
    ).toBeCloseTo(52.11, 2);
  });
});

describe("idadeNaData", () => {
  it("conta a idade na data da avaliação, não hoje", () => {
    expect(idadeNaData("1960-05-10", "2020-05-09")).toBe(59);
    expect(idadeNaData("1960-05-10", "2020-05-10")).toBe(60);
    expect(idadeNaData(null, "2020-05-10")).toBeNull();
  });
});
