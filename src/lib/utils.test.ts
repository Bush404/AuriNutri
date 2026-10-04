import { describe, expect, it } from "vitest";
import { formatTelefone } from "./utils";

describe("formatTelefone — exibição no perfil do paciente (Fase 19)", () => {
  it("formata um celular digitado só com dígitos", () => {
    expect(formatTelefone("11998997906")).toBe("(11) 99899-7906");
  });

  it("formata um fixo de 8 dígitos", () => {
    expect(formatTelefone("1134567890")).toBe("(11) 3456-7890");
  });

  it("tira o DDI 55 da frente", () => {
    expect(formatTelefone("+55 11 99899-7906")).toBe("(11) 99899-7906");
  });

  it("devolve como foi digitado quando não reconhece o formato", () => {
    expect(formatTelefone("+1 555 0100")).toBe("+1 555 0100");
  });
});
