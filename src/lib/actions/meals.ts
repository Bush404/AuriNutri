"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mealSchema, type MealInput } from "@/lib/validations/meal-plan";
import type { ActionResult } from "@/lib/actions/patients";
import type { Food } from "@/lib/types/database.types";
import { buildFoodSnapshot } from "@/lib/nutrition";

export async function createMeal(planId: string, input: MealInput, ordem: number): Promise<ActionResult> {
  const parsed = mealSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Informe o nome da refeição." };
  }

  const supabase = await createClient();
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
    observacoes: parsed.data.observacoes || null,
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

  const supabase = await createClient();
  const { error } = await supabase
    .from("meals")
    .update({
      nome: parsed.data.nome,
      horario: parsed.data.horario || null,
      observacoes: parsed.data.observacoes || null,
    })
    .eq("id", mealId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/planos/${planId}`);
  return { success: true, message: "Refeição atualizada." };
}

/**
 * Cria uma refeição já populada a partir de um template salvo. O snapshot
 * nutricional de cada item é gerado agora, a partir do alimento ATUAL (mesma
 * lógica de addMealItem via buildFoodSnapshot) — nunca fica guardado no
 * template em si. Itens cujo alimento original foi excluído são ignorados.
 */
export async function createMealFromTemplate(
  planId: string,
  templateId: string,
  input: MealInput,
  ordem: number
): Promise<ActionResult> {
  const parsed = mealSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Informe o nome da refeição." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  const { data: newMeal, error: mealError } = await supabase
    .from("meals")
    .insert({
      meal_plan_id: planId,
      user_id: user.id,
      nome: parsed.data.nome,
      horario: parsed.data.horario || null,
      observacoes: parsed.data.observacoes || null,
      ordem,
    })
    .select("id")
    .single<{ id: string }>();

  if (mealError || !newMeal) {
    return { success: false, message: mealError?.message ?? "Falha ao criar a refeição." };
  }

  const { data: templateItems, error: templateItemsError } = await supabase
    .from("meal_template_items")
    .select("*, foods(*)")
    .eq("meal_template_id", templateId)
    .order("ordem", { ascending: true })
    .returns<Array<{ quantidade_g: number; foods: Food | null }>>();

  if (templateItemsError) {
    return { success: false, message: templateItemsError.message };
  }

  const rows = (templateItems ?? [])
    .filter((item): item is { quantidade_g: number; foods: Food } => item.foods !== null)
    .map((item, index) => ({
      meal_id: newMeal.id,
      food_id: item.foods.id,
      user_id: user.id,
      quantidade_g: item.quantidade_g,
      ordem: index,
      ...buildFoodSnapshot(item.foods),
    }));

  if (rows.length > 0) {
    const { error: itemsError } = await supabase.from("meal_items").insert(rows);
    if (itemsError) {
      return { success: false, message: itemsError.message };
    }
  }

  revalidatePath(`/planos/${planId}`);
  return {
    success: true,
    message: rows.length > 0 ? `Refeição criada com ${rows.length} item(ns) do template.` : "Refeição criada (template estava sem itens válidos).",
  };
}

/** Soft delete via função `security definer` (migration 0017) — ver comentário em deleteRecipe (recipes.ts). */
export async function deleteMeal(planId: string, mealId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("soft_delete_meal", { meal_id: mealId });

  if (error) {
    return { success: false, message: error.message };
  }
  if (!data) {
    return { success: false, message: "Refeição não encontrada." };
  }

  revalidatePath(`/planos/${planId}`);
  return { success: true };
}
