import { describe, expect, it } from "vitest";
import { normalizePhoneToWhatsApp } from "./whatsapp";

describe("normalizePhoneToWhatsApp — Central de Envio (Fase 8, Bloco B)", () => {
  it("normaliza um celular formatado (11) 99999-9999 pro formato wa.me", () => {
    expect(normalizePhoneToWhatsApp("(11) 99999-9999")).toBe("5511999999999");
  });

  it("normaliza um número já digitado só com dígitos", () => {
    expect(normalizePhoneToWhatsApp("11999999999")).toBe("5511999999999");
  });

  it("aceita um fixo de 8 dígitos (sem o 9 na frente)", () => {
    expect(normalizePhoneToWhatsApp("(11) 9999-9999")).toBe("551199999999");
  });

  it("não duplica o DDI quando o número já vem com 55 na frente", () => {
    expect(normalizePhoneToWhatsApp("+55 11 99999-9999")).toBe("5511999999999");
    expect(normalizePhoneToWhatsApp("5511999999999")).toBe("5511999999999");
  });

  it("trata DDD 55 (Rio Grande do Sul) sem confundir com o DDI", () => {
    expect(normalizePhoneToWhatsApp("(55) 99999-9999")).toBe("5555999999999");
    expect(normalizePhoneToWhatsApp("+55 55 99999-9999")).toBe("5555999999999");
  });

  it("retorna null quando não há telefone", () => {
    expect(normalizePhoneToWhatsApp(null)).toBeNull();
    expect(normalizePhoneToWhatsApp(undefined)).toBeNull();
    expect(normalizePhoneToWhatsApp("")).toBeNull();
  });

  it("retorna null para um número claramente incompleto/inválido", () => {
    expect(normalizePhoneToWhatsApp("123")).toBeNull();
    expect(normalizePhoneToWhatsApp("11 1234")).toBeNull();
  });

  it("retorna null para um celular de 9 dígitos que não começa com 9", () => {
    expect(normalizePhoneToWhatsApp("11812345678")).toBeNull();
  });

  it("retorna null para DDD fora da faixa válida (01–10)", () => {
    expect(normalizePhoneToWhatsApp("0199999999")).toBeNull();
  });
});
