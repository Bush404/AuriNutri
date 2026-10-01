// @vitest-environment node
import { createElement, type ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";

import { EvolucaoPdfDocument } from "./evolucao-pdf-document";

describe("EvolucaoPdfDocument — smoke test de renderização real", () => {
  it("gera PDF válido com série vazia, de 1 ponto e de vários pontos (com relatório anexado)", async () => {
    const element = createElement(EvolucaoPdfDocument, {
      data: {
        profissional: {
          nome: "Dra. Teste",
          crn: "12345",
          crnUf: "SP",
          especialidade: null,
          telefone: null,
          endereco: null,
          corMarca: "#2563eb",
          logoUrl: null,
          assinaturaUrl: null,
        },
        pacienteNome: "Paciente Teste",
        ate: "2026-09-30",
        geradoEm: "2026-09-30T12:00:00Z",
        indicadores: [
          {
            id: "peso",
            pontos: [
              { data: "2026-01-10", valor: 82, origem: "avaliacao" },
              { data: "2026-04-20", valor: 79, origem: "anexo" },
              { data: "2026-09-30", valor: 76.5, origem: "avaliacao" },
            ],
          },
          { id: "cintura", pontos: [{ data: "2026-09-30", valor: 88, origem: "avaliacao" }] },
          { id: "rcq", pontos: [] },
        ],
      },
    }) as unknown as ReactElement<DocumentProps>;

    const buffer = await renderToBuffer(element);
    expect(buffer.length).toBeGreaterThan(500);
    expect(buffer.subarray(0, 5).toString("utf-8")).toBe("%PDF-");
  });
});
