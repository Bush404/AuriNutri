"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mealItemSchema, type MealItemInput } from "@/lib/validations/meal-plan";
import type { ActionResult } from "@/lib/actions/patients";
import type { Food } from "@/lib/types/database.types";

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
    // Snapshot nutricional:
    nome_alimento: food.nome,
    fonte_alimento: food.fonte,
    fonte_descricao_alimento: food.fonte_descricao,
    porcao_referencia_g: food.porcao_referencia_g,
    calorias_kcal: food.calorias_kcal ?? 0,
    proteinas_g: food.proteinas_g ?? 0,
    carboidratos_g: food.carboidratos_g ?? 0,
    gorduras_g: food.gorduras_g ?? 0,
    fibras_g: food.fibras_g ?? 0,
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

/** Soft delete — ver comentário equivalente em deletePatient (patients.ts). */
export async function deleteMealItem(planId: string, itemId: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase
    .from("meal_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", itemId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/planos/${planId}`);
  return { success: true };
}
