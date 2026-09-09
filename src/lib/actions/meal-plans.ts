"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { mealPlanSchema, type MealPlanInput } from "@/lib/validations/meal-plan";
import type { ActionResult } from "@/lib/actions/patients";

export async function createMealPlan(patientId: string, input: MealPlanInput): Promise<ActionResult> {
  const parsed = mealPlanSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Verifique os dados do plano." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  const { data, error } = await supabase
    .from("meal_plans")
    .insert({
      patient_id: patientId,
      user_id: user.id,
      nome: parsed.data.nome,
      data_inicio: parsed.data.data_inicio,
      observacoes: parsed.data.observacoes || null,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/pacientes/${patientId}`);
  revalidatePath("/planos");
  redirect(`/planos/${data.id}`);
}

export async function updateMealPlan(planId: string, input: MealPlanInput): Promise<ActionResult> {
  const parsed = mealPlanSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Verifique os dados do plano." };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("meal_plans")
    .update({
      nome: parsed.data.nome,
      data_inicio: parsed.data.data_inicio,
      observacoes: parsed.data.observacoes || null,
    })
    .eq("id", planId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/planos/${planId}`);
  revalidatePath("/planos");
  return { success: true, message: "Plano atualizado com sucesso." };
}

export async function toggleMealPlanStatus(planId: string, ativo: boolean): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from("meal_plans").update({ ativo }).eq("id", planId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/planos/${planId}`);
  revalidatePath("/planos");
  return { success: true };
}

export async function deleteMealPlan(planId: string, patientId: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from("meal_plans").delete().eq("id", planId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/pacientes/${patientId}`);
  revalidatePath("/planos");
  return { success: true };
}
