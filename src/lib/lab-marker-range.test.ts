import { describe, expect, it } from "vitest";

import { escalaDaFaixa, foraDaFaixa, textoDaFaixa } from "@/lib/lab-marker-range";

describe("faixa de referência do marcador", () => {
  it("fora da faixa: mesma regra da coluna gerada do banco", () => {
    expect(foraDaFaixa(180, null, 190)).toBe(false);
    expect(foraDaFaixa(200, null, 190)).toBe(true);
    expect(foraDaFaixa(30, 40, null)).toBe(true);
    expect(foraDaFaixa(70, 70, 99)).toBe(false);
    expect(foraDaFaixa(5, null, null)).toBe(false);
  });

  it("texto da faixa", () => {
    expect(textoDaFaixa(null, 190, "mg/dL")).toBe("até 190 mg/dL");
    expect(textoDaFaixa(70, 99, "mg/dL")).toBe("entre 70 e 99 mg/dL");
    expect(textoDaFaixa(40, null, "mg/dL")).toBe("a partir de 40 mg/dL");
    expect(textoDaFaixa(0.5, 1.2, "")).toBe("entre 0,5 e 1,2");
    expect(textoDaFaixa(null, null, "mg/dL")).toBeNull();
  });

  it("'até 190' começa no 0, como a referência: 180 fica perto do fim", () => {
    const e = escalaDaFaixa(180, null, 190)!;
    expect(e.faixaInicio).toBe(0);
    expect(e.faixaFim).toBe(1);
    expect(e.valor).toBeCloseTo(180 / 190, 6);
    expect(e.marcas.map((m) => m.rotulo)).toEqual([0, 190]);
  });

  it("faixa 'entre' fica no meio; valor fora estica a escala e continua visível", () => {
    const e = escalaDaFaixa(85, 70, 99)!;
    expect(e.faixaInicio).toBeGreaterThan(0);
    expect(e.faixaFim).toBeLessThan(1);
    const alto = escalaDaFaixa(300, 70, 99)!;
    expect(alto.valor).toBeLessThan(1);
    expect(alto.valor).toBeGreaterThan(alto.faixaFim);
  });

  it("sem faixa não há barra", () => {
    expect(escalaDaFaixa(5, null, null)).toBeNull();
  });
});
