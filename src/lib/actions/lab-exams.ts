"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { labExamSchema, type LabExamInput, LAB_EXAM_FILE_ACCEPTED_TYPES, LAB_EXAM_FILE_MAX_BYTES } from "@/lib/validations/lab-exam";
import type { ActionResult } from "@/lib/actions/patients";
import { hasActiveConsent } from "@/lib/actions/patient-consents";
import { rateLimitOrError } from "@/lib/rate-limit";

const BUCKET = "profissional";
const SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 60; // 1 hora, nunca permanente.

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export interface CreateLabExamResult extends ActionResult {
  id?: string;
}

export async function createLabExam(patientId: string, input: LabExamInput): Promise<CreateLabExamResult> {
  const parsed = labExamSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Informe a data da coleta." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  const { data, error } = await supabase
    .from("lab_exams")
    .insert({
      patient_id: patientId,
      user_id: user.id,
      data_coleta: parsed.data.data_coleta,
      laboratorio: parsed.data.laboratorio ?? null,
      observacoes: parsed.data.observacoes ?? null,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/pacientes/${patientId}`);
  return { success: true, id: data.id };
}

export async function updateLabExam(patientId: string, examId: string, input: LabExamInput): Promise<ActionResult> {
  const parsed = labExamSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Informe a data da coleta." };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("lab_exams")
    .update({
      data_coleta: parsed.data.data_coleta,
      laboratorio: parsed.data.laboratorio ?? null,
      observacoes: parsed.data.observacoes ?? null,
    })
    .eq("id", examId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/pacientes/${patientId}`);
  return { success: true, message: "Exame atualizado." };
}

/** Soft delete via função `security definer` (mesmo padrão da migration 0017) — ver comentário em deleteRecipe (recipes.ts). */
export async function deleteLabExam(patientId: string, examId: string): Promise<ActionResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("soft_delete_lab_exam", { exam_id: examId });

  if (error) {
    return { success: false, message: error.message };
  }
  if (!data) {
    return { success: false, message: "Exame não encontrado." };
  }

  revalidatePath(`/pacientes/${patientId}`);
  return { success: true, message: "Exame excluído." };
}

export interface UploadLabExamFileResult extends ActionResult {
  path?: string;
}

/**
 * Recebe o PDF/imagem do exame via FormData e sobe para
 * `{auth.uid()}/exames/<uuid>.<ext>` no bucket privado 'profissional'
 * (criado na Fase 2) — mesma pasta do profissional, subpasta "exames".
 *
 * REGRA ESTRUTURAL (Fase 7, Bloco A): bloqueado se não houver consentimento
 * ATIVO do tipo 'exames' para este paciente — checado aqui no servidor, não
 * só escondido na UI, porque a action pode ser chamada diretamente.
 */
export async function uploadLabExamFile(
  patientId: string,
  examId: string,
  formData: FormData
): Promise<UploadLabExamFileResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  const limited = await rateLimitOrError(supabase, "enviar_arquivo");
  if (limited) return limited;

  const consentido = await hasActiveConsent(patientId, "exames");
  if (!consentido) {
    return {
      success: false,
      message: "Não há consentimento ativo para exames deste paciente. Registre o consentimento antes de enviar o arquivo.",
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, message: "Nenhum arquivo enviado." };
  }

  if (!LAB_EXAM_FILE_ACCEPTED_TYPES.includes(file.type as (typeof LAB_EXAM_FILE_ACCEPTED_TYPES)[number])) {
    return { success: false, message: "Formato inválido. Use PDF, PNG, JPG ou WEBP." };
  }

  if (file.size > LAB_EXAM_FILE_MAX_BYTES) {
    return { success: false, message: "Arquivo muito grande. O limite é 10MB." };
  }

  const extension = EXTENSION_BY_MIME_TYPE[file.type];
  const path = `${user.id}/exames/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
  });

  if (uploadError) {
    return { success: false, message: uploadError.message };
  }

  const { error: updateError } = await supabase.from("lab_exams").update({ arquivo_path: path }).eq("id", examId);

  if (updateError) {
    return { success: false, message: updateError.message };
  }

  revalidatePath(`/pacientes/${patientId}`);
  return { success: true, path };
}

/**
 * Gera uma URL assinada de curta duração (1h) para o arquivo do exame —
 * nunca uma URL permanente. Confere que o path pertence ao usuário
 * autenticado antes de assinar, mesmo padrão de getProfileFileSignedUrl.
 */
export async function getLabExamFileSignedUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;

  const supabase = createClient();
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
