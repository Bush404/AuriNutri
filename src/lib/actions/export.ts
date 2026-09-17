"use server";

import { createClient } from "@/lib/supabase/server";
import type { Anamnesis, AnthropometricAssessment, Meal, MealItem, MealPlan, Patient } from "@/lib/types/database.types";

export interface PatientExport {
  exportado_em: string;
  paciente: Patient;
  anamneses: Anamnesis[];
  avaliacoes_antropometricas: AnthropometricAssessment[];
  planos_alimentares: Array<MealPlan & { refeicoes: Array<Meal & { itens: MealItem[] }> }>;
}

export type ExportPatientDataResult = { success: true; data: PatientExport } | { success: false; message: string };

/**
 * Exportação de portabilidade (LGPD art. 18) — reúne todo o cadastro,
 * histórico clínico e planos de um paciente num único objeto. Cada query
 * já é implicitamente restrita pela RLS (auth.uid() = user_id), então um
 * profissional nunca consegue exportar dados de paciente de outro.
 */
export async function exportPatientData(patientId: string): Promise<ExportPatientDataResult> {
  const supabase = createClient();

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .single<Patient>();

  if (patientError || !patient) {
    return { success: false, message: "Paciente não encontrado." };
  }

  const [{ data: anamneses }, { data: assessments }, { data: mealPlans }] = await Promise.all([
    supabase
      .from("anamnesis")
      .select("*")
      .eq("patient_id", patientId)
      .order("data_registro", { ascending: false })
      .returns<Anamnesis[]>(),
    supabase
      .from("anthropometric_assessments")
      .select("*")
      .eq("patient_id", patientId)
      .order("data_avaliacao", { ascending: false })
      .returns<AnthropometricAssessment[]>(),
    supabase
      .from("meal_plans")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .returns<MealPlan[]>(),
  ]);

  const planosComRefeicoes = await Promise.all(
    (mealPlans ?? []).map(async (plan) => {
      const { data: meals } = await supabase
        .from("meals")
        .select("*")
        .eq("meal_plan_id", plan.id)
        .order("ordem", { ascending: true })
        .returns<Meal[]>();

      const mealsComItens = await Promise.all(
        (meals ?? []).map(async (meal) => {
          const { data: items } = await supabase
            .from("meal_items")
            .select("*")
            .eq("meal_id", meal.id)
            .order("ordem", { ascending: true })
            .returns<MealItem[]>();

          return { ...meal, itens: items ?? [] };
        })
      );

      return { ...plan, refeicoes: mealsComItens };
    })
  );

  return {
    success: true,
    data: {
      exportado_em: new Date().toISOString(),
      paciente: patient,
      anamneses: anamneses ?? [],
      avaliacoes_antropometricas: assessments ?? [],
      planos_alimentares: planosComRefeicoes,
    },
  };
}
