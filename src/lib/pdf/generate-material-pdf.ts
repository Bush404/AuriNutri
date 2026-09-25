import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { createClient } from "@/lib/supabase/server";

import { buildProfissionalPdfHeaderData } from "@/lib/pdf/profissional-header";
import { MaterialPdfDocument } from "@/lib/pdf/material-pdf-document";
import { slugify } from "@/lib/pdf/generate-plan-pdf";
import { getLibraryMaterialFileSignedUrl } from "@/lib/actions/library-materials";
import { LIBRARY_MATERIAL_TIPO_LABELS } from "@/lib/validations/library-material";
import type { LibraryMaterial } from "@/lib/types/database.types";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"]);

export interface GenerateMaterialPdfResult {
  buffer: Buffer;
  titulo: string;
  filename: string;
}

/**
 * Gera o PDF de um material da biblioteca ("Material da biblioteca" na
 * Central de Envio). Três casos, conforme como o material foi criado:
 * - Escrito no sistema (`conteudo`): renderiza o texto com o cabeçalho do
 *   profissional, mesmo padrão de generateReceitaPdf.
 * - Arquivo já em PDF: baixa os bytes originais e os usa direto — nunca
 *   reabre/re-renderiza um PDF de terceiro.
 * - Arquivo de imagem: embute a imagem numa página, pra manter a mesma
 *   garantia do resto do projeto de que /compartilhado/[token] sempre serve
 *   um PDF de verdade (ver src/app/compartilhado/[token]/route.ts).
 * Retorna null se o material não existe/não pertence ao usuário (RLS).
 */
export async function generateMaterialPdf(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; email?: string | null },
  materialId: string
): Promise<GenerateMaterialPdfResult | null> {
  const { data: material } = await supabase
    .from("library_materials")
    .select("*")
    .eq("id", materialId)
    .single<LibraryMaterial>();

  if (!material) return null;

  const filename = `material-${slugify(material.titulo)}.pdf`;

  if (material.arquivo_path) {
    const extension = material.arquivo_path.split(".").pop()?.toLowerCase() ?? "";

    if (extension === "pdf") {
      const { data: fileBlob, error } = await supabase.storage.from("profissional").download(material.arquivo_path);
      if (error || !fileBlob) return null;
      const buffer = Buffer.from(await fileBlob.arrayBuffer());
      return { buffer, titulo: material.titulo, filename };
    }

    if (!IMAGE_EXTENSIONS.has(extension)) return null;

    const imageUrl = await getLibraryMaterialFileSignedUrl(material.arquivo_path);
    if (!imageUrl) return null;

    const profissional = await buildProfissionalPdfHeaderData(supabase, user);
    const element = createElement(MaterialPdfDocument, {
      data: {
        kind: "imagem",
        profissional,
        titulo: material.titulo,
        tipoLabel: LIBRARY_MATERIAL_TIPO_LABELS[material.tipo],
        descricao: material.descricao,
        imageUrl,
      },
    }) as unknown as ReactElement<DocumentProps>;
    const buffer = await renderToBuffer(element);
    return { buffer, titulo: material.titulo, filename };
  }

  const profissional = await buildProfissionalPdfHeaderData(supabase, user);
  const element = createElement(MaterialPdfDocument, {
    data: {
      kind: "texto",
      profissional,
      titulo: material.titulo,
      tipoLabel: LIBRARY_MATERIAL_TIPO_LABELS[material.tipo],
      descricao: material.descricao,
      secaoTitulo: material.secao_titulo,
      secaoSubtitulo: material.secao_subtitulo,
      conteudo: material.conteudo ?? "",
    },
  }) as unknown as ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(element);
  return { buffer, titulo: material.titulo, filename };
}
