/**
 * Texto rico (HTML) do editor da anamnese e dos modelos — Fase 14.
 *
 * Só funções puras, sem dependência do navegador. A limpeza de verdade
 * (`sanitizeRichText`) fica em rich-text-sanitize.ts, usada só no servidor,
 * antes de gravar.
 */

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/** Texto visível do HTML (sem tags, entidades básicas resolvidas, espaços normalizados). */
export function richTextToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h[1-6]|li|tr|blockquote)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

/** Editor "vazio" devolve `<p></p>`; isto trata qualquer HTML sem texto (e sem tabela) como vazio. */
export function isRichTextEmpty(html: string | null | undefined): boolean {
  if (!html) return true;
  if (/<table/i.test(html)) return false;
  return richTextToPlainText(html).length === 0;
}
