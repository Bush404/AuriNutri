import { describe, expect, it } from "vitest";

import { formatarPeso, montarListaDeCompras } from "./shopping-list";

describe("formatarPeso", () => {
  it("gramas e quilos", () => {
    expect(formatarPeso(350)).toBe("350 g");
    expect(formatarPeso(1400)).toBe("1,4 kg");
    expect(formatarPeso(999.6)).toBe("1 kg");
  });
});

describe("montarListaDeCompras", () => {
  it("soma o mesmo alimento, multiplica pelos dias e agrupa por grupo", () => {
    const lista = montarListaDeCompras(
      [
        {
          chave: "pao",
          nome: "Pão, trigo, francês",
          grupo: "Cereais e derivados",
          gramas: 50,
          medida: { nome: "unidade", gramas: 50, quantidade: 1 },
        },
        {
          chave: "pao",
          nome: "Pão, trigo, francês",
          grupo: "Cereais e derivados",
          gramas: 50,
          medida: { nome: "unidade", gramas: 50, quantidade: 1 },
        },
        { chave: "arroz", nome: "Arroz, tipo 1, cozido", grupo: "Cereais e derivados", gramas: 100 },
        { chave: "banana", nome: "Banana, prata, crua", grupo: "Frutas e derivados", gramas: 86 },
        { chave: "x", nome: "Shake da casa", grupo: null, gramas: 30 },
      ],
      7,
    );
    expect(lista.map((g) => g.grupo)).toEqual(["Cereais e derivados", "Frutas e derivados", "Outros"]);
    expect(lista[0].itens).toEqual([
      { nome: "Arroz, tipo 1, cozido", gramas: 700, texto: "700 g" },
      { nome: "Pão, trigo, francês", gramas: 700, texto: "14 × unidade (700 g)" },
    ]);
    expect(lista[1].itens[0].texto).toBe("602 g");
  });

  it("medidas diferentes do mesmo alimento viram peso", () => {
    const [grupo] = montarListaDeCompras(
      [
        {
          chave: "a",
          nome: "Arroz",
          grupo: "Cereais",
          gramas: 25,
          medida: { nome: "colher de sopa cheia", gramas: 25, quantidade: 1 },
        },
        {
          chave: "a",
          nome: "Arroz",
          grupo: "Cereais",
          gramas: 90,
          medida: { nome: "escumadeira", gramas: 90, quantidade: 1 },
        },
      ],
      7,
    );
    expect(grupo.itens[0].texto).toBe("805 g");
  });
});
