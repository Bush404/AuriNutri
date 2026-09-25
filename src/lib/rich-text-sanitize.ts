import sanitizeHtml from "sanitize-html";

/**
 * Usada nas Server Actions (servidor), nunca no navegador.
 *
 * Limpa o HTML do editor ANTES de gravar (anamnese e modelos). Só passa o que
 * o editor sabe produzir: parágrafos, títulos, negrito/itálico/sublinhado/
 * riscado, listas, citação, linha, tabela e link http(s)/mailto. Tudo o mais
 * — <script>, <iframe>, <img>, estilos, classes, eventos como onclick,
 * links javascript: — é removido. Texto colado do Word chega aqui cheio de
 * estilos e marcações próprias; sai só o conteúdo.
 */
export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p",
      "br",
      "h2",
      "h3",
      "h4",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "ul",
      "ol",
      "li",
      "blockquote",
      "hr",
      "a",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
    ],
    allowedAttributes: {
      a: ["href", "rel", "target"],
      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    // h1 do Word vira h2 (o h1 da página é o nome do paciente).
    transformTags: {
      h1: "h2",
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow", target: "_blank" }),
    },
    disallowedTagsMode: "discard",
  }).trim();
}
