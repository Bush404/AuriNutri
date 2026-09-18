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

describe("foodSchema — micronutrientes (Fase 6, Bloco 0)", () => {
  it("todos ficam undefined quando omitidos — nunca 0", () => {
    const result = foodSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ferro_mg).toBeUndefined();
      expect(result.data.sodio_mg).toBeUndefined();
      expect(result.data.vitamina_c_mg).toBeUndefined();
      expect(result.data.gordura_saturada_g).toBeUndefined();
    }
  });

  it("campo vazio (\"\") vira undefined, não 0", () => {
    const result = foodSchema.safeParse({ ...validInput, ferro_mg: "", calcio_mg: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ferro_mg).toBeUndefined();
      expect(result.data.calcio_mg).toBeUndefined();
    }
  });

  it("aceita um valor de micronutriente válido", () => {
    const result = foodSchema.safeParse({ ...validInput, ferro_mg: "1.234" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ferro_mg).toBe(1.234);
    }
  });

  it("rejeita micronutriente negativo", () => {
    const result = foodSchema.safeParse({ ...validInput, potassio_mg: "-5" });
    expect(result.success).toBe(false);
  });
});
