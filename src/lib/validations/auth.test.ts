import { describe, expect, it } from "vitest";
import { registerSchema, resetPasswordSchema } from "./auth";

const validRegisterInput = {
  nome: "Ana Souza",
  email: "ana@example.com",
  password: "Xk7mQp2v",
  confirmPassword: "Xk7mQp2v",
};

describe("registerSchema — política de senha (Fase 11, Bloco A)", () => {
  it("aceita uma senha forte de 8+ caracteres que não é comum", () => {
    expect(registerSchema.safeParse(validRegisterInput).success).toBe(true);
  });

  it("rejeita senha com menos de 8 caracteres", () => {
    const result = registerSchema.safeParse({ ...validRegisterInput, password: "Ab1", confirmPassword: "Ab1" });
    expect(result.success).toBe(false);
  });

  it("rejeita senhas comuns conhecidas, mesmo com 8+ caracteres", () => {
    const result = registerSchema.safeParse({
      ...validRegisterInput,
      password: "12345678",
      confirmPassword: "12345678",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita senha comum independente de maiúsculas/minúsculas", () => {
    const result = registerSchema.safeParse({
      ...validRegisterInput,
      password: "Password1",
      confirmPassword: "Password1",
    });
    expect(result.success).toBe(false);
  });

  it("continua exigindo que as duas senhas coincidam", () => {
    const result = registerSchema.safeParse({ ...validRegisterInput, confirmPassword: "OutraSenha1" });
    expect(result.success).toBe(false);
  });
});

describe("resetPasswordSchema — mesma política de senha", () => {
  it("aceita senha forte", () => {
    expect(resetPasswordSchema.safeParse({ password: "Zk9wLm3q", confirmPassword: "Zk9wLm3q" }).success).toBe(true);
  });

  it("rejeita senha comum", () => {
    expect(resetPasswordSchema.safeParse({ password: "qwerty123", confirmPassword: "qwerty123" }).success).toBe(
      false
    );
  });
});
