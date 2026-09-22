import { describe, expect, it } from "vitest";
import type { ErrorEvent, TransactionEvent } from "@sentry/core";

import { scrubBreadcrumb, scrubErrorEvent, scrubSpan, scrubText, scrubTransactionEvent, scrubUrl } from "./sentry-scrub";

const PACIENTE_ID = "3f2b8c1a-9d4e-4f6a-b7c8-1e2d3f4a5b6c";

describe("scrubUrl", () => {
  it("mascara id de paciente no caminho", () => {
    expect(scrubUrl(`https://app.aurinutri.com/pacientes/${PACIENTE_ID}/editar`)).toBe(
      "https://app.aurinutri.com/pacientes/:id/editar"
    );
  });

  it("remove query string com busca por nome e filtros do Supabase", () => {
    expect(scrubUrl("/pacientes?busca=Maria+Silva")).toBe("/pacientes?[filtrado]");
    expect(scrubUrl(`https://x.supabase.co/rest/v1/patients?select=*&nome=ilike.*Maria*&id=eq.${PACIENTE_ID}`)).toBe(
      "https://x.supabase.co/rest/v1/patients?[filtrado]"
    );
  });

  it("remove token de auth no fragmento e token de link compartilhado", () => {
    expect(scrubUrl("/redefinir-senha#access_token=abc&type=recovery")).toBe("/redefinir-senha#[filtrado]");
    expect(scrubUrl("/compartilhado/Xk9_aB12cD34eF56")).toBe("/compartilhado/:token");
  });

  it("não mexe em interrogação de frase comum", () => {
    expect(scrubUrl("Tem certeza? Sim")).toBe("Tem certeza? Sim");
  });
});

describe("scrubText", () => {
  it("mascara e-mail, CPF, telefone, valor e JWT", () => {
    const texto =
      "Falha para maria.silva@gmail.com CPF 123.456.789-09 tel (11) 91234-5678 valor R$ 1.250,00, " +
      "token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc_DEF-123";
    expect(scrubText(texto)).toBe(
      "Falha para [email] CPF [cpf] tel [telefone] valor R$ [valor], token [token]"
    );
  });

  it("mantém mensagens técnicas legíveis", () => {
    expect(scrubText("TypeError: Cannot read properties of undefined (reading 'map')")).toBe(
      "TypeError: Cannot read properties of undefined (reading 'map')"
    );
  });
});

describe("scrubBreadcrumb", () => {
  it("descarta saída do console inteira", () => {
    expect(scrubBreadcrumb({ category: "console", message: "paciente { nome: 'Maria' }" })).toBeNull();
  });

  it("tira atributos (texto da tela) do seletor de clique", () => {
    const b = scrubBreadcrumb({ category: "ui.click", message: 'button.btn[aria-label="Excluir Maria Silva"]' });
    expect(b?.message).toBe("button.btn");
  });

  it("mantém só método/status/url em fetch, com a url filtrada", () => {
    const b = scrubBreadcrumb({
      category: "fetch",
      type: "http",
      data: {
        method: "GET",
        status_code: 200,
        url: `https://x.supabase.co/rest/v1/patients?id=eq.${PACIENTE_ID}`,
        request_body_size: 10,
        response: { nome: "Maria" },
      },
    });
    expect(b?.data).toEqual({ method: "GET", status_code: 200, url: "https://x.supabase.co/rest/v1/patients?[filtrado]" });
  });
});

describe("scrubErrorEvent", () => {
  it("só deixa sair o que está na lista permitida", () => {
    const event = {
      type: undefined,
      message: "Erro com maria@x.com",
      exception: {
        values: [
          {
            type: "Error",
            value: `Paciente ${PACIENTE_ID} com e-mail maria@x.com não encontrado`,
            stacktrace: { frames: [{ filename: "app/pacientes/page.tsx", lineno: 10, vars: { nome: "Maria Silva" } }] },
          },
        ],
      },
      user: { id: "u1", email: "nutri@x.com", ip_address: "189.1.2.3" },
      request: {
        method: "POST",
        url: `http://localhost/pacientes/${PACIENTE_ID}?aba=anamnese`,
        data: { queixa: "dor abdominal" },
        cookies: { "sb-access-token": "segredo" },
        query_string: "aba=anamnese",
        headers: { "User-Agent": "Mozilla/5.0", Cookie: "segredo", Referer: `/pacientes/${PACIENTE_ID}` },
      },
      extra: { paciente: { nome: "Maria Silva" } },
      contexts: { os: { name: "Windows" }, state: { plano: { nome: "Plano da Maria" } }, trace: { trace_id: "abc" } },
      tags: { url: `/pacientes/${PACIENTE_ID}`, "handled": "no" },
      transaction: `/pacientes/${PACIENTE_ID}`,
      breadcrumbs: [{ category: "console", message: "Maria" }, { category: "navigation", data: { from: `/pacientes/${PACIENTE_ID}`, to: "/planos" } }],
    } as unknown as ErrorEvent;

    const out = scrubErrorEvent(event);

    expect(out.message).toBe("Erro com [email]");
    expect(out.exception?.values?.[0].value).toBe("Paciente :id com e-mail [email] não encontrado");
    expect(out.exception?.values?.[0].stacktrace?.frames?.[0]).toEqual({ filename: "app/pacientes/page.tsx", lineno: 10 });
    expect(out.user).toEqual({ ip_address: null });
    expect(out.request).toEqual({ method: "POST", url: "http://localhost/pacientes/:id?[filtrado]", headers: { "User-Agent": "Mozilla/5.0" } });
    expect(out.extra).toBeUndefined();
    expect(Object.keys(out.contexts ?? {}).sort()).toEqual(["os", "trace"]);
    expect(out.tags).toEqual({ url: "/pacientes/:id", handled: "no" });
    expect(out.transaction).toBe("/pacientes/:id");
    expect(out.breadcrumbs).toEqual([{ category: "navigation", data: { from: "/pacientes/:id", to: "/planos" } }]);

    // Nenhum dos valores sensíveis sobrevive em lugar nenhum do evento.
    const json = JSON.stringify(out);
    for (const sensivel of ["Maria", "maria@x.com", "nutri@x.com", "189.1.2.3", PACIENTE_ID, "segredo", "dor abdominal", "anamnese"]) {
      expect(json).not.toContain(sensivel);
    }
  });
});

describe("scrubTransactionEvent / scrubSpan", () => {
  it("filtra descrição e dados dos spans", () => {
    const event = {
      type: "transaction",
      transaction: `GET /pacientes/${PACIENTE_ID}`,
      spans: [
        {
          span_id: "a",
          trace_id: "b",
          start_timestamp: 1,
          description: `GET https://x.supabase.co/rest/v1/patients?nome=ilike.*Maria*`,
          data: { "http.query": "?nome=ilike.*Maria*", "url.full": `https://x.supabase.co/rest/v1/patients/${PACIENTE_ID}`, "http.response.status_code": 200 },
        },
      ],
    } as unknown as TransactionEvent;

    const out = scrubTransactionEvent(event);
    expect(out.transaction).toBe("GET /pacientes/:id");
    expect(out.spans?.[0].description).toBe("GET https://x.supabase.co/rest/v1/patients?[filtrado]");
    expect(out.spans?.[0].data).toEqual({ "url.full": "https://x.supabase.co/rest/v1/patients/:id", "http.response.status_code": 200 });
  });

  it("scrubSpan funciona sozinho (spans enviados fora de transaction)", () => {
    const span = scrubSpan({ span_id: "a", trace_id: "b", start_timestamp: 1, data: {}, description: `/pacientes/${PACIENTE_ID}` });
    expect(span.description).toBe("/pacientes/:id");
  });
});
