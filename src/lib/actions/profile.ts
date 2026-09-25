"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  profileSchema,
  type ProfileInput,
  PROFILE_FILE_ACCEPTED_TYPES,
  PROFILE_FILE_MAX_BYTES,
} from "@/lib/validations/profile";
import { rateLimitOrError } from "@/lib/rate-limit";
import type { ActionResult } from "@/lib/actions/patients";

const BUCKET = "profissional";
const SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 60; // 1 hora

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

function emptyToNull<T extends Record<string, unknown>>(obj: T) {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = value === "" || value === undefined ? null : value;
  }
  return result;
}

export async function updateProfile(input: ProfileInput): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Dados inválidos. Verifique o formulário." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  const { error } = await supabase
    .from("profiles")
    .update(emptyToNull(parsed.data))
    .eq("id", user.id);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/perfil");
  revalidatePath("/", "layout");
  return { success: true, message: "Perfil atualizado com sucesso." };
}

export interface UploadProfileFileResult extends ActionResult {
  path?: string;
}

/**
 * Recebe um arquivo (logo ou assinatura) via FormData e sobe para
 * `{auth.uid()}/<kind>.<ext>` no bucket privado 'profissional'.
 *
 * Validação de tipo/tamanho é repetida aqui mesmo já existindo no cliente:
 * o componente de upload no navegador pode ser contornado (DevTools, chamada
 * direta da action), então o servidor não pode confiar no que o cliente diz
 * que validou.
 */
export async function uploadProfileFile(
  kind: "logo" | "assinatura",
  formData: FormData
): Promise<UploadProfileFileResult> {
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { success: false, message: "Nenhum arquivo enviado." };
  }

  if (!PROFILE_FILE_ACCEPTED_TYPES.includes(file.type as (typeof PROFILE_FILE_ACCEPTED_TYPES)[number])) {
    return { success: false, message: "Formato inválido. Use PNG, JPG, WEBP ou SVG." };
  }

  if (file.size > PROFILE_FILE_MAX_BYTES) {
    return { success: false, message: "Arquivo muito grande. O limite é 2MB." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  const limited = await rateLimitOrError(supabase, "enviar_arquivo");
  if (limited) return limited;

  // Extensão vem do MIME type validado acima, nunca do nome do arquivo
  // enviado pelo cliente (que é livre e não confiável).
  const extension = EXTENSION_BY_MIME_TYPE[file.type];
  const path = `${user.id}/${kind}.${extension}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: true,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/perfil");
  return { success: true, path };
}

/**
 * Gera uma URL assinada de curta duração (1h) para exibir um arquivo privado
 * do bucket 'profissional'. Confere que o path pertence ao usuário autenticado
 * antes de assinar — mesmo que o RLS do bucket já bloqueie o acesso cruzado,
 * aqui evitamos até tentar assinar um path de outro usuário.
 */
export async function getProfileFileSignedUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !path.startsWith(`${user.id}/`)) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRES_IN_SECONDS);

  if (error) {
    return null;
  }

  return data.signedUrl;
}
