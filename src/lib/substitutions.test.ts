import { describe, expect, it } from "vitest";

import {
  arredondarQuantidade,
  distanciaMacros,
  ehIngrediente,
  gramasEquivalentes,
  macrosEm,
  mesmoEstado,
  pontuacaoSugestao,
} from "./substitutions";

// Pão francês (TACO): 300 kcal, 8 P, 58,6 C, 3,1 G por 100 g. Tapioca (goma): 240 kcal, 0 P, 60 C, 0 G.
const PAO = { porcao_referencia_g: 100, calorias_kcal: 300, proteinas_g: 8, carboidratos_g: 58.6, gorduras_g: 3.1 };
const TAPIOCA = { porcao_referencia_g: 100, calorias_kcal: 240, proteinas_g: 0, carboidratos_g: 60, gorduras_g: 0 };

describe("gramasEquivalentes", () => {
  const original = macrosEm(PAO, 50); // 150 kcal, 4 P, 29,3 C

  it("por calorias", () => {
    expect(gramasEquivalentes(original, TAPIOCA, "kcal")).toBeCloseTo(62.5, 5);
  });

  it("por carboidrato", () => {
    expect(gramasEquivalentes(original, TAPIOCA, "carboidratos")).toBeCloseTo(48.833, 2);
  });

  it("sem o nutriente no substituto, não equivale", () => {
    expect(gramasEquivalentes(original, TAPIOCA, "proteinas")).toBeNull();
  });
});

describe("arredondarQuantidade", () => {
  it("em medida caseira, de meia em meia", () => {
    expect(arredondarQuantidade(62.5, { gramas: 15 })).toEqual({ medidaQuantidade: 4, gramas: 60 });
    expect(arredondarQuantidade(20, { gramas: 15 })).toEqual({ medidaQuantidade: 1.5, gramas: 22.5 });
  });

  it("nunca menos que meia medida", () => {
    expect(arredondarQuantidade(3, { gramas: 50 })).toEqual({ medidaQuantidade: 0.5, gramas: 25 });
  });

  it("sem medida, gramas inteiros", () => {
    expect(arredondarQuantidade(62.4, null)).toEqual({ medidaQuantidade: null, gramas: 62 });
  });
});

describe("distanciaMacros", () => {
  it("soma as diferenças de proteína, carboidrato e gordura", () => {
    const a = { calorias: 100, proteinas: 4, carboidratos: 20, gorduras: 1, fibras: 0 };
    const b = { calorias: 100, proteinas: 1, carboidratos: 25, gorduras: 0, fibras: 3 };
    expect(distanciaMacros(a, b)).toBe(9);
  });
});

describe("mesmoEstado", () => {
  it("cru só troca por cru", () => {
    expect(mesmoEstado("Banana, prata, crua", "Maçã, Fuji, com casca, crua")).toBe(true);
    expect(mesmoEstado("Banana, prata, crua", "Banana, pacova, cozida")).toBe(false);
  });

  it("pronto e preparado trocam entre si, mas não por cru", () => {
    expect(mesmoEstado("Pão, trigo, francês", "Arroz, tipo 1, cozido")).toBe(true);
    expect(mesmoEstado("Arroz, tipo 1, cozido", "Arroz, tipo 1, cru")).toBe(false);
  });
});

describe("pontuacaoSugestao", () => {
  const original = {
    nome: "Arroz, tipo 1, cozido",
    gramas: 100,
    macros: { calorias: 128, proteinas: 2.5, carboidratos: 28.1, gorduras: 0.2, fibras: 1.6 },
  };

  it("peso muito diferente perde para um peso parecido com macros iguais", () => {
    const parecido = { nome: "Polenta, pré-cozida", gramas: 100, macros: original.macros };
    const leve = { nome: "Cereais, milho, flocos", gramas: 34, macros: original.macros };
    expect(pontuacaoSugestao(original, parecido)).toBeLessThan(pontuacaoSugestao(original, leve));
  });

  it("mesmo alimento-base tem uma pequena vantagem", () => {
    const outroArroz = { nome: "Arroz, tipo 2, cozido", gramas: 100, macros: original.macros };
    const outro = { nome: "Polenta, pré-cozida", gramas: 100, macros: original.macros };
    expect(pontuacaoSugestao(original, outroArroz)).toBeLessThan(pontuacaoSugestao(original, outro));
  });
});

describe("ehIngrediente", () => {
  it("farinha, amido, pó e misturas não são sugeridos como substituto", () => {
    expect(ehIngrediente("Farinha, de trigo")).toBe(true);
    expect(ehIngrediente("Creme de arroz, pó")).toBe(true);
    expect(ehIngrediente("Cereais, mistura para vitamina, trigo, cevada e aveia")).toBe(true);
    expect(ehIngrediente("Pão, trigo, francês")).toBe(false);
    expect(ehIngrediente("Polenta, pré-cozida")).toBe(false);
  });
});
