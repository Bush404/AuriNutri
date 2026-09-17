"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mealSchema, type MealInput } from "@/lib/validations/meal-plan";
import type { ActionResult } from "@/lib/actions/patients";

export async function createMeal(planId: string, input: MealInput, ordem: number): Promise<ActionResult> {
  const parsed = mealSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Informe o nome da refeição." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  const { error } = await supabase.from("meals").insert({
    meal_plan_id: planId,
    user_id: user.id,
    nome: parsed.data.nome,
    horario: parsed.data.horario || null,
    ordem,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/planos/${planId}`);
  return { success: true, message: "Refeição adicionada." };
}

export async function updateMeal(planId: string, mealId: string, input: MealInput): Promise<ActionResult> {
  const parsed = mealSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Informe o nome da refeição." };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("meals")
    .update({ nome: parsed.data.nome, horario: parsed.data.horario || null })
    .eq("id", mealId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/planos/${planId}`);
  return { success: true, message: "Refeição atualizada." };
}

/** Soft delete — ver comentário equivalente em deletePatient (patients.ts). */
export async function deleteMeal(planId: string, mealId: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from("meals").update({ deleted_at: new Date().toISOString() }).eq("id", mealId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/planos/${planId}`);
  return { success: true };
}
