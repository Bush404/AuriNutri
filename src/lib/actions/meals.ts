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
      // As observações têm editor próprio na refeição aberta (Fase 17); só mexe nelas se vierem.
      ...("observacoes" in input ? { observacoes: parsed.data.observacoes || null } : {}),
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

/**
 * Duplicar uma refeição (Fase 17, botão da linha da refeição): a cópia entra
 * logo abaixo da original, com os alimentos e as substituições copiados como
 * estão — o snapshot nutricional inteiro (inclusive micronutrientes e fonte),
 * nunca recalculado a partir do alimento atual.
 */
export async function duplicateMeal(planId: string, mealId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Sessão expirada. Faça login novamente." };

  type Linha = Record<string, unknown> & { id: string };
  const { data: original } = await supabase
    .from("meals")
    .select("*, meal_items(*, meal_item_substitutions(*))")
    .eq("id", mealId)
    .eq("meal_plan_id", planId)
    .maybeSingle<
      Linha & { ordem: number; nome: string; meal_items: (Linha & { meal_item_substitutions: Linha[] })[] }
    >();
  if (!original) return { success: false, message: "Refeição não encontrada." };

  // Abre espaço logo abaixo da original.
  const { data: seguintes } = await supabase
    .from("meals")
    .select("id, ordem")
    .eq("meal_plan_id", planId)
    .gt("ordem", original.ordem)
    .returns<{ id: string; ordem: number }[]>();
  for (const m of seguintes ?? []) {
    await supabase.from("meals").update({ ordem: m.ordem + 1 }).eq("id", m.id);
  }

  const semControle = <T extends Linha>(row: T, ...extras: string[]) => {
    const copia: Record<string, unknown> = { ...row };
    for (const k of ["id", "created_at", "updated_at", "deleted_at", ...extras]) delete copia[k];
    return copia;
  };

  const { data: nova, error } = await supabase
    .from("meals")
    .insert({
      ...semControle(original, "meal_items"),
      nome: `${original.nome} (cópia)`.slice(0, 120),
      ordem: original.ordem + 1,
      user_id: user.id,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !nova) return { success: false, message: error?.message ?? "Falha ao duplicar a refeição." };

  for (const item of (original.meal_items ?? []).filter((i) => !i.deleted_at)) {
    const { data: novoItem, error: itemError } = await supabase
      .from("meal_items")
      .insert({ ...semControle(item, "meal_item_substitutions"), meal_id: nova.id, user_id: user.id })
      .select("id")
      .single<{ id: string }>();
    if (itemError || !novoItem) return { success: false, message: itemError?.message ?? "Falha ao copiar um alimento." };

    const subs = (item.meal_item_substitutions ?? []).filter((s) => !s.deleted_at);
    if (subs.length) {
      const { error: subError } = await supabase
        .from("meal_item_substitutions")
        .insert(subs.map((s) => ({ ...semControle(s), meal_item_id: novoItem.id, user_id: user.id })));
      if (subError) return { success: false, message: subError.message };
    }
  }

  revalidatePath(`/planos/${planId}`);
  return { success: true, message: "Refeição duplicada." };
}

/** Nova ordem das refeições (arrastar na "Rotina do paciente"): `ids` na ordem em que devem ficar. */
export async function reorderMeals(planId: string, ids: string[]): Promise<ActionResult> {
  if (!ids.length || ids.length > 50) return { success: false, message: "Ordem inválida." };
  const supabase = await createClient();
  const resultados = await Promise.all(
    ids.map((id, ordem) => supabase.from("meals").update({ ordem }).eq("id", id).eq("meal_plan_id", planId))
  );
  const erro = resultados.find((r) => r.error)?.error;
  if (erro) return { success: false, message: erro.message };
  revalidatePath(`/planos/${planId}`);
  return { success: true };
}

/** "Reordenar por horário": refeições com horário primeiro, do mais cedo ao mais tarde; sem horário no fim, na ordem atual. */
export async function reorderMealsByTime(planId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: meals, error } = await supabase
    .from("meals")
    .select("id, horario, ordem")
    .eq("meal_plan_id", planId)
    .returns<{ id: string; horario: string | null; ordem: number }[]>();
  if (error) return { success: false, message: error.message };
  const ordenadas = (meals ?? []).slice().sort((a, b) => {
    if (a.horario && b.horario) return a.horario.localeCompare(b.horario) || a.ordem - b.ordem;
    if (a.horario) return -1;
    if (b.horario) return 1;
    return a.ordem - b.ordem;
  });
  return reorderMeals(
    planId,
    ordenadas.map((m) => m.id)
  );
}
