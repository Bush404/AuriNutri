import { describe, expect, it } from "vitest";
import { foodSchema } from "./food";

const validInput = {
  nome: "Banana prata",
  categoria: "Frutas",
  marca: "",
  porcao_referencia_g: "100",
  calorias_kcal: "89",
  proteinas_g: "1.1",
  carboidratos_g: "22.8",
  gorduras_g: "0.3",
  fibras_g: "2.6",
};

describe("foodSchema — campos obrigatórios", () => {
  it("aceita um payload válido vindo de inputs de formulário (strings)", () => {
    const result = foodSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("rejeita quando falta o nome", () => {
    const result = foodSchema.safeParse({ ...validInput, nome: "" });
    expect(result.success).toBe(false);
  });

  it("rejeita macronutriente central ausente", () => {
    const result = foodSchema.safeParse({ ...validInput, calorias_kcal: undefined });
    expect(result.success).toBe(false);
  });

  it("rejeita macronutriente central negativo", () => {
    const result = foodSchema.safeParse({ ...validInput, proteinas_g: "-1" });
    expect(result.success).toBe(false);
  });

  it("rejeita porção de referência zero ou negativa", () => {
    expect(foodSchema.safeParse({ ...validInput, porcao_referencia_g: "0" }).success).toBe(false);
    expect(foodSchema.safeParse({ ...validInput, porcao_referencia_g: "-10" }).success).toBe(false);
  });
});

describe("foodSchema — fibras_g (numérico opcional) com campo vazio", () => {
  it("mantém undefined quando o campo é totalmente omitido", () => {
    const { fibras_g, ...rest } = validInput;
    const result = foodSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fibras_g).toBeUndefined();
    }
  });

  it("NÃO deveria virar 0 quando o campo é enviado vazio (\"\")", () => {
    const result = foodSchema.safeParse({ ...validInput, fibras_g: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fibras_g).toBeUndefined();
    }
  });

  it("aceita um valor de fibras válido", () => {
    const result = foodSchema.safeParse({ ...validInput, fibras_g: "3.5" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fibras_g).toBe(3.5);
    }
  });

  it("rejeita fibras negativas", () => {
    const result = foodSchema.safeParse({ ...validInput, fibras_g: "-1" });
    expect(result.success).toBe(false);
  });
});
