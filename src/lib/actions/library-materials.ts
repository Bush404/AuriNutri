"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  libraryMaterialMetaSchema,
  libraryMaterialTextoSchema,
  tagsFromInput,
  LIBRARY_MATERIAL_FILE_ACCEPTED_TYPES,
  LIBRARY_MATERIAL_FILE_MAX_BYTES,
  type LibraryMaterialMetaInput,
  type LibraryMaterialTextoInput,
} from "@/lib/validations/library-material";
import type { ActionResult } from "@/lib/actions/patients";
import type { LibraryMaterial } from "@/lib/types/database.types";
import { rateLimitOrError } from "@/lib/rate-limit";

// Bucket privado 'profissional', criado na Fase 2 (migration 0004) — reaproveitado
// aqui na pasta "<user_id>/biblioteca/...", mesmo padrão já usado para exames
// (src/lib/actions/lab-exams.ts, pasta "exames").
const BUCKET = "profissional";
const SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 60; // 1 hora

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export interface CreateLibraryMaterialResult extends ActionResult {
  id?: string;
}

/** Cria um material escrito direto no sistema (editor de texto simples). */
export async function createLibraryMaterialTexto(
  input: LibraryMaterialTextoInput
): Promise<CreateLibraryMaterialResult> {
  const parsed = libraryMaterialTextoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Verifique os dados informados." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  const { data, error } = await supabase
    .from("library_materials")
    .insert({
      user_id: user.id,
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao ?? null,
      tipo: parsed.data.tipo,
      secao_titulo: parsed.data.secao_titulo ?? null,
      secao_subtitulo: parsed.data.secao_subtitulo ?? null,
      conteudo: parsed.data.conteudo,
      arquivo_path: null,
      tags: tagsFromInput(parsed.data),
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/biblioteca");
  return { success: true, id: data.id, message: "Material criado." };
}

/** Atualiza um material escrito (metadados + conteúdo). Não se aplica a materiais com arquivo. */
export async function updateLibraryMaterialTexto(
  materialId: string,
  input: LibraryMaterialTextoInput
): Promise<ActionResult> {
  const parsed = libraryMaterialTextoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Verifique os dados informados." };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("library_materials")
    .update({
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao ?? null,
      tipo: parsed.data.tipo,
      secao_titulo: parsed.data.secao_titulo ?? null,
      secao_subtitulo: parsed.data.secao_subtitulo ?? null,
      conteudo: parsed.data.conteudo,
      tags: tagsFromInput(parsed.data),
    })
    .eq("id", materialId)
    .is("arquivo_path", null);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/biblioteca");
  return { success: true, message: "Material atualizado." };
}

/** Atualiza só os metadados (título/descrição/tipo/tags) de um material com arquivo. */
export async function updateLibraryMaterialMeta(
  materialId: string,
  input: LibraryMaterialMetaInput
): Promise<ActionResult> {
  const parsed = libraryMaterialMetaSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Verifique os dados informados." };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("library_materials")
    .update({
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao ?? null,
      tipo: parsed.data.tipo,
      tags: tagsFromInput(parsed.data),
    })
    .eq("id", materialId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/biblioteca");
  return { success: true, message: "Material atualizado." };
}

/**
 * Cria um material a partir de um arquivo enviado (PDF/imagem) — sobe o
 * arquivo PRIMEIRO e só então insere a linha já com `arquivo_path` (nunca o
 * inverso), porque a constraint `library_materials_conteudo_xor_arquivo`
 * exige que um dos dois já esteja preenchido na criação. Se o insert falhar
 * depois do upload ter dado certo, o arquivo órfão é removido do storage.
 */
export async function createLibraryMaterialComArquivo(formData: FormData): Promise<CreateLibraryMaterialResult> {
  const parsed = libraryMaterialMetaSchema.safeParse({
    titulo: formData.get("titulo"),
    descricao: formData.get("descricao") || undefined,
    tipo: formData.get("tipo"),
    tagsTexto: formData.get("tagsTexto") || "",
  });
  if (!parsed.success) {
    return { success: false, message: "Verifique os dados informados." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, message: "Selecione o arquivo do material." };
  }
  if (!LIBRARY_MATERIAL_FILE_ACCEPTED_TYPES.includes(file.type as (typeof LIBRARY_MATERIAL_FILE_ACCEPTED_TYPES)[number])) {
    return { success: false, message: "Formato inválido. Use PDF, PNG, JPG ou WEBP." };
  }
  if (file.size > LIBRARY_MATERIAL_FILE_MAX_BYTES) {
    return { success: false, message: "Arquivo muito grande. O limite é 10MB." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  const limited = await rateLimitOrError(supabase, "enviar_arquivo");
  if (limited) return limited;

  const extension = EXTENSION_BY_MIME_TYPE[file.type];
  const path = `${user.id}/biblioteca/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
  });
  if (uploadError) {
    return { success: false, message: uploadError.message };
  }

  const { data, error } = await supabase
    .from("library_materials")
    .insert({
      user_id: user.id,
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao ?? null,
      tipo: parsed.data.tipo,
      conteudo: null,
      arquivo_path: path,
      tags: tagsFromInput(parsed.data),
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { success: false, message: error.message };
  }

  revalidatePath("/biblioteca");
  return { success: true, id: data.id, message: "Material criado." };
}

/**
 * Soft delete — via função `security definer` (mesmo padrão de
 * soft_delete_recipe desde a migration 0017). Remove também o arquivo do
 * storage quando houver, já que ele não serve mais pra nada fora da linha
 * excluída.
 */
export async function deleteLibraryMaterial(materialId: string): Promise<ActionResult> {
  const supabase = createClient();

  const { data: material } = await supabase
    .from("library_materials")
    .select("arquivo_path")
    .eq("id", materialId)
    .single<{ arquivo_path: string | null }>();

  const { data, error } = await supabase.rpc("soft_delete_library_material", { material_id: materialId });

  if (error) {
    return { success: false, message: error.message };
  }
  if (!data) {
    return { success: false, message: "Material não encontrado." };
  }

  if (material?.arquivo_path) {
    await supabase.storage.from(BUCKET).remove([material.arquivo_path]);
  }

  revalidatePath("/biblioteca");
  return { success: true, message: "Material excluído." };
}

/** Confere que o path pertence ao usuário autenticado antes de assinar — mesmo padrão de getProfileFileSignedUrl. */
export async function getLibraryMaterialFileSignedUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !path.startsWith(`${user.id}/`)) {
    return null;
  }

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_EXPIRES_IN_SECONDS);

  if (error) {
    return null;
  }

  return data.signedUrl;
}

/**
 * Busca materiais para o seletor da Central de Envio — mesmo padrão de
 * searchRecipesForPicker (recipes.ts), com o filtro extra por tag (pedido do
 * usuário após testar: buscar só por título não bastava quando o material
 * não tem um nome fácil de lembrar, mas está bem taggeado).
 */
export async function searchLibraryMaterialsForPicker(query: string, tag?: string): Promise<LibraryMaterial[]> {
  const supabase = createClient();
  const termo = query.trim();

  let materialsQuery = supabase.from("library_materials").select("*").order("titulo").limit(8);

  if (termo) {
    materialsQuery = materialsQuery.ilike("titulo", `%${termo}%`);
  }
  if (tag) {
    materialsQuery = materialsQuery.contains("tags", [tag]);
  }

  const { data } = await materialsQuery.returns<LibraryMaterial[]>();
  return data ?? [];
}

/** Tags distintas em uso na biblioteca — popula o filtro por tag do seletor da Central de Envio. */
export async function listLibraryMaterialTags(): Promise<string[]> {
  const supabase = createClient();
  const { data } = await supabase.from("library_materials").select("tags").returns<{ tags: string[] }[]>();

  return Array.from(new Set((data ?? []).flatMap((m) => m.tags))).sort((a, b) => a.localeCompare(b, "pt-BR"));
}
