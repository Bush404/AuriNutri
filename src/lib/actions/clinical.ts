"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { anamnesisSchema, assessmentSchema, type AnamnesisInput, type AssessmentInput } from "@/lib/validations/patient";
import type { ActionResult } from "@/lib/actions/patients";

function emptyToNull<T extends Record<string, unknown>>(obj: T) {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = value === "" || value === undefined ? null : value;
  }
  return result;
}

/**
 * Cria um NOVO registro de anamnese. anamnesis é 1:N por paciente (histórico
 * clínico) — isto nunca sobrescreve um registro anterior.
 */
export async function createAnamnesis(patientId: string, input: AnamnesisInput): Promise<ActionResult> {
  const parsed = anamnesisSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Dados inválidos. Verifique o formulário." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  const { error } = await supabase.from("anamnesis").insert({
    patient_id: patientId,
    user_id: user.id,
    ...emptyToNull(parsed.data),
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/pacientes/${patientId}`);
  return { success: true, message: "Anamnese registrada com sucesso." };
}

/** Corrige um registro de anamnese específico já existente (não cria um novo). */
export async function updateAnamnesis(
  anamnesisId: string,
  patientId: string,
  input: AnamnesisInput
): Promise<ActionResult> {
  const parsed = anamnesisSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Dados inválidos. Verifique o formulário." };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("anamnesis")
    .update(emptyToNull(parsed.data))
    .eq("id", anamnesisId)
    .eq("patient_id", patientId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/pacientes/${patientId}`);
  return { success: true, message: "Anamnese atualizada com sucesso." };
}

export async function createAssessment(patientId: string, input: AssessmentInput): Promise<ActionResult> {
  const parsed = assessmentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Verifique os valores informados." };
  }

  const supabase = createClient();
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

  const supabase = createClient();
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
  const supabase = createClient();

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
