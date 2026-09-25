import type { Anamnesis } from "@/lib/types/database.types";
import { escapeHtml } from "@/lib/rich-text";

/**
 * Campos por tema da anamnese ANTIGA (antes da Fase 14). Continuam no banco e
 * só são lidos para montar o texto de registros que ainda não têm `conteudo`.
 */
export const LEGACY_ANAMNESIS_FIELDS = [
  { name: "queixa_principal", label: "Queixa principal" },
  { name: "historico_saude", label: "Histórico de saúde" },
  { name: "historico_familiar", label: "Histórico familiar" },
  { name: "habitos_alimentares", label: "Hábitos alimentares" },
  { name: "atividade_fisica", label: "Atividade física" },
  { name: "qualidade_sono", label: "Qualidade do sono" },
  { name: "alergias", label: "Alergias" },
  { name: "intolerancias", label: "Intolerâncias" },
  { name: "medicamentos", label: "Medicamentos em uso" },
  { name: "suplementos", label: "Suplementos em uso" },
  { name: "observacoes", label: "Observações gerais" },
] as const satisfies readonly { name: keyof Anamnesis; label: string }[];

/** Texto puro → parágrafos HTML (linha em branco separa parágrafos; quebra simples vira <br>). */
function plainTextToParagraphs(text: string): string {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/**
 * Monta o texto de uma anamnese antiga a partir das colunas por tema: título
 * do tema + conteúdo, na ordem de sempre, pulando os vazios. Não grava nada —
 * o registro só passa a ter `conteudo` quando o profissional salvar.
 */
export function legacyAnamnesisToHtml(anamnese: Partial<Pick<Anamnesis, (typeof LEGACY_ANAMNESIS_FIELDS)[number]["name"]>>): string {
  return LEGACY_ANAMNESIS_FIELDS.map(({ name, label }) => {
    const value = anamnese[name]?.trim();
    return value ? `<h3>${escapeHtml(label)}</h3>${plainTextToParagraphs(value)}` : "";
  }).join("");
}

/** O texto a mostrar/editar: o novo (`conteudo`) ou, se não houver, o montado das colunas antigas. */
export function anamnesisHtml(anamnese: Anamnesis): string {
  return anamnese.conteudo ?? legacyAnamnesisToHtml(anamnese);
}
