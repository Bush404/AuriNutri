import { describe, expect, it } from "vitest";

import { avaliarAdequacao, cdrrSodio, faseDaVida, situacaoPorPercentual } from "./dri";
import { DRI, FASES_DA_VIDA } from "./dri-tabela";
import { somarMicrosDosItens } from "./nutrition";

// Valores conferidos à mão contra NASEM 2019, Appendix J (doi:10.17226/25353).
const valor = (chave: keyof typeof DRI, fase: (typeof FASES_DA_VIDA)[number]) =>
  DRI[chave][FASES_DA_VIDA.indexOf(fase)];

describe("tabela DRI (amostra conferida na fonte)", () => {
  it("adultos 19–30 anos", () => {
    expect(valor("ferro_mg", "m19")).toEqual([8, "RDA", 45]);
    expect(valor("ferro_mg", "f19")).toEqual([18, "RDA", 45]);
    expect(valor("calcio_mg", "f19")).toEqual([1000, "RDA", 2500]);
    expect(valor("vitamina_c_mg", "m19")).toEqual([90, "RDA", 2000]);
    expect(valor("potassio_mg", "m19")).toEqual([3400, "AI", null]);
    expect(valor("fibras_g", "f19")).toEqual([25, "AI", null]);
  });

  it("unidades convertidas: cobre µg→mg e UL do fósforo g→mg", () => {
    expect(valor("cobre_mg", "m19")).toEqual([0.9, "RDA", 10]);
    expect(valor("fosforo_mg", "m19")).toEqual([700, "RDA", 4000]);
  });

  it("idosos, crianças, gestante e lactante", () => {
    expect(valor("calcio_mg", "m70")).toEqual([1200, "RDA", 2000]);
    expect(valor("piridoxina_mg", "f51")).toEqual([1.5, "RDA", 100]);
    expect(valor("zinco_mg", "c1")).toEqual([3, "RDA", 7]);
    expect(valor("ferro_mg", "g19")).toEqual([27, "RDA", 45]);
    expect(valor("rae_mcg", "l19")).toEqual([1300, "RDA", null]);
    expect(valor("retinol_mcg", "l19")).toEqual([null, null, 3000]);
  });
});

describe("faseDaVida", () => {
  it("por sexo e idade", () => {
    expect(faseDaVida("feminino", 25)).toBe("f19");
    expect(faseDaVida("masculino", 50)).toBe("m31");
    expect(faseDaVida("masculino", 51)).toBe("m51");
    expect(faseDaVida("feminino", 75)).toBe("f70");
    expect(faseDaVida("outro", 3)).toBe("c1");
    expect(faseDaVida(null, 30)).toBeNull();
    expect(faseDaVida("feminino", 0)).toBeNull();
  });

  it("gestante e lactante só para o sexo feminino", () => {
    expect(faseDaVida("feminino", 32, "gestante")).toBe("g31");
    expect(faseDaVida("feminino", 17, "lactante")).toBe("l14");
    expect(faseDaVida("masculino", 32, "gestante")).toBe("m31");
  });
});

describe("adequação", () => {
  it("faixa de ±20%", () => {
    expect(situacaoPorPercentual(79)).toBe("abaixo");
    expect(situacaoPorPercentual(80)).toBe("adequado");
    expect(situacaoPorPercentual(120)).toBe("adequado");
    expect(situacaoPorPercentual(121)).toBe("acima");
  });

  it("sódio usa a CDRR como limite", () => {
    expect(cdrrSodio("f19")).toBe(2300);
    expect(cdrrSodio("c4")).toBe(1500);
  });

  it("soma os itens, não conta sem dado como zero e traço como zero conhecido", () => {
    const itens = [
      { quantidade_g: 200, porcao_referencia_g: 100, micros_copiados: true, ferro_mg: 2, sodio_mg: 1000 },
      {
        quantidade_g: 50,
        porcao_referencia_g: 100,
        micros_copiados: true,
        ferro_mg: null,
        valores_especiais: { ferro_mg: "traco" as const },
        sodio_mg: 3000,
      },
      { quantidade_g: 100, porcao_referencia_g: 100, micros_copiados: false },
    ];
    const micros = somarMicrosDosItens(itens);
    expect(micros.ferro_mg).toEqual({ valor: 4, parcial: true, ingredientesSemDado: 1 });
    expect(micros.sodio_mg.valor).toBe(3500);

    const linhas = avaliarAdequacao(micros, 20, itens.length, "f19");
    const ferro = linhas.find((l) => l.chave === "ferro_mg")!;
    expect(ferro.percentual).toBeCloseTo((4 / 18) * 100, 5);
    expect(ferro.situacao).toBe("abaixo");
    expect(ferro.itensSemDado).toBe(1);
    const sodio = linhas.find((l) => l.chave === "sodio_mg")!;
    expect(sodio.acimaDoLimite).toBe(true);
    const fibras = linhas.find((l) => l.chave === "fibras_g")!;
    expect(fibras.percentual).toBe(80);
    expect(fibras.situacao).toBe("adequado");
    // Nenhum item com o dado: sem total, nunca 0.
    const vitC = linhas.find((l) => l.chave === "vitamina_c_mg")!;
    expect(vitC.consumo).toBeNull();
    expect(vitC.situacao).toBe("sem_dado");
  });
});
