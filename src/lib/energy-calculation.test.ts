import { describe, expect, it } from "vitest";

import { adicionaisDoCalculo, kcalAtividade, resultadoDoCalculo, type EntradasCalculo } from "./energy-calculation";

const base: EntradasCalculo = {
  data_calculo: "2026-10-01",
  peso_kg: 70,
  altura_cm: 175,
  massa_livre_gordura_kg: null,
  sexo_referencia: null,
  formula: "mifflin_st_jeor",
  nivel_eer: null,
  kcal_por_kg: null,
  valor_manual_kcal: null,
  fator_atividade: 1,
  fator_injuria: 1,
  atividades_met: [],
  venta_kg: null,
  venta_dias: null,
  adicional_gestante_kcal: null,
};
// Faz 30 anos em 01/10/2026.
const homem = { sexo: "masculino" as const, data_nascimento: "1996-10-01" };

describe("resultadoDoCalculo", () => {
  it("Mifflin, sem fatores: GET = TMB", () => {
    const r = resultadoDoCalculo(base, homem);
    expect(r.motivo).toBeNull();
    expect(r.tmb).toBeCloseTo(1648.75, 2);
    expect(r.get).toBeCloseTo(1648.75, 2);
  });

  it("a idade é a da data do cálculo, não a de hoje", () => {
    // Um dia antes do aniversário: 29 anos → TMB 5 kcal maior.
    const r = resultadoDoCalculo({ ...base, data_calculo: "2026-09-30" }, homem);
    expect(r.tmb).toBeCloseTo(1653.75, 2);
  });

  it("fatores e ajustes: TMB × 1,55 × 1,2 + MET + VENTA + gestante", () => {
    const r = resultadoDoCalculo(
      {
        ...base,
        fator_atividade: 1.55,
        fator_injuria: 1.2,
        atividades_met: [{ codigo: "", nome: "Musculação", met: 5, minutos: 60 }],
        venta_kg: -3,
        venta_dias: 90,
        adicional_gestante_kcal: 100,
      },
      homem
    );
    // 1648,75 × 1,55 × 1,2 = 3066,675; + 350 (5 MET × 70 kg × 1 h); − 256,667; + 100
    expect(r.get).toBeCloseTo(3066.675 + 350 - 256.6667 + 100, 2);
  });

  it("paciente 'outro' sem base escolhida: não assume o sexo", () => {
    const r = resultadoDoCalculo(base, { sexo: "outro", data_nascimento: "1996-10-01" });
    expect(r.get).toBeNull();
    expect(r.motivo).toMatch(/base/);
    const comBase = resultadoDoCalculo({ ...base, sexo_referencia: "feminino" }, { sexo: "outro", data_nascimento: "1996-10-01" });
    expect(comBase.tmb).toBeCloseTo(1648.75 - 166, 2);
  });

  it("sem data de nascimento: pede o cadastro", () => {
    expect(resultadoDoCalculo(base, { sexo: "masculino", data_nascimento: null }).motivo).toMatch(/nascimento/);
  });

  it("sem fórmula escolhida", () => {
    expect(resultadoDoCalculo({ ...base, formula: null }, homem).motivo).toBe("Escolha a fórmula.");
  });
});

describe("adicionais", () => {
  it("MET × peso × horas por dia", () => {
    expect(kcalAtividade({ met: 7.3, minutos: 30 }, 80)).toBeCloseTo(292, 6);
    expect(kcalAtividade({ met: 7.3, minutos: 30 }, null)).toBe(0);
  });

  it("sem ajustes, tudo zero", () => {
    expect(adicionaisDoCalculo(base)).toEqual({ met: 0, venta: 0, gestante: 0, total: 0 });
  });
});
