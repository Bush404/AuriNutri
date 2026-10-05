import { describe, expect, it } from "vitest";

import { classificarImc, classificarPercentualGordura, classificarRcq } from "@/lib/anthropometry";
import {
  avaliacaoAtualEAnterior,
  diferenca,
  faixaProporcional,
  ordenarParaLista,
  faixasDoClassificador,
  filtrarPorPeriodo,
  inicioDoPeriodo,
  marcasAlinhadas,
  marcasDoEixo,
  posicaoNaEscala,
} from "@/lib/anthropometry-overview";
import type { LinhaAntropometria } from "@/lib/evolution";

function linha(data: string, extra: Partial<LinhaAntropometria> = {}): LinhaAntropometria {
  return {
    chave: `a:${data}`,
    id: data,
    data,
    origem: "avaliacao",
    rotulo: "Avaliação de adulto",
    tipo: "adulto",
    pesoKg: null,
    alturaCm: null,
    imc: null,
    percentualGordura: null,
    massaLivreKg: null,
    ...extra,
  };
}

describe("avaliacaoAtualEAnterior", () => {
  it("pula avaliação em branco e relatório externo", () => {
    const linhas = [
      linha("2026-10-03"), // aberta e deixada em branco
      linha("2026-10-02", { origem: "anexo", pesoKg: 79 }),
      linha("2026-10-01", { pesoKg: 80 }),
      linha("2026-09-01", { pesoKg: 82.5 }),
    ];
    const { atual, anterior } = avaliacaoAtualEAnterior(linhas);
    expect(atual?.data).toBe("2026-10-01");
    expect(anterior?.data).toBe("2026-09-01");
  });

  it("avaliação só com altura não vira a atual (print de 05/10/2026)", () => {
    const linhas = [
      linha("2026-10-01", { alturaCm: 175 }),
      linha("2026-10-01", { pesoKg: 80, alturaCm: 175 }),
      linha("2026-09-02", { pesoKg: 85 }),
    ];
    const { atual, anterior } = avaliacaoAtualEAnterior(linhas);
    expect(atual?.pesoKg).toBe(80);
    expect(anterior?.pesoKg).toBe(85);
    // Nenhuma com peso: vale a mais recente com alguma medida.
    expect(avaliacaoAtualEAnterior([linha("2026-10-01"), linha("2026-09-01", { alturaCm: 170 })]).atual?.alturaCm).toBe(170);
  });

  it("uma avaliação só: sem anterior; nenhuma: tudo nulo", () => {
    expect(avaliacaoAtualEAnterior([linha("2026-10-01", { pesoKg: 80 })]).anterior).toBeNull();
    expect(avaliacaoAtualEAnterior([])).toEqual({ atual: null, anterior: null });
  });
});

describe("diferenca", () => {
  it("compara nas casas exibidas", () => {
    expect(diferenca(80, 82.5, 1)).toEqual({ sentido: "desceu", valor: 2.5 });
    expect(diferenca(68.2, 66.4, 1)).toEqual({ sentido: "subiu", valor: 1.8 });
    // 26,14 e 26,11 aparecem os dois como 26,1: sem "↓ 0,0".
    expect(diferenca(26.14, 26.11, 1)).toEqual({ sentido: "igual", valor: 0 });
  });

  it("nula quando falta um dos lados", () => {
    expect(diferenca(80, null, 1)).toBeNull();
    expect(diferenca(null, 80, 1)).toBeNull();
  });
});

describe("período do gráfico", () => {
  it("conta meses para trás a partir de hoje", () => {
    expect(inicioDoPeriodo("2026-10-05", 3)).toBe("2026-07-05");
    expect(inicioDoPeriodo("2026-10-05", 12)).toBe("2025-10-05");
    // 31/03 − 1 mês não pula para março: fica no último dia de fevereiro.
    expect(inicioDoPeriodo("2026-03-31", 1)).toBe("2026-02-28");
  });

  it("filtra inclusive o primeiro dia; Tudo não filtra", () => {
    const itens = [{ data: "2026-10-01" }, { data: "2026-04-05" }, { data: "2026-04-04" }, { data: "2024-01-01" }];
    expect(filtrarPorPeriodo(itens, "6m", "2026-10-05").map((i) => i.data)).toEqual(["2026-10-01", "2026-04-05"]);
    expect(filtrarPorPeriodo(itens, "tudo", "2026-10-05")).toHaveLength(4);
  });
});

describe("faixasDoClassificador", () => {
  it("lê as faixas do IMC de adulto da própria classificação da OMS", () => {
    const faixas = faixasDoClassificador((v) => classificarImc(v, 30), 14, 42, 0.1);
    expect(faixas.map((f) => [f.label, f.de])).toEqual([
      ["Baixo peso", 14],
      ["Eutrofia", 18.5],
      ["Sobrepeso", 25],
      ["Obesidade grau I", 30],
      ["Obesidade grau II", 35],
      ["Obesidade grau III", 40],
    ]);
    expect(faixas[faixas.length - 1].ate).toBe(42);
  });

  it("idoso usa Lipschitz; RCQ e % de gordura mudam com o sexo", () => {
    expect(faixasDoClassificador((v) => classificarImc(v, 70), 16, 34, 0.1).map((f) => f.de)).toEqual([16, 22, 27.1]);
    expect(faixasDoClassificador((v) => classificarRcq(v, "masculino"), 0.6, 1.2, 0.01).map((f) => f.de)).toEqual([0.6, 0.9]);
    expect(faixasDoClassificador((v) => classificarRcq(v, "feminino"), 0.6, 1.2, 0.01).map((f) => f.de)).toEqual([0.6, 0.85]);
    expect(
      faixasDoClassificador((v) => classificarPercentualGordura(v, "masculino"), 2, 40, 0.1).map((f) => f.label),
    ).toEqual(["Risco (desnutrição)", "Abaixo da média", "Média", "Acima da média", "Risco (obesidade)"]);
  });
});

describe("posicaoNaEscala e marcasDoEixo", () => {
  it("posição limitada às pontas", () => {
    expect(posicaoNaEscala(28, 14, 42)).toBe(0.5);
    expect(posicaoNaEscala(50, 14, 42)).toBe(1);
    expect(posicaoNaEscala(10, 14, 42)).toBe(0);
  });

  it("marcas redondas cobrindo o intervalo", () => {
    expect(marcasDoEixo(64.6, 91)).toEqual([60, 70, 80, 90, 100]);
    expect(marcasDoEixo(14.8, 23.4)).toEqual([10, 15, 20, 25]);
    // Um valor só: abre uma folga em volta.
    const unico = marcasDoEixo(80, 80);
    expect(unico[0]).toBeLessThan(80);
    expect(unico[unico.length - 1]).toBeGreaterThan(80);
  });

  it("segundo eixo com o mesmo número de marcas, cobrindo os valores", () => {
    const m = marcasAlinhadas(14.8, 23.4, 5);
    expect(m).toHaveLength(5);
    expect(m[0]).toBeLessThanOrEqual(14.8);
    expect(m[4]).toBeGreaterThanOrEqual(23.4);
    expect(marcasAlinhadas(14.8, 23.4, 5)).toEqual([10, 15, 20, 25, 30]);
    expect(marcasAlinhadas(18, 26, 5)).toEqual([18, 20, 22, 24, 26]);
  });
});

describe("faixaProporcional e ordenarParaLista", () => {
  it("dá à % de gordura a mesma folga relativa do eixo de kg", () => {
    // Eixo de kg 60–90 (±20% em volta de 75): % entre 19,7 e 21,9 ganha ±20% em volta de 20,8.
    const [ini, fim] = faixaProporcional(19.7, 21.9, 60, 90);
    expect(ini).toBeCloseTo(20.8 - 4.16, 6);
    expect(fim).toBeCloseTo(20.8 + 4.16, 6);
    // Variação já maior que a folga: fica a variação.
    expect(faixaProporcional(10, 30, 79, 81)).toEqual([10, 30]);
  });

  it("avaliação em branco vai para depois da que tem medidas na mesma data", () => {
    const linhas = [linha("2026-10-01"), linha("2026-10-01", { pesoKg: 80 }), linha("2026-09-02", { pesoKg: 85 })];
    expect(ordenarParaLista(linhas).map((l) => l.pesoKg)).toEqual([80, null, 85]);
  });
});
