"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mealItemSchema, type MealItemInput } from "@/lib/validations/meal-plan";
import type { ActionResult } from "@/lib/actions/patients";
import type { Food } from "@/lib/types/database.types";
import { buildFoodSnapshot } from "@/lib/nutrition";

export async function addMealItem(
  planId: string,
  mealId: string,
  input: MealItemInput,
  ordem: number
): Promise<ActionResult> {
  const parsed = mealItemSchema.safeParse(input);
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

  // Busca o alimento (TACO ou pessoal — a RLS de `foods` já garante que só
  // vemos alimentos globais ou os nossos próprios) para tirar um SNAPSHOT
  // dos valores nutricionais no momento exato em que ele é adicionado.
  // Esse snapshot é o que fica salvo em `meal_items`, não uma referência
  // "ao vivo" — assim, edições futuras no alimento (ou sua exclusão) nunca
  // alteram planos alimentares já montados.
  const { data: food, error: foodError } = await supabase
    .from("foods")
    .select("*")
    .eq("id", parsed.data.food_id)
    .single<Food>();

  if (foodError || !food) {
    return { success: false, message: "Alimento não encontrado." };
  }

  const { error } = await supabase.from("meal_items").insert({
    meal_id: mealId,
    food_id: food.id,
    user_id: user.id,
    quantidade_g: parsed.data.quantidade_g,
    ordem,
    ...buildFoodSnapshot(food),
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/planos/${planId}`);
  return { success: true };
}

export async function updateMealItemQuantity(
  planId: string,
  itemId: string,
  quantidade_g: number
): Promise<ActionResult> {
  if (!(quantidade_g > 0)) {
    return { success: false, message: "A quantidade deve ser maior que zero." };
  }

  const supabase = createClient();
  const { error } = await supabase.from("meal_items").update({ quantidade_g }).eq("id", itemId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/planos/${planId}`);
  return { success: true };
}

/** Soft delete via função `security definer` (migration 0017) — ver comentário em deleteRecipe (recipes.ts). */
export async function deleteMealItem(planId: string, itemId: string): Promise<ActionResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("soft_delete_meal_item", { item_id: itemId });

  if (error) {
    return { success: false, message: error.message };
  }
  if (!data) {
    return { success: false, message: "Item não encontrado." };
  }

  revalidatePath(`/planos/${planId}`);
  return { success: true };
}
