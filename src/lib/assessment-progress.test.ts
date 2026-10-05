import { describe, expect, it } from "vitest";

import { progressoDeTotal, progressoDobras, progressoLivre, progressoTexto } from "@/lib/assessment-progress";

describe("contadores de preenchimento", () => {
  it("dados básicos: só as medidas contam, espaço em branco não conta", () => {
    const p = progressoDeTotal({ peso_kg: "80", altura_cm: " ", altura_sentado_cm: "" }, ["peso_kg", "altura_cm", "altura_sentado_cm", "altura_joelho_cm"]);
    expect(p).toEqual({ preenchidos: 1, total: 4, rotulo: "1 de 4 preenchidos" });
  });

  it("seção livre: sem 'de quantos'", () => {
    expect(progressoLivre({}, ["a", "b"]).rotulo).toBe("Nenhum preenchido");
    expect(progressoLivre({ a: "1" }, ["a", "b"]).rotulo).toBe("1 preenchido");
    expect(progressoLivre({ a: "1", b: "2" }, ["a", "b"]).rotulo).toBe("2 preenchidos");
  });

  it("dobras: com protocolo conta só as do protocolo", () => {
    const valores = { dobra_triceps_mm: "10", dobra_biceps_mm: "5", dobra_abdominal_mm: "18" };
    const todas = ["dobra_triceps_mm", "dobra_biceps_mm", "dobra_abdominal_mm", "dobra_suprailiaca_mm"];
    expect(progressoDobras(valores, todas, ["dobra_triceps_mm", "dobra_suprailiaca_mm", "dobra_abdominal_mm"])).toEqual({
      preenchidos: 2,
      total: 3,
      rotulo: "2 de 3 do protocolo",
    });
    // Sem protocolo (ou sem a base masculino/feminino): conta todas.
    expect(progressoDobras(valores, todas, []).rotulo).toBe("3 preenchidos");
  });

  it("observações: preenchido ou vazio", () => {
    expect(progressoTexto("").rotulo).toBe("Vazio");
    expect(progressoTexto("Paciente em jejum").rotulo).toBe("Preenchido");
  });
});
