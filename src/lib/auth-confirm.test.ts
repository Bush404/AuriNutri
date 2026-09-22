import { describe, expect, it } from "vitest";

import { CONFIRMACOES, tipoDeConfirmacao } from "./auth-confirm";

describe("tipoDeConfirmacao", () => {
  it("reconhece redefinição de senha e confirmação de cadastro", () => {
    expect(tipoDeConfirmacao("recovery")).toBe("recovery");
    expect(tipoDeConfirmacao("email")).toBe("email");
    expect(tipoDeConfirmacao("signup")).toBe("email");
  });

  it("recusa qualquer outro tipo", () => {
    for (const valor of [undefined, null, "", "magiclink", "invite", "email_change", "RECOVERY"]) {
      expect(tipoDeConfirmacao(valor)).toBeNull();
    }
  });

  it("destinos são sempre caminhos internos fixos", () => {
    expect(CONFIRMACOES.recovery.destino).toBe("/redefinir-senha");
    expect(CONFIRMACOES.email.destino).toBe("/dashboard");
  });
});
