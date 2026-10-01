"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/patients";
import { hasActiveConsent } from "@/lib/actions/patient-consents";
import { rateLimitOrError } from "@/lib/rate-limit";
import {
  ANEXO_ACCEPTED_TYPES,
  ANEXO_MAX_BYTES,
  anthropometricAttachmentSchema,
  type AnthropometricAttachmentInput,
} from "@/lib/validations/anthropometric-attachment";

const BUCKET = "profissional";
const SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 60;

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function numeros(data: ReturnType<typeof anthropometricAttachmentSchema.parse>) {
  return {
    data_avaliacao: data.data_avaliacao,
    titulo: data.titulo ?? null,
    observacoes: data.observacoes ?? null,
    peso_kg: data.peso_kg ?? null,
    percentual_gordura: data.percentual_gordura ?? null,
    massa_livre_gordura_kg: data.massa_livre_gordura_kg ?? null,
    massa_muscular_kg: data.massa_muscular_kg ?? null,
  };
}

/**
 * Anexa um relatório antropométrico externo (Fase 15, Bloco C): o arquivo sobe
 * PRIMEIRO para `{user_id}/antropometria-anexos/<uuid>.<ext>` no bucket privado
 * 'profissional'; só depois a linha é criada, já com o path. Se o INSERT
 * falhar, o arquivo recém-subido é removido — nunca fica registro sem arquivo
 * nem arquivo sem registro. Mesmo padrão de uploadPatientPhoto.
 *
 * Exige consentimento ATIVO de 'exames' (regra da Fase 7 para arquivos de
 * saúde vindos de fora), checado aqui no servidor.
 */
export async function createAnthropometricAttachment(
  patientId: string,
  input: AnthropometricAttachmentInput,
  formData: FormData
): Promise<ActionResult> {
  const parsed = anthropometricAttachmentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Verifique os valores informados." };
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

  if (!(await hasActiveConsent(patientId, "exames"))) {
    return {
      success: false,
      message: "Não há consentimento ativo para exames deste paciente. Registre o consentimento antes de anexar o relatório.",
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, message: "Nenhum arquivo enviado." };
  }
  if (!ANEXO_ACCEPTED_TYPES.includes(file.type as (typeof ANEXO_ACCEPTED_TYPES)[number])) {
    return { success: false, message: "Formato inválido. Use PDF, PNG, JPG ou WEBP." };
  }
  if (file.size > ANEXO_MAX_BYTES) {
    return { success: false, message: "Arquivo muito grande. O limite é 10MB." };
  }

  const path = `${user.id}/antropometria-anexos/${crypto.randomUUID()}.${EXTENSION_BY_MIME_TYPE[file.type]}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
  if (uploadError) {
    return { success: false, message: uploadError.message };
  }

  const { error } = await supabase.from("anthropometric_attachments").insert({
    patient_id: patientId,
    user_id: user.id,
    arquivo_path: path,
    arquivo_nome: file.name.slice(0, 200),
    ...numeros(parsed.data),
  });
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { success: false, message: error.message };
  }

  revalidatePath(`/pacientes/${patientId}`);
  return { success: true, message: "Relatório anexado." };
}

/** Corrige data, título, observação e números — o arquivo não muda. */
export async function updateAnthropometricAttachment(
  patientId: string,
  attachmentId: string,
  input: AnthropometricAttachmentInput
): Promise<ActionResult> {
  const parsed = anthropometricAttachmentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Verifique os valores informados." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("anthropometric_attachments")
    .update(numeros(parsed.data))
    .eq("id", attachmentId)
    .eq("patient_id", patientId);
  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/pacientes/${patientId}`);
  return { success: true, message: "Relatório atualizado." };
}

/** Soft delete via função `security definer` (migration 0040, padrão da 0017). O arquivo fica no storage. */
export async function deleteAnthropometricAttachment(patientId: string, attachmentId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("soft_delete_anthropometric_attachment", { attachment_id: attachmentId });
  if (error) {
    return { success: false, message: error.message };
  }
  if (!data) {
    return { success: false, message: "Relatório não encontrado." };
  }

  revalidatePath(`/pacientes/${patientId}`);
  return { success: true, message: "Relatório excluído." };
}

/** URL assinada de 1h, só para path da própria pasta — mesmo padrão de getLabExamFileSignedUrl. */
export async function getAnthropometricAttachmentSignedUrl(path: string): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !path.startsWith(`${user.id}/antropometria-anexos/`)) {
    return null;
  }

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_EXPIRES_IN_SECONDS);
  return error ? null : data.signedUrl;
}
