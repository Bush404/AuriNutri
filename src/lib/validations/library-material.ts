import { z } from "zod";
import type { LibraryMaterialTipo } from "@/lib/types/database.types";

const optionalText = () =>
  z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" || v === undefined ? undefined : v));

export const LIBRARY_MATERIAL_TIPOS: LibraryMaterialTipo[] = [
  "orientacao",
  "material_educativo",
  "protocolo",
  "checklist",
  "outro",
];

export const LIBRARY_MATERIAL_TIPO_LABELS: Record<LibraryMaterialTipo, string> = {
  orientacao: "Orientação",
  material_educativo: "Material educativo",
  protocolo: "Protocolo",
  checklist: "Checklist",
  outro: "Outro",
};

/** "arroz, low carb, vegano" -> ["arroz", "low carb", "vegano"] — mesmo helper usado em receitas, sem componente de chips novo. */
function parseTags(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    )
  );
}

const libraryMaterialTipoSchema = z.enum(
  LIBRARY_MATERIAL_TIPOS as [LibraryMaterialTipo, ...LibraryMaterialTipo[]]
);

/** Campos comuns às duas formas de criação (escrito ou arquivo). Tags obrigatória — pedido do usuário, pra toda biblioteca ficar filtrável por tag. */
export const libraryMaterialMetaSchema = z.object({
  titulo: z.string().min(2, "Informe o nome do material"),
  descricao: optionalText(),
  tipo: libraryMaterialTipoSchema,
  tagsTexto: z
    .string()
    .refine((value) => parseTags(value).length > 0, "Adicione ao menos uma tag"),
});
export type LibraryMaterialMetaInput = z.infer<typeof libraryMaterialMetaSchema>;

export function tagsFromInput(input: { tagsTexto?: string }): string[] {
  return parseTags(input.tagsTexto ?? "");
}

/**
 * Material escrito direto no sistema — estrutura guiada em vez de um campo
 * único de texto livre com sintaxe pra lembrar: título e subtítulo da seção
 * (opcionais) mais o texto livre (obrigatório, só com **negrito** como
 * formatação — ver src/lib/pdf/material-markdown.ts).
 */
export const libraryMaterialTextoSchema = libraryMaterialMetaSchema.extend({
  secao_titulo: optionalText(),
  secao_subtitulo: optionalText(),
  conteudo: z.string().min(1, "Escreva o texto livre do material"),
});
export type LibraryMaterialTextoInput = z.infer<typeof libraryMaterialTextoSchema>;

/** Arquivo do material — PDF ou imagem, validado no cliente E no servidor (mesmo padrão de lab-exam.ts). */
export const LIBRARY_MATERIAL_FILE_ACCEPTED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
export const LIBRARY_MATERIAL_FILE_ACCEPTED_EXTENSIONS = ".pdf,.png,.jpg,.jpeg,.webp";
export const LIBRARY_MATERIAL_FILE_MAX_BYTES = 10 * 1024 * 1024; // 10MB
