// @vitest-environment node
import { createElement, type ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";

import { MaterialPdfDocument, type MaterialPdfViewModel } from "./material-pdf-document";
import type { ProfissionalPdfHeaderData } from "./profissional-header";

const profissional: ProfissionalPdfHeaderData = {
  nome: "Dra. Teste",
  crn: "12345",
  crnUf: "SP",
  especialidade: "Nutrição esportiva",
  telefone: "(11) 99999-9999",
  endereco: "Rua Teste, 123",
  corMarca: "#2563eb",
  logoUrl: null,
  assinaturaUrl: null,
};

describe("MaterialPdfDocument — smoke test de renderização real", () => {
  it("gera um buffer PDF válido pra material com título de seção, subtítulo e negrito", async () => {
    const data: MaterialPdfViewModel = {
      kind: "texto",
      profissional,
      titulo: "Orientação pré-treino",
      tipoLabel: "Orientação",
      descricao: "Para atletas de resistência",
      secaoTitulo: "Antes do treino",
      secaoSubtitulo: "O que fazer na hora anterior",
      conteudo: "Beba **500ml** de água.\n\nEvite refeições pesadas.",
    };

    const element = createElement(MaterialPdfDocument, { data }) as unknown as ReactElement<DocumentProps>;
    const buffer = await renderToBuffer(element);

    expect(buffer.length).toBeGreaterThan(500);
    expect(buffer.subarray(0, 5).toString("utf-8")).toBe("%PDF-");
  });

  it("gera um buffer PDF válido pra material sem título/subtítulo de seção (ambos opcionais)", async () => {
    const data: MaterialPdfViewModel = {
      kind: "texto",
      profissional,
      titulo: "Anotação rápida",
      tipoLabel: "Outro",
      descricao: null,
      secaoTitulo: null,
      secaoSubtitulo: null,
      conteudo: "Só um texto livre, sem seção.",
    };

    const element = createElement(MaterialPdfDocument, { data }) as unknown as ReactElement<DocumentProps>;

    await expect(renderToBuffer(element)).resolves.toBeInstanceOf(Buffer);
  });

  it("gera um buffer PDF válido pra material de imagem, sem lançar exceção", async () => {
    // Data URI (PNG 1x1) em vez de URL remota — evita depender de rede no teste.
    const PNG_1X1 =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

    const data: MaterialPdfViewModel = {
      kind: "imagem",
      profissional,
      titulo: "Cartaz de sala de espera",
      tipoLabel: "Material educativo",
      descricao: null,
      imageUrl: PNG_1X1,
    };

    const element = createElement(MaterialPdfDocument, { data }) as unknown as ReactElement<DocumentProps>;

    await expect(renderToBuffer(element)).resolves.toBeInstanceOf(Buffer);
  });
});
