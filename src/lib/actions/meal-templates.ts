"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mealTemplateNameSchema, type MealTemplateNameInput } from "@/lib/validations/meal-plan";
import type { ActionResult } from "@/lib/actions/patients";
import type { MealItem, MealTemplate } from "@/lib/types/database.types";

export interface MealTemplateWithCount extends MealTemplate {
  item_count: number;
}

/** Lista os templates do profissional autenticado (RLS já restringe a auth.uid() = user_id). */
export async function listMealTemplates(): Promise<MealTemplateWithCount[]> {
  const supabase = createClient();

  const { data: templates } = await supabase
    .from("meal_templates")
    .select("*")
    .order("nome", { ascending: true })
    .returns<MealTemplate[]>();

  if (!templates || templates.length === 0) return [];

  const { data: items } = await supabase
    .from("meal_template_items")
    .select("meal_template_id")
    .in(
      "meal_template_id",
      templates.map((t) => t.id)
    )
    .returns<{ meal_template_id: string }[]>();

  const counts = new Map<string, number>();
  for (const item of items ?? []) {
    counts.set(item.meal_template_id, (counts.get(item.meal_template_id) ?? 0) + 1);
  }

  return templates.map((template) => ({ ...template, item_count: counts.get(template.id) ?? 0 }));
}

/**
 * Salva os itens ATUAIS de uma refeição já montada como um novo template
 * reutilizável. Guarda só food_id + quantidade — NÃO copia o snapshot
 * nutricional do meal_item (ver decisão de arquitetura na migration 0008).
 * Itens cujo alimento original já foi excluído (food_id nulo) são ignorados.
 */
export async function saveMealAsTemplate(mealId: string, input: MealTemplateNameInput): Promise<ActionResult> {
  const parsed = mealTemplateNameSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Informe um nome para o template." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  const { data: items, error: itemsError } = await supabase
    .from("meal_items")
    .select("*")
    .eq("meal_id", mealId)
    .order("ordem", { ascending: true })
    .returns<MealItem[]>();

  if (itemsError) {
    return { success: false, message: itemsError.message };
  }

  const itensValidos = (items ?? []).filter((item) => item.food_id !== null);
  if (itensValidos.length === 0) {
    return { success: false, message: "Essa refeição não tem itens com alimento válido para salvar como template." };
  }

  const { data: template, error: templateError } = await supabase
    .from("meal_templates")
    .insert({ user_id: user.id, nome: parsed.data.nome })
    .select("id")
    .single<{ id: string }>();

  if (templateError || !template) {
    return { success: false, message: templateError?.message ?? "Falha ao criar o template." };
  }

  const { error: templateItemsError } = await supabase.from("meal_template_items").insert(
    itensValidos.map((item, index) => ({
      meal_template_id: template.id,
      food_id: item.food_id,
      user_id: user.id,
      quantidade_g: item.quantidade_g,
      ordem: index,
    }))
  );

  if (templateItemsError) {
    return { success: false, message: templateItemsError.message };
  }

  revalidatePath("/planos");
  return { success: true, message: `Template "${parsed.data.nome}" salvo com ${itensValidos.length} item(ns).` };
}

export async function deleteMealTemplate(templateId: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from("meal_templates").delete().eq("id", templateId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/planos");
  return { success: true };
}
