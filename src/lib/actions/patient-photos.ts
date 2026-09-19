"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  patientPhotoSchema,
  type PatientPhotoInput,
  PATIENT_PHOTO_ACCEPTED_TYPES,
  PATIENT_PHOTO_MAX_BYTES,
} from "@/lib/validations/patient-photo";
import type { ActionResult } from "@/lib/actions/patients";
import type { PatientPhoto } from "@/lib/types/database.types";
import { hasActiveConsent } from "@/lib/actions/patient-consents";

const BUCKET = "fotos-evolucao";
// Mais curta que exames (1h) — foto corporal é mais sensível.
const SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 15;

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/**
 * Sobe a foto E cria o registro num único fluxo: o arquivo vai pro storage
 * PRIMEIRO (path com um uuid próprio, não o id da linha — que ainda não
 * existe); só depois disso o registro é criado já com arquivo_path
 * preenchido. Isso garante que nunca existe uma linha em patient_photos
 * sem arquivo — se o INSERT falhar depois do upload, o arquivo recém
 * subido é removido do storage antes de retornar o erro.
 *
 * REGRA ESTRUTURAL (Bloco A/C): a policy de INSERT de patient_photos já
 * exige consentimento ativo do tipo 'fotos' no próprio banco
 * (has_active_patient_consent no WITH CHECK — migration 0022) — a checagem
 * aqui é redundante de propósito (falha cedo, com mensagem melhor, antes
 * de gastar uma chamada de storage), não é a única linha de defesa.
 */
export async function uploadPatientPhoto(
  patientId: string,
  input: PatientPhotoInput,
  formData: FormData
): Promise<ActionResult> {
  const parsed = patientPhotoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Selecione a data e o ângulo da foto." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  const consentido = await hasActiveConsent(patientId, "fotos");
  if (!consentido) {
    return {
      success: false,
      message: "Não há consentimento ativo para fotos deste paciente. Registre o consentimento antes de enviar.",
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, message: "Nenhuma foto enviada." };
  }
  if (!PATIENT_PHOTO_ACCEPTED_TYPES.includes(file.type as (typeof PATIENT_PHOTO_ACCEPTED_TYPES)[number])) {
    return { success: false, message: "Formato inválido. Use PNG, JPG ou WEBP." };
  }
  if (file.size > PATIENT_PHOTO_MAX_BYTES) {
    return { success: false, message: "Arquivo muito grande. O limite é 8MB." };
  }

  const extension = EXTENSION_BY_MIME_TYPE[file.type];
  const path = `${user.id}/${patientId}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
  });
  if (uploadError) {
    return { success: false, message: uploadError.message };
  }

  const { error: insertError } = await supabase.from("patient_photos").insert({
    patient_id: patientId,
    user_id: user.id,
    data_registro: parsed.data.data_registro,
    tipo: parsed.data.tipo,
    arquivo_path: path,
  });

  if (insertError) {
    // Não deixa o arquivo órfão no storage se o registro não pôde ser criado.
    await supabase.storage.from(BUCKET).remove([path]);
    return { success: false, message: insertError.message };
  }

  revalidatePath(`/pacientes/${patientId}`);
  return { success: true, message: "Foto registrada." };
}

/**
 * URL assinada de curta duração (15min — mais curta que exames, por ser
 * mais sensível) para exibir a foto. NUNCA é armazenada nem cacheada —
 * gerada sob demanda a cada visualização. Registra o acesso em audit_log
 * (log_photo_view, security definer) toda vez que é chamada: gerar a URL É
 * o evento de "alguém vai ver esta foto agora".
 */
export async function getPatientPhotoSignedUrl(photoId: string): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: photo } = await supabase
    .from("patient_photos")
    .select("arquivo_path")
    .eq("id", photoId)
    .maybeSingle<Pick<PatientPhoto, "arquivo_path">>();

  if (!photo?.arquivo_path) return null;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(photo.arquivo_path, SIGNED_URL_EXPIRES_IN_SECONDS);

  if (error) return null;

  await supabase.rpc("log_photo_view", { p_photo_id: photoId });

  return data.signedUrl;
}

/**
 * Exclusão: remove o arquivo do storage DE VERDADE antes de marcar a linha
 * como excluída — "direito ao esquecimento" não se satisfaz com deleted_at
 * se o arquivo continua no bucket. Se a remoção do storage falhar, a linha
 * NÃO é marcada como excluída (para o profissional poder tentar de novo,
 * em vez do sistema mentir que a foto sumiu enquanto o arquivo ainda existe).
 */
export async function deletePatientPhoto(patientId: string, photoId: string): Promise<ActionResult> {
  const supabase = createClient();

  const { data: photo, error: fetchError } = await supabase
    .from("patient_photos")
    .select("arquivo_path")
    .eq("id", photoId)
    .maybeSingle<Pick<PatientPhoto, "arquivo_path">>();

  if (fetchError) {
    return { success: false, message: fetchError.message };
  }
  if (!photo || !photo.arquivo_path) {
    return { success: false, message: "Foto não encontrada." };
  }

  const { error: removeError } = await supabase.storage.from(BUCKET).remove([photo.arquivo_path]);
  if (removeError) {
    return { success: false, message: `Não foi possível remover o arquivo do armazenamento: ${removeError.message}` };
  }

  const { data: ok, error: softDeleteError } = await supabase.rpc("soft_delete_patient_photo", { photo_id: photoId });
  if (softDeleteError) {
    return { success: false, message: softDeleteError.message };
  }
  if (!ok) {
    return { success: false, message: "Foto não encontrada." };
  }

  revalidatePath(`/pacientes/${patientId}`);
  return { success: true, message: "Foto excluída — o arquivo também foi removido do armazenamento." };
}
