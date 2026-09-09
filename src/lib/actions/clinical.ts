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

export async function upsertAnamnesis(patientId: string, input: AnamnesisInput): Promise<ActionResult> {
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

  const { error } = await supabase
    .from("anamnesis")
    .upsert(
      {
        patient_id: patientId,
        user_id: user.id,
        ...emptyToNull(parsed.data),
      },
      { onConflict: "patient_id" }
    );

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/pacientes/${patientId}`);
  return { success: true, message: "Anamnese salva com sucesso." };
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

export async function deleteAssessment(patientId: string, assessmentId: string): Promise<ActionResult> {
  const supabase = createClient();

  const { error } = await supabase.from("anthropometric_assessments").delete().eq("id", assessmentId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/pacientes/${patientId}`);
  return { success: true };
}
