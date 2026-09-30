import { describe, expect, it } from "vitest";
import { calcularResultados, sexoDasFormulas, type MedidasAvaliacao } from "./anthropometry-results";

const vazio: MedidasAvaliacao = {
  peso_kg: 80,
  altura_cm: 175,
  circunferencia_cintura_cm: null,
  circunferencia_quadril_cm: null,
  circunferencia_braco_relaxado_dir_cm: null,
  circunferencia_braco_relaxado_esq_cm: null,
  circunferencia_panturrilha_dir_cm: null,
  circunferencia_panturrilha_esq_cm: null,
  diametro_punho_cm: null,
  diametro_femur_cm: null,
  lado_referencia: "direito",
  protocolo_dobras: null,
  formula_densidade: "brozek",
  dobra_triceps_mm: null,
  dobra_biceps_mm: null,
  dobra_abdominal_mm: null,
  dobra_subescapular_mm: null,
  dobra_axilar_media_mm: null,
  dobra_coxa_mm: null,
  dobra_peitoral_mm: null,
  dobra_suprailiaca_mm: null,
  dobra_panturrilha_mm: null,
  dobra_supraespinhal_mm: null,
};

describe("sexoDasFormulas", () => {
  it("usa o cadastro quando é masculino/feminino, mesmo com outra base gravada", () => {
    expect(sexoDasFormulas("feminino", "masculino")).toBe("feminino");
  });
  it("paciente 'outro' ou sem sexo: só a base escolhida — nunca assume", () => {
    expect(sexoDasFormulas("outro", null)).toBeNull();
    expect(sexoDasFormulas(null, undefined)).toBeNull();
    expect(sexoDasFormulas("outro", "feminino")).toBe("feminino");
  });
});

describe("calcularResultados", () => {
  it("só peso e altura: IMC e faixa ideal, o resto vazio", () => {
    const r = calcularResultados(vazio, { sexo: "masculino", idade: 30 });
    expect(r.imc).toBeCloseTo(26.122, 3);
    expect(r.classificacaoImc?.label).toBe("Sobrepeso");
    expect(r.rcq).toBeNull();
    expect(r.gordura).toBeNull();
    expect(r.massaMuscularKg).toBeNull();
  });

  it("protocolo escolhido sem base de sexo: avisa em vez de calcular", () => {
    const r = calcularResultados({ ...vazio, protocolo_dobras: "guedes" }, { sexo: null, idade: 30 });
    expect(r.gordura?.ok).toBe(false);
    expect(r.pesoResidualKg).toBeNull();
  });

  it("fracionamento completo: massa muscular = peso − (gordura + ósseo + residual)", () => {
    const r = calcularResultados(
      {
        ...vazio,
        protocolo_dobras: "guedes",
        dobra_triceps_mm: 10,
        dobra_suprailiaca_mm: 12,
        dobra_abdominal_mm: 18,
        diametro_punho_cm: 5.7,
        diametro_femur_cm: 9.7,
      },
      { sexo: "masculino", idade: 30 }
    );
    // Guedes homem, Σ 40 → 15,3412% (ver anthropometry.test.ts); 80 kg → 12,2730 kg de gordura.
    expect(r.massaGordaKg).toBeCloseTo(12.273, 2);
    expect(r.massaLivreGorduraKg).toBeCloseTo(67.727, 2);
    expect(r.pesoOsseoKg).toBeCloseTo(11.7903, 3);
    expect(r.pesoResidualKg).toBeCloseTo(19.28, 2);
    expect(r.massaMuscularKg).toBeCloseTo(80 - (12.273 + 11.7903 + 19.28), 1);
  });

  it("lado de referência vazio: usa o outro lado para a CMB", () => {
    const r = calcularResultados(
      { ...vazio, lado_referencia: "direito", circunferencia_braco_relaxado_esq_cm: 30, dobra_triceps_mm: 15 },
      { sexo: "masculino", idade: 30 }
    );
    expect(r.cmb).toBeCloseTo(25.2876, 3);
  });

  it("RCQ e RCEst a partir da cintura", () => {
    const r = calcularResultados(
      { ...vazio, circunferencia_cintura_cm: 90, circunferencia_quadril_cm: 100 },
      { sexo: "feminino", idade: 40 }
    );
    expect(r.rcq).toBeCloseTo(0.9, 6);
    expect(r.classificacaoRcq?.label).toBe("Risco aumentado");
    expect(r.rcest).toBeCloseTo(90 / 175, 6);
  });

  it("idoso: panturrilha classificada; adulto não", () => {
    const m = { ...vazio, circunferencia_panturrilha_dir_cm: 30 };
    expect(calcularResultados(m, { sexo: "feminino", idade: 70 }).panturrilhaIdoso?.label).toContain("perda");
    expect(calcularResultados(m, { sexo: "feminino", idade: 40 }).panturrilhaIdoso).toBeNull();
  });
});
