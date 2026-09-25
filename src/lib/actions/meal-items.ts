"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mealItemSchema, mealItemRecipeSchema, type MealItemInput, type MealItemRecipeInput } from "@/lib/validations/meal-plan";
import type { ActionResult } from "@/lib/actions/patients";
import type { Food, Recipe, RecipeIngredient } from "@/lib/types/database.types";
import { buildFoodSnapshot, buildRecipeSnapshot } from "@/lib/nutrition";

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

  const supabase = await createClient();
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

/**
 * Adiciona uma RECEITA como item de refeição (Fase 6, Bloco C) — mesmo
 * princípio de addMealItem, mas a quantidade é em PORÇÕES da receita, não em
 * gramas, e o snapshot vem de buildRecipeSnapshot (que já aplica eventuais
 * valores_sobrescritos da receita). quantidade_g é derivado aqui
 * (quantidade_porcoes * gramas por porção) só para o cálculo de macros
 * continuar funcionando sem mudança de fórmula — a UI sempre trabalha em
 * porções.
 */
export async function addMealItemRecipe(
  planId: string,
  mealId: string,
  input: MealItemRecipeInput,
  ordem: number
): Promise<ActionResult> {
  const parsed = mealItemRecipeSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Selecione uma receita e informe a quantidade em porções." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  const [{ data: recipe, error: recipeError }, { data: ingredients, error: ingredientsError }] = await Promise.all([
    supabase.from("recipes").select("*").eq("id", parsed.data.recipe_id).maybeSingle<Recipe>(),
    supabase
      .from("recipe_ingredients")
      .select("*")
      .eq("recipe_id", parsed.data.recipe_id)
      .returns<RecipeIngredient[]>(),
  ]);

  if (recipeError || !recipe) {
    return { success: false, message: "Receita não encontrada." };
  }
  if (recipe.rendimento_g === null || recipe.numero_porcoes === null) {
    return { success: false, message: "Essa receita ainda é um rascunho — finalize o cadastro antes de usá-la em um plano." };
  }
  if (ingredientsError || !ingredients || ingredients.length === 0) {
    return { success: false, message: "Essa receita ainda não tem ingredientes." };
  }

  const snapshot = buildRecipeSnapshot(recipe, ingredients);
  const quantidadeG = parsed.data.quantidade_porcoes * snapshot.porcao_referencia_g;

  const { error } = await supabase.from("meal_items").insert({
    meal_id: mealId,
    recipe_id: recipe.id,
    user_id: user.id,
    quantidade_g: quantidadeG,
    quantidade_porcoes: parsed.data.quantidade_porcoes,
    ordem,
    ...snapshot,
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

  const supabase = await createClient();
  const { error } = await supabase.from("meal_items").update({ quantidade_g }).eq("id", itemId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/planos/${planId}`);
  return { success: true };
}

/**
 * Equivalente a updateMealItemQuantity, mas para um item de RECEITA: recebe
 * a quantidade em porções e o `porcao_referencia_g` do próprio item (os
 * gramas por porção já gravados no snapshot, que a UI já tem em mãos) para
 * derivar quantidade_g — nunca busca a receita "ao vivo" de novo, então uma
 * edição da receita depois de adicionada ao plano não entra aqui.
 */
export async function updateMealItemPortions(
  planId: string,
  itemId: string,
  quantidade_porcoes: number,
  porcaoReferenciaG: number
): Promise<ActionResult> {
  if (!(quantidade_porcoes > 0)) {
    return { success: false, message: "A quantidade deve ser maior que zero." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("meal_items")
    .update({ quantidade_porcoes, quantidade_g: quantidade_porcoes * porcaoReferenciaG })
    .eq("id", itemId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/planos/${planId}`);
  return { success: true };
}

/** Soft delete via função `security definer` (migration 0017) — ver comentário em deleteRecipe (recipes.ts). */
export async function deleteMealItem(planId: string, itemId: string): Promise<ActionResult> {
  const supabase = await createClient();
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
