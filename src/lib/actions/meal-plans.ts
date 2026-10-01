"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { mealPlanSchema, planejamentoSchema, type MealPlanInput, type PlanejamentoInput } from "@/lib/validations/meal-plan";
import { distribuirMacros } from "@/lib/meal-planning";
import type { ActionResult } from "@/lib/actions/patients";
import type { Meal, MealItem, MealPlan } from "@/lib/types/database.types";

export async function createMealPlan(patientId: string, input: MealPlanInput): Promise<ActionResult> {
  const parsed = mealPlanSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Verifique os dados do plano." };
  }

  const supabase = await createClient();
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
      meta_kcal: parsed.data.meta_kcal ?? null,
      meta_proteinas_g: parsed.data.meta_proteinas_g ?? null,
      meta_carboidratos_g: parsed.data.meta_carboidratos_g ?? null,
      meta_gorduras_g: parsed.data.meta_gorduras_g ?? null,
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

  const supabase = await createClient();
  const { error } = await supabase
    .from("meal_plans")
    .update({
      nome: parsed.data.nome,
      data_inicio: parsed.data.data_inicio,
      observacoes: parsed.data.observacoes || null,
      meta_kcal: parsed.data.meta_kcal ?? null,
      meta_proteinas_g: parsed.data.meta_proteinas_g ?? null,
      meta_carboidratos_g: parsed.data.meta_carboidratos_g ?? null,
      meta_gorduras_g: parsed.data.meta_gorduras_g ?? null,
    })
    .eq("id", planId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/planos/${planId}`);
  revalidatePath("/planos");
  return { success: true, message: "Plano atualizado com sucesso." };
}

/**
 * "Adicionar planejamento teórico" (Fase 17, Bloco A). Os gramas e o GET são
 * recalculados AQUI (não confia na tela) e gravados nas metas do plano
 * (migration 0007); o modo e os valores digitados ficam em planejamento_*
 * (migration 0043) para a janela reabrir igual.
 */
export async function salvarPlanejamentoTeorico(planId: string, input: PlanejamentoInput): Promise<ActionResult> {
  const parsed = planejamentoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Verifique os valores do planejamento." };
  }
  const d = parsed.data;
  const r = distribuirMacros({
    modo: d.modo,
    pesoKg: d.peso_kg ?? null,
    getKcal: d.get_kcal ?? null,
    proteinas: d.proteinas,
    lipidios: d.lipidios,
    carboidratos: d.carboidratos,
  });
  if (!r.ok) return { success: false, message: r.motivo };

  const arred = (v: number) => Math.round(v * 10) / 10;
  const supabase = await createClient();
  const { error } = await supabase
    .from("meal_plans")
    .update({
      meta_kcal: Math.round(r.metas.kcal),
      meta_proteinas_g: arred(r.metas.proteinas_g),
      meta_gorduras_g: arred(r.metas.lipidios_g),
      meta_carboidratos_g: arred(r.metas.carboidratos_g),
      planejamento_modo: d.modo,
      planejamento_peso_kg: d.peso_kg ?? null,
      planejamento_proteinas: d.proteinas,
      planejamento_lipidios: d.lipidios,
      planejamento_carboidratos: d.carboidratos,
      planejamento_calculo_id: d.calculo_id ?? null,
    })
    .eq("id", planId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/planos/${planId}`);
  return { success: true, message: "Planejamento teórico salvo." };
}

/** Tira o planejamento teórico (e as metas) do plano. */
export async function removerPlanejamentoTeorico(planId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("meal_plans")
    .update({
      meta_kcal: null,
      meta_proteinas_g: null,
      meta_gorduras_g: null,
      meta_carboidratos_g: null,
      planejamento_modo: null,
      planejamento_peso_kg: null,
      planejamento_proteinas: null,
      planejamento_lipidios: null,
      planejamento_carboidratos: null,
      planejamento_calculo_id: null,
    })
    .eq("id", planId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/planos/${planId}`);
  return { success: true, message: "Planejamento teórico removido." };
}

export async function toggleMealPlanStatus(
  planId: string,
  ativo: boolean,
  patientId?: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("meal_plans").update({ ativo }).eq("id", planId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/planos/${planId}`);
  revalidatePath("/planos");
  if (patientId) revalidatePath(`/pacientes/${patientId}`);
  return { success: true };
}

/**
 * Duplica um plano inteiro (plano + refeições + itens) para o mesmo
 * paciente. DECISÃO: copia os snapshots nutricionais VERBATIM — nunca
 * rebusca os valores atuais do alimento em `foods`. O profissional edita
 * depois o que quiser na cópia, sem afetar o plano original.
 */
export async function duplicateMealPlan(planId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  const { data: originalPlan, error: planError } = await supabase
    .from("meal_plans")
    .select("*")
    .eq("id", planId)
    .single<MealPlan>();

  if (planError || !originalPlan) {
    return { success: false, message: "Plano não encontrado." };
  }

  const { data: originalMeals, error: mealsError } = await supabase
    .from("meals")
    .select("*, meal_items(*)")
    .eq("meal_plan_id", planId)
    .order("ordem", { ascending: true })
    .returns<Array<Meal & { meal_items: MealItem[] }>>();

  if (mealsError) {
    return { success: false, message: mealsError.message };
  }

  const { data: newPlan, error: newPlanError } = await supabase
    .from("meal_plans")
    .insert({
      patient_id: originalPlan.patient_id,
      user_id: user.id,
      nome: `${originalPlan.nome} (cópia)`,
      data_inicio: new Date().toISOString().slice(0, 10),
      observacoes: originalPlan.observacoes,
      meta_kcal: originalPlan.meta_kcal,
      meta_proteinas_g: originalPlan.meta_proteinas_g,
      meta_carboidratos_g: originalPlan.meta_carboidratos_g,
      meta_gorduras_g: originalPlan.meta_gorduras_g,
      planejamento_modo: originalPlan.planejamento_modo,
      planejamento_peso_kg: originalPlan.planejamento_peso_kg,
      planejamento_proteinas: originalPlan.planejamento_proteinas,
      planejamento_lipidios: originalPlan.planejamento_lipidios,
      planejamento_carboidratos: originalPlan.planejamento_carboidratos,
      planejamento_calculo_id: originalPlan.planejamento_calculo_id,
    })
    .select("id")
    .single<{ id: string }>();

  if (newPlanError || !newPlan) {
    return { success: false, message: newPlanError?.message ?? "Falha ao duplicar o plano." };
  }

  for (const meal of originalMeals ?? []) {
    const { data: newMeal, error: newMealError } = await supabase
      .from("meals")
      .insert({
        meal_plan_id: newPlan.id,
        user_id: user.id,
        nome: meal.nome,
        horario: meal.horario,
        observacoes: meal.observacoes,
        ordem: meal.ordem,
      })
      .select("id")
      .single<{ id: string }>();

    if (newMealError || !newMeal) {
      return { success: false, message: newMealError?.message ?? "Falha ao duplicar uma refeição." };
    }

    const items = (meal.meal_items ?? []).slice().sort((a, b) => a.ordem - b.ordem);
    if (items.length === 0) continue;

    // Snapshot copiado verbatim — inclusive fonte_alimento e
    // fonte_descricao_alimento, para a atribuição da TACO continuar correta
    // na cópia mesmo que o alimento/receita original seja editado depois.
    // recipe_id/quantidade_porcoes/fontes_ingredientes_receita também
    // precisam ser copiados (não só food_id): um item de receita não tem
    // food_id, e o CHECK meal_items_food_or_recipe_check exige exatamente
    // um dos dois preenchidos.
    const { error: itemsError } = await supabase.from("meal_items").insert(
      items.map((item) => ({
        meal_id: newMeal.id,
        food_id: item.food_id,
        recipe_id: item.recipe_id,
        user_id: user.id,
        quantidade_g: item.quantidade_g,
        quantidade_porcoes: item.quantidade_porcoes,
        ordem: item.ordem,
        nome_alimento: item.nome_alimento,
        fonte_alimento: item.fonte_alimento,
        fonte_descricao_alimento: item.fonte_descricao_alimento,
        porcao_referencia_g: item.porcao_referencia_g,
        calorias_kcal: item.calorias_kcal,
        proteinas_g: item.proteinas_g,
        carboidratos_g: item.carboidratos_g,
        gorduras_g: item.gorduras_g,
        fibras_g: item.fibras_g,
        fontes_ingredientes_receita: item.fontes_ingredientes_receita,
      }))
    );

    if (itemsError) {
      return { success: false, message: itemsError.message };
    }
  }

  revalidatePath(`/pacientes/${originalPlan.patient_id}`);
  revalidatePath("/planos");
  redirect(`/planos/${newPlan.id}`);
}

/** Soft delete via função `security definer` (migration 0017) — ver comentário em deleteRecipe (recipes.ts). */
export async function deleteMealPlan(planId: string, patientId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("soft_delete_meal_plan", { plan_id: planId });

  if (error) {
    return { success: false, message: error.message };
  }
  if (!data) {
    return { success: false, message: "Plano não encontrado." };
  }

  revalidatePath(`/pacientes/${patientId}`);
  revalidatePath("/planos");
  return { success: true };
}
