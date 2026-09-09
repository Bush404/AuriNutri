"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { foodSchema, type FoodInput } from "@/lib/validations/food";
import type { ActionResult } from "@/lib/actions/patients";
import type { Food } from "@/lib/types/database.types";

export async function createFood(input: FoodInput): Promise<ActionResult> {
  const parsed = foodSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Verifique os valores informados." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  // Todo alimento criado pela interface é sempre pessoal — alimentos globais
  // (TACO) só entram no banco via o script de importação (service role).
  const { error } = await supabase.from("foods").insert({
    user_id: user.id,
    fonte: "personalizado",
    fonte_descricao: "Cadastro próprio do nutricionista",
    is_global: false,
    nome: parsed.data.nome,
    categoria: parsed.data.categoria,
    marca: parsed.data.marca || null,
    porcao_referencia_g: parsed.data.porcao_referencia_g,
    calorias_kcal: parsed.data.calorias_kcal,
    proteinas_g: parsed.data.proteinas_g,
    carboidratos_g: parsed.data.carboidratos_g,
    gorduras_g: parsed.data.gorduras_g,
    fibras_g: parsed.data.fibras_g ?? 0,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/alimentos");
  return { success: true, message: "Alimento cadastrado com sucesso." };
}

/** Busca o alimento e garante que ele é pessoal (não-TACO) e pertence ao usuário atual. */
async function getOwnedEditableFood(foodId: string): Promise<
  | { ok: true; food: Pick<Food, "id" | "user_id" | "is_global"> }
  | { ok: false; message: string }
> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sessão expirada. Faça login novamente." };
  }

  const { data: food } = await supabase
    .from("foods")
    .select("id, user_id, is_global")
    .eq("id", foodId)
    .maybeSingle<{ id: string; user_id: string | null; is_global: boolean }>();

  if (!food) {
    return { ok: false, message: "Alimento não encontrado." };
  }

  if (food.is_global || food.user_id !== user.id) {
    return {
      ok: false,
      message: "Alimentos da base TACO são somente leitura e não podem ser editados ou excluídos.",
    };
  }

  return { ok: true, food };
}

export async function updateFood(foodId: string, input: FoodInput): Promise<ActionResult> {
  const parsed = foodSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Verifique os valores informados." };
  }

  const ownership = await getOwnedEditableFood(foodId);
  if (!ownership.ok) {
    return { success: false, message: ownership.message };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("foods")
    .update({
      nome: parsed.data.nome,
      categoria: parsed.data.categoria,
      marca: parsed.data.marca || null,
      porcao_referencia_g: parsed.data.porcao_referencia_g,
      calorias_kcal: parsed.data.calorias_kcal,
      proteinas_g: parsed.data.proteinas_g,
      carboidratos_g: parsed.data.carboidratos_g,
      gorduras_g: parsed.data.gorduras_g,
      fibras_g: parsed.data.fibras_g ?? 0,
    })
    .eq("id", foodId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/alimentos");
  return { success: true, message: "Alimento atualizado com sucesso." };
}

export async function deleteFood(foodId: string): Promise<ActionResult> {
  const ownership = await getOwnedEditableFood(foodId);
  if (!ownership.ok) {
    return { success: false, message: ownership.message };
  }

  const supabase = createClient();
  const { error } = await supabase.from("foods").delete().eq("id", foodId);

  if (error) {
    return { success: false, message: error.message };
  }

  // Não há mais bloqueio por "alimento em uso": itens de refeição já
  // guardam seu próprio snapshot nutricional, então planos antigos
  // continuam intactos mesmo depois desta exclusão.
  revalidatePath("/alimentos");
  return { success: true, message: "Alimento excluído com sucesso." };
}

export interface FoodPickerGroup {
  meus: Food[];
  taco: Food[];
}

/**
 * Busca alimentos para o seletor do construtor de plano alimentar,
 * já separados por origem (alimentos do próprio nutricionista primeiro,
 * depois a base TACO), respeitando RLS automaticamente.
 */
export async function searchFoodsForPicker(query: string): Promise<FoodPickerGroup> {
  const supabase = createClient();
  const termo = query.trim();

  let meusQuery = supabase.from("foods").select("*").eq("is_global", false).order("nome").limit(8);
  let tacoQuery = supabase.from("foods").select("*").eq("is_global", true).order("nome").limit(8);

  if (termo) {
    meusQuery = meusQuery.ilike("nome", `%${termo}%`);
    tacoQuery = tacoQuery.ilike("nome", `%${termo}%`);
  }

  const [{ data: meus }, { data: taco }] = await Promise.all([meusQuery, tacoQuery]);

  return { meus: meus ?? [], taco: taco ?? [] };
}
