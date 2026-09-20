import { describe, expect, it } from "vitest";
import { valorPorExtenso } from "./valor-extenso";

describe("valorPorExtenso", () => {
  describe("1 real — singular", () => {
    it("1,00 é 'um real', não 'um reais'", () => {
      expect(valorPorExtenso(1)).toBe("um real");
    });

    it("1,01 é 'um real e um centavo' — singular nos dois lados", () => {
      expect(valorPorExtenso(1.01)).toBe("um real e um centavo");
    });

    it("1,50 é 'um real e cinquenta centavos'", () => {
      expect(valorPorExtenso(1.5)).toBe("um real e cinquenta centavos");
    });
  });

  describe("centavos", () => {
    it("0,01 é 'um centavo' (singular, sem 'zero reais e')", () => {
      expect(valorPorExtenso(0.01)).toBe("um centavo");
    });

    it("0,05 é 'cinco centavos'", () => {
      expect(valorPorExtenso(0.05)).toBe("cinco centavos");
    });

    it("0,99 é 'noventa e nove centavos'", () => {
      expect(valorPorExtenso(0.99)).toBe("noventa e nove centavos");
    });

    it("10,50 combina reais e centavos com 'e'", () => {
      expect(valorPorExtenso(10.5)).toBe("dez reais e cinquenta centavos");
    });
  });

  describe("valores redondos — nunca menciona centavos", () => {
    it("100,00 é só 'cem reais'", () => {
      expect(valorPorExtenso(100)).toBe("cem reais");
    });

    it("50,00 é só 'cinquenta reais'", () => {
      expect(valorPorExtenso(50)).toBe("cinquenta reais");
    });

    it("0,00 é 'zero reais' (nunca deveria ocorrer num recibo, mas não quebra)", () => {
      expect(valorPorExtenso(0)).toBe("zero reais");
    });
  });

  describe("centenas", () => {
    it("100 é 'cem', não 'cento' (caso especial)", () => {
      expect(valorPorExtenso(100)).toBe("cem reais");
    });

    it("101 é 'cento e um'", () => {
      expect(valorPorExtenso(101)).toBe("cento e um reais");
    });

    it("150 é 'cento e cinquenta'", () => {
      expect(valorPorExtenso(150)).toBe("cento e cinquenta reais");
    });

    it("234 combina centena, dezena e unidade", () => {
      expect(valorPorExtenso(234)).toBe("duzentos e trinta e quatro reais");
    });

    it("uma centena exata (200, 300...) não repete 'e'", () => {
      expect(valorPorExtenso(200)).toBe("duzentos reais");
      expect(valorPorExtenso(900)).toBe("novecentos reais");
    });
  });

  describe("milhares", () => {
    it("1000 é só 'mil', sem 'um mil'", () => {
      expect(valorPorExtenso(1000)).toBe("mil reais");
    });

    it("1001 é 'mil e um'", () => {
      expect(valorPorExtenso(1001)).toBe("mil e um reais");
    });

    it("1100 é 'mil e cem' (último grupo é centena exata, usa 'e')", () => {
      expect(valorPorExtenso(1100)).toBe("mil e cem reais");
    });

    it("1234,56 combina milhar, centena e centavos", () => {
      expect(valorPorExtenso(1234.56)).toBe("mil, duzentos e trinta e quatro reais e cinquenta e seis centavos");
    });

    it("2000 usa plural na dezena de milhares", () => {
      expect(valorPorExtenso(2000)).toBe("dois mil reais");
    });

    it("dez mil", () => {
      expect(valorPorExtenso(10000)).toBe("dez mil reais");
    });

    it("cem mil", () => {
      expect(valorPorExtenso(100000)).toBe("cem mil reais");
    });
  });

  describe("milhão (caso extra, além do pedido)", () => {
    it("1.000.000,00 usa 'de reais'", () => {
      expect(valorPorExtenso(1_000_000)).toBe("um milhão de reais");
    });

    it("1.500.000,00 não usa 'de reais' (milhão não é o último grupo falado)", () => {
      expect(valorPorExtenso(1_500_000)).toBe("um milhão e quinhentos mil reais");
    });
  });
});
