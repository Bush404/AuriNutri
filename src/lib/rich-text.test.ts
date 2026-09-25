import { describe, expect, it } from "vitest";

import { escapeHtml, isRichTextEmpty, richTextToPlainText } from "./rich-text";
import { sanitizeRichText } from "./rich-text-sanitize";
import { legacyAnamnesisToHtml } from "./anamnesis";

describe("sanitizeRichText", () => {
  it("mantém a formatação que o editor produz", () => {
    const html =
      "<h2>Queixa</h2><p><strong>Dor</strong> e <em>cansaço</em></p><ul><li>item</li></ul>" +
      '<table><tbody><tr><td colspan="2">x</td></tr></tbody></table>';
    expect(sanitizeRichText(html)).toBe(html);
  });

  it("remove script, eventos, estilos, imagens e iframes", () => {
    const html =
      '<p onclick="alert(1)" style="color:red" class="MsoNormal">Oi</p><script>alert(1)</script>' +
      '<img src="x" onerror="alert(1)"><iframe src="https://evil"></iframe>';
    expect(sanitizeRichText(html)).toBe("<p>Oi</p>");
  });

  it("bloqueia link javascript: e protege links externos", () => {
    expect(sanitizeRichText('<a href="javascript:alert(1)">x</a>')).toBe("<a rel=\"noopener noreferrer nofollow\" target=\"_blank\">x</a>");
    expect(sanitizeRichText('<a href="https://tbca.net.br">TBCA</a>')).toBe(
      '<a href="https://tbca.net.br" rel="noopener noreferrer nofollow" target="_blank">TBCA</a>'
    );
  });

  it("título 1 colado do Word vira título 2", () => {
    expect(sanitizeRichText("<h1>Anamnese</h1>")).toBe("<h2>Anamnese</h2>");
  });
});

describe("texto puro e vazio", () => {
  it("escapeHtml neutraliza tags digitadas", () => {
    expect(escapeHtml('<b>"a" & \'b\'</b>')).toBe("&lt;b&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/b&gt;");
  });

  it("editor vazio conta como vazio; tabela sem texto não", () => {
    expect(isRichTextEmpty("<p></p>")).toBe(true);
    expect(isRichTextEmpty("<p> &nbsp; </p><p><br></p>")).toBe(true);
    expect(isRichTextEmpty(null)).toBe(true);
    expect(isRichTextEmpty("<table><tr><td></td></tr></table>")).toBe(false);
    expect(isRichTextEmpty("<p>a</p>")).toBe(false);
  });

  it("richTextToPlainText separa blocos por linha", () => {
    expect(richTextToPlainText("<h3>Sono</h3><p>Dorme 6h &amp; acorda</p>")).toBe("Sono\nDorme 6h & acorda");
  });
});

describe("legacyAnamnesisToHtml (anamnese antiga → texto livre)", () => {
  it("monta título + conteúdo na ordem dos temas, pulando os vazios, sem perder texto", () => {
    const html = legacyAnamnesisToHtml({
      observacoes: "Final",
      queixa_principal: "Quer emagrecer\ncom saúde",
      historico_saude: "   ",
      alergias: "Camarão\n\nAmendoim",
    });
    expect(html).toBe(
      "<h3>Queixa principal</h3><p>Quer emagrecer<br>com saúde</p>" +
        "<h3>Alergias</h3><p>Camarão</p><p>Amendoim</p>" +
        "<h3>Observações gerais</h3><p>Final</p>"
    );
  });

  it("escapa o que a pessoa digitou (texto antigo nunca vira HTML)", () => {
    expect(legacyAnamnesisToHtml({ queixa_principal: "<script>x</script>" })).toBe(
      "<h3>Queixa principal</h3><p>&lt;script&gt;x&lt;/script&gt;</p>"
    );
  });

  it("anamnese antiga sem nada preenchido vira texto vazio", () => {
    expect(legacyAnamnesisToHtml({})).toBe("");
  });
});
