"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mealItemSubstitutionSchema, type MealItemSubstitutionInput } from "@/lib/validations/meal-plan";
import type { ActionResult } from "@/lib/actions/patients";
import type { Food } from "@/lib/types/database.types";
import { buildFoodSnapshot } from "@/lib/nutrition";

/**
 * Adiciona um alimento equivalente/substituto a um item de refeição real.
 * Assim como em addMealItem, o snapshot é tirado do alimento AGORA (nunca
 * recalculado depois) — a substituição sugerida não muda se o alimento for
 * editado ou excluído posteriormente.
 */
export async function addMealItemSubstitution(
  planId: string,
  mealItemId: string,
  input: MealItemSubstitutionInput
): Promise<ActionResult> {
  const parsed = mealItemSubstitutionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Selecione um alimento e informe a quantidade." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  const { data: food, error: foodError } = await supabase
    .from("foods")
    .select("*")
    .eq("id", parsed.data.food_id)
    .single<Food>();

  if (foodError || !food) {
    return { success: false, message: "Alimento não encontrado." };
  }

  const { error } = await supabase.from("meal_item_substitutions").insert({
    meal_item_id: mealItemId,
    food_id: food.id,
    user_id: user.id,
    quantidade_g: parsed.data.quantidade_g,
    ordem: 0,
    ...buildFoodSnapshot(food),
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/planos/${planId}`);
  return { success: true, message: "Equivalente adicionado." };
}

export async function deleteMealItemSubstitution(planId: string, substitutionId: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from("meal_item_substitutions").delete().eq("id", substitutionId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/planos/${planId}`);
  return { success: true };
}
