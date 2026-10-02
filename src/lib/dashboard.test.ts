import { describe, expect, it } from "vitest";
import {
  contarNoMes,
  inicioDaJanela,
  serieAcumulada,
  somaPorMes,
  ultimosMeses,
  variacaoPercentual,
} from "@/lib/dashboard";

describe("ultimosMeses", () => {
  it("volta n meses terminando no mês de hoje", () => {
    expect(ultimosMeses("2026-10-02", 3)).toEqual(["2026-08", "2026-09", "2026-10"]);
  });
  it("atravessa a virada do ano", () => {
    expect(ultimosMeses("2026-02-15", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
  it("início da janela é o dia 1 do mês mais antigo", () => {
    expect(inicioDaJanela(ultimosMeses("2026-02-15", 4))).toBe("2025-11-01");
  });
});

describe("contarNoMes", () => {
  it("conta só as datas do mês pedido", () => {
    expect(contarNoMes(["2026-10-01", "2026-10-31", "2026-09-30"], "2026-10")).toBe(2);
  });
});

describe("serieAcumulada", () => {
  it("reconstrói o total ao fim de cada mês a partir do total de hoje", () => {
    const meses = ["2026-08", "2026-09", "2026-10"];
    // 10 hoje; 2 criados em outubro, 3 em setembro → fim de ago = 5, fim de set = 8.
    const datas = ["2026-10-01", "2026-10-02", "2026-09-01", "2026-09-10", "2026-09-20"];
    expect(serieAcumulada(10, datas, meses)).toEqual([5, 8, 10]);
  });
});

describe("somaPorMes", () => {
  it("soma por mês sem erro de centavos e ignora pendentes (sem data)", () => {
    const linhas = [
      { data: "2026-10-01", valor: 0.1 },
      { data: "2026-10-05", valor: 0.2 },
      { data: "2026-09-05", valor: 100 },
      { data: null, valor: 999 },
    ];
    expect(somaPorMes(linhas, ["2026-09", "2026-10"])).toEqual([100, 0.3]);
  });
});

describe("variacaoPercentual", () => {
  it("arredonda para inteiro", () => {
    expect(variacaoPercentual(2840, 2535.71)).toBe(12);
    expect(variacaoPercentual(50, 100)).toBe(-50);
  });
  it("sem mês anterior não há porcentagem", () => {
    expect(variacaoPercentual(100, 0)).toBeNull();
  });
});
