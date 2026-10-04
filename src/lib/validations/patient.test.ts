import { describe, expect, it } from "vitest";
import { optionalPositiveNumber } from "./patient";

describe("optionalPositiveNumber — número digitado no padrão brasileiro", () => {
  const schema = optionalPositiveNumber();

  it("aceita vírgula decimal", () => {
    expect(schema.parse("64,3")).toBe(64.3);
  });

  it("aceita ponto e número", () => {
    expect(schema.parse("80.5")).toBe(80.5);
    expect(schema.parse(175)).toBe(175);
  });

  it("vazio vira undefined", () => {
    expect(schema.parse("")).toBeUndefined();
  });

  it("texto inválido dá mensagem em português", () => {
    const r = schema.safeParse("abc");
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toBe("Informe um número válido");
  });
});
