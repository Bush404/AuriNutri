"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { anamnesisSchema, assessmentSchema, type AnamnesisInput, type AssessmentInput } from "@/lib/validations/patient";
import type { ActionResult } from "@/lib/actions/patients";
import { sanitizeRichText } from "@/lib/rich-text-sanitize";
import { isRichTextEmpty } from "@/lib/rich-text";

/** Limpa e valida o texto da anamnese. Devolve `{ error }` se estiver inválido ou vazio. */
function prepareAnamnesis(input: AnamnesisInput) {
  const parsed = anamnesisSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos. Verifique o formulário." } as const;
  }
  const conteudo = sanitizeRichText(parsed.data.conteudo);
  if (isRichTextEmpty(conteudo)) {
    return { error: "Escreva a anamnese antes de salvar." } as const;
  }
  return { data: { titulo: parsed.data.titulo ?? null, conteudo } } as const;
}

/**
 * Cria um NOVO registro de anamnese. anamnesis é 1:N por paciente (histórico
 * clínico) — isto nunca sobrescreve um registro anterior. Texto livre (Fase
 * 14): só `titulo` e `conteudo`; as colunas por tema antigas não são escritas.
 */
export async function createAnamnesis(patientId: string, input: AnamnesisInput): Promise<ActionResult> {
  const prepared = prepareAnamnesis(input);
  if ("error" in prepared) {
    return { success: false, message: prepared.error };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  const { error } = await supabase.from("anamnesis").insert({
    patient_id: patientId,
    user_id: user.id,
    ...prepared.data,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/pacientes/${patientId}`);
  return { success: true, message: "Anamnese registrada com sucesso." };
}

/**
 * Corrige um registro de anamnese específico já existente (não cria um novo).
 * Num registro antigo, o texto montado das colunas por tema passa a ser o
 * `conteudo`; as colunas antigas continuam intactas no banco.
 */
export async function updateAnamnesis(
  anamnesisId: string,
  patientId: string,
  input: AnamnesisInput
): Promise<ActionResult> {
  const prepared = prepareAnamnesis(input);
  if ("error" in prepared) {
    return { success: false, message: prepared.error };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("anamnesis")
    .update(prepared.data)
    .eq("id", anamnesisId)
    .eq("patient_id", patientId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/pacientes/${patientId}`);
  return { success: true, message: "Anamnese atualizada com sucesso." };
}

/**
 * Soft delete via função `security definer` (migration 0037, padrão da 0017).
 * O registro some da tela mas continua no banco e no audit_log.
 */
export async function deleteAnamnesis(patientId: string, anamnesisId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("soft_delete_anamnesis", { anamnesis_id: anamnesisId });

  if (error) {
    return { success: false, message: error.message };
  }
  if (!data) {
    return { success: false, message: "Anamnese não encontrada." };
  }

  revalidatePath(`/pacientes/${patientId}`);
  return { success: true, message: "Anamnese excluída." };
}

export async function createAssessment(patientId: string, input: AssessmentInput): Promise<ActionResult> {
  const parsed = assessmentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Verifique os valores informados." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  const { error } = await supabase.from("anthropometric_assessments").insert({
    patient_id: patientId,
    user_id: user.id,
    data_avaliacao: parsed.data.data_avaliacao,
    peso_kg: parsed.data.peso_kg,
    altura_cm: parsed.data.altura_cm,
    circunferencia_cintura_cm: parsed.data.circunferencia_cintura_cm ?? null,
    circunferencia_quadril_cm: parsed.data.circunferencia_quadril_cm ?? null,
    circunferencia_braco_cm: parsed.data.circunferencia_braco_cm ?? null,
    circunferencia_coxa_cm: parsed.data.circunferencia_coxa_cm ?? null,
    circunferencia_pescoco_cm: parsed.data.circunferencia_pescoco_cm ?? null,
    percentual_gordura: parsed.data.percentual_gordura ?? null,
    observacoes: parsed.data.observacoes || null,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/pacientes/${patientId}`);
  return { success: true, message: "Avaliação registrada com sucesso." };
}

/** Soft delete — ver comentário equivalente em deletePatient. */
export async function updateAssessment(
  assessmentId: string,
  patientId: string,
  input: AssessmentInput
): Promise<ActionResult> {
  const parsed = assessmentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Verifique os valores informados." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("anthropometric_assessments")
    .update({
      data_avaliacao: parsed.data.data_avaliacao,
      peso_kg: parsed.data.peso_kg,
      altura_cm: parsed.data.altura_cm,
      circunferencia_cintura_cm: parsed.data.circunferencia_cintura_cm ?? null,
      circunferencia_quadril_cm: parsed.data.circunferencia_quadril_cm ?? null,
      circunferencia_braco_cm: parsed.data.circunferencia_braco_cm ?? null,
      circunferencia_coxa_cm: parsed.data.circunferencia_coxa_cm ?? null,
      circunferencia_pescoco_cm: parsed.data.circunferencia_pescoco_cm ?? null,
      percentual_gordura: parsed.data.percentual_gordura ?? null,
      observacoes: parsed.data.observacoes || null,
    })
    .eq("id", assessmentId)
    .eq("patient_id", patientId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/pacientes/${patientId}`);
  return { success: true, message: "Avaliação atualizada com sucesso." };
}

/** Soft delete via função `security definer` (migration 0017) — ver comentário em deleteRecipe (recipes.ts). */
export async function deleteAssessment(patientId: string, assessmentId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("soft_delete_assessment", { assessment_id: assessmentId });

  if (error) {
    return { success: false, message: error.message };
  }
  if (!data) {
    return { success: false, message: "Avaliação não encontrada." };
  }

  revalidatePath(`/pacientes/${patientId}`);
  return { success: true };
}
