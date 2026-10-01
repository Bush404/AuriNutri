import { describe, expect, it } from "vitest";

import { ATIVIDADES_COMPENDIUM, CATEGORIAS_COMPENDIUM } from "./atividades";

describe("2024 Adult Compendium (lista do MET)", () => {
  it("tem as 1.111 atividades do arquivo oficial, com códigos únicos", () => {
    expect(ATIVIDADES_COMPENDIUM).toHaveLength(1111);
    expect(new Set(ATIVIDADES_COMPENDIUM.map(([c]) => c)).size).toBe(1111);
  });

  it("toda atividade tem categoria, MET plausível e descrição em português", () => {
    for (const [codigo, cat, met, nome] of ATIVIDADES_COMPENDIUM) {
      expect(codigo).toMatch(/^\d{5}$/);
      expect(CATEGORIAS_COMPENDIUM[cat]).toBeDefined();
      expect(met).toBeGreaterThanOrEqual(1);
      expect(met).toBeLessThanOrEqual(23);
      expect(nome.length).toBeGreaterThan(2);
      // Nada de unidade americana sobrando na tradução.
      expect(nome).not.toMatch(/\bmph\b|\blbs?\b|yards?|inch/i);
    }
  });

  it("os METs batem com os que aparecem no WebDiet", () => {
    const met = (codigo: string) => ATIVIDADES_COMPENDIUM.find(([c]) => c === codigo)?.[2];
    expect(met("02000")).toBe(7.3); // Aeróbico, em geral
    expect(met("02001")).toBe(5.5); // step de 10 cm
    expect(met("02002")).toBe(7.3); // step de 15 a 20 cm
    expect(met("05044")).toBe(3); // abate de animais pequenos
    expect(met("05045")).toBe(6); // abate de animais grandes
  });
});
