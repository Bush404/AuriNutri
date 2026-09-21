import { describe, expect, it } from "vitest";
import { parseMaterialMarkdown } from "@/lib/pdf/material-markdown";

describe("parseMaterialMarkdown", () => {
  it("trata uma linha comum como parágrafo sem negrito", () => {
    expect(parseMaterialMarkdown("Beba bastante água.")).toEqual([
      { runs: [{ text: "Beba bastante água.", bold: false }] },
    ]);
  });

  it("**texto** vira um run em negrito, preservando o texto ao redor", () => {
    expect(parseMaterialMarkdown("Tome **2 litros** de água por dia.")).toEqual([
      {
        runs: [
          { text: "Tome ", bold: false },
          { text: "2 litros", bold: true },
          { text: " de água por dia.", bold: false },
        ],
      },
    ]);
  });

  it("suporta mais de um trecho em negrito na mesma linha", () => {
    expect(parseMaterialMarkdown("**Nunca** pule refeições, **sempre** beba água.")).toEqual([
      {
        runs: [
          { text: "Nunca", bold: true },
          { text: " pule refeições, ", bold: false },
          { text: "sempre", bold: true },
          { text: " beba água.", bold: false },
        ],
      },
    ]);
  });

  it("quebra em múltiplos parágrafos por linha em branco", () => {
    expect(parseMaterialMarkdown("Primeiro.\n\n\nSegundo.")).toEqual([
      { runs: [{ text: "Primeiro.", bold: false }] },
      { runs: [{ text: "Segundo.", bold: false }] },
    ]);
  });

  it("string vazia não gera parágrafos", () => {
    expect(parseMaterialMarkdown("   \n  ")).toEqual([]);
  });

  it("não interpreta mais '# ' ou '- ' como sintaxe — vira texto normal", () => {
    expect(parseMaterialMarkdown("# não é mais título\n- não é mais lista")).toEqual([
      { runs: [{ text: "# não é mais título", bold: false }] },
      { runs: [{ text: "- não é mais lista", bold: false }] },
    ]);
  });
});
