"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mealItemSubstitutionSchema, type MealItemSubstitutionInput } from "@/lib/validations/meal-plan";
import type { ActionResult } from "@/lib/actions/patients";
import type { Food, MealItem, MealItemSubstitution } from "@/lib/types/database.types";
import { buildFoodSnapshot, calculateMealItemMacros, type MacroTotals } from "@/lib/nutrition";
import { buscarMedida, camposDaMedida, medidasPorAlimento } from "@/lib/food-measures-db";
import { medidaUsual } from "@/lib/household-measures";
import {
  arredondarQuantidade,
  ehIngrediente,
  gramasEquivalentes,
  macrosEm,
  mesmoEstado,
  pontuacaoSugestao,
  type CriterioEquivalencia,
} from "@/lib/substitutions";

/**
 * Adiciona um alimento equivalente/substituto a um item de refeição real.
 * Assim como em addMealItem, o snapshot é tirado do alimento AGORA (nunca
 * recalculado depois) — a substituição sugerida não muda se o alimento for
 * editado ou excluído posteriormente. Fase 17, Bloco E: pode vir em medida
 * caseira (também como cópia).
 */
export async function addMealItemSubstitution(
  planId: string,
  mealItemId: string,
  input: MealItemSubstitutionInput,
): Promise<ActionResult> {
  const parsed = mealItemSubstitutionSchema.safeParse(input);
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

  const { data: food, error: foodError } = await supabase
    .from("foods")
    .select("*")
    .eq("id", parsed.data.food_id)
    .single<Food>();

  if (foodError || !food) {
    return { success: false, message: "Alimento não encontrado." };
  }

  let quantidade: Record<string, number | string> = { quantidade_g: parsed.data.quantidade_g };
  if (parsed.data.medida_id) {
    const medida = await buscarMedida(supabase, parsed.data.medida_id, food.id);
    if (!medida) return { success: false, message: "Medida caseira não encontrada." };
    quantidade = camposDaMedida(medida, parsed.data.medida_quantidade ?? 1);
  }

  const { count } = await supabase
    .from("meal_item_substitutions")
    .select("id", { count: "exact", head: true })
    .eq("meal_item_id", mealItemId);

  const { error } = await supabase.from("meal_item_substitutions").insert({
    meal_item_id: mealItemId,
    food_id: food.id,
    user_id: user.id,
    ...quantidade,
    ordem: count ?? 0,
    ...buildFoodSnapshot(food),
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/planos/${planId}`);
  return { success: true, message: "Substituto adicionado." };
}

export async function deleteMealItemSubstitution(planId: string, substitutionId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("meal_item_substitutions").delete().eq("id", substitutionId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/planos/${planId}`);
  return { success: true };
}

export interface SugestaoSubstituto {
  foodId: string;
  nome: string;
  origem: "TACO" | "Seu alimento";
  medida: { id: string; nome: string; gramas: number } | null;
  medidaQuantidade: number | null;
  gramas: number;
  macros: MacroTotals;
}

const MAX_SUGESTOES = 6;

/**
 * "Sugestões rápidas" (Fase 17, Bloco E): alimentos do mesmo grupo da TACO
 * (ex.: "Cereais e derivados") e no mesmo estado (cru com cru), na quantidade
 * equivalente pelo critério escolhido, os mais parecidos nos outros macros
 * primeiro. Quantidades absurdas (mais de 4× ou menos de ¼ do original) ficam de fora.
 */
export async function sugerirSubstitutos(
  mealItemId: string,
  criterio: CriterioEquivalencia,
): Promise<SugestaoSubstituto[]> {
  const supabase = await createClient();
  const { data: item } = await supabase
    .from("meal_items")
    .select("*, meal_item_substitutions(food_id)")
    .eq("id", mealItemId)
    .maybeSingle<MealItem & { meal_item_substitutions: { food_id: string | null }[] }>();
  if (!item?.food_id) return [];

  const { data: original } = await supabase
    .from("foods")
    .select("categoria")
    .eq("id", item.food_id)
    .maybeSingle<{ categoria: string }>();
  if (!original) return [];

  const { data: candidatos } = await supabase
    .from("foods")
    .select("*")
    .eq("categoria", original.categoria)
    .neq("id", item.food_id)
    .limit(400)
    .returns<Food[]>();

  const jaUsados = new Set(item.meal_item_substitutions.map((s) => s.food_id));
  const macrosOriginal = calculateMealItemMacros(item);
  const gramasOriginal = Number(item.quantidade_g);

  const ranqueados = (candidatos ?? [])
    .filter(
      (f) =>
        !jaUsados.has(f.id) &&
        mesmoEstado(item.nome_alimento, f.nome) &&
        (ehIngrediente(item.nome_alimento) || !ehIngrediente(f.nome)),
    )
    .flatMap((f) => {
      const g = gramasEquivalentes(macrosOriginal, f, criterio);
      if (g === null || g > gramasOriginal * 4 || g < gramasOriginal / 4) return [];
      const pontos = pontuacaoSugestao(
        { nome: item.nome_alimento, gramas: gramasOriginal, macros: macrosOriginal },
        { nome: f.nome, gramas: g, macros: macrosEm(f, g) },
      );
      return [{ food: f, gramas: g, pontos }];
    })
    .sort((a, b) => a.pontos - b.pontos)
    .slice(0, MAX_SUGESTOES);

  const medidas = await medidasPorAlimento(
    supabase,
    ranqueados.map((r) => r.food.id),
  );
  return ranqueados.map(({ food, gramas }) => {
    const m = medidaUsual(medidas[food.id] ?? []);
    const arredondado = arredondarQuantidade(gramas, m ? { gramas: Number(m.gramas) } : null);
    return {
      foodId: food.id,
      nome: food.nome,
      origem: food.is_global ? "TACO" : "Seu alimento",
      medida: m ? { id: m.id, nome: m.nome, gramas: Number(m.gramas) } : null,
      medidaQuantidade: arredondado.medidaQuantidade,
      gramas: arredondado.gramas,
      macros: macrosEm(food, arredondado.gramas),
    };
  });
}

// Campos que trocam de lugar ao inverter: o alimento, a quantidade e todo o snapshot.
const CAMPOS_TROCA = [
  "food_id",
  "quantidade_g",
  "nome_alimento",
  "fonte_alimento",
  "fonte_descricao_alimento",
  "porcao_referencia_g",
  "calorias_kcal",
  "proteinas_g",
  "carboidratos_g",
  "gorduras_g",
  "fibras_g",
  "medida_nome",
  "medida_gramas",
  "medida_quantidade",
] as const;

function campos(origem: Record<string, unknown>) {
  return Object.fromEntries(CAMPOS_TROCA.map((c) => [c, origem[c]]));
}

/**
 * "Inverter" (Fase 17, Bloco E): o substituto vira o alimento do plano e o
 * alimento do plano vira substituto, cada um com a própria quantidade e cópia
 * dos valores. Item de receita não inverte (substituto é sempre alimento).
 */
export async function inverterSubstituto(planId: string, substitutionId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: sub } = await supabase
    .from("meal_item_substitutions")
    .select("*")
    .eq("id", substitutionId)
    .maybeSingle<MealItemSubstitution>();
  if (!sub) return { success: false, message: "Substituto não encontrado." };

  const { data: item } = await supabase
    .from("meal_items")
    .select("*")
    .eq("id", sub.meal_item_id)
    .maybeSingle<MealItem>();
  if (!item) return { success: false, message: "Alimento do plano não encontrado." };
  if (item.recipe_id) return { success: false, message: "Receitas não podem ser invertidas com um substituto." };

  const { error: itemError } = await supabase
    .from("meal_items")
    .update(campos(sub as unknown as Record<string, unknown>))
    .eq("id", item.id);
  if (itemError) return { success: false, message: itemError.message };

  const { error: subError } = await supabase
    .from("meal_item_substitutions")
    .update(campos(item as unknown as Record<string, unknown>))
    .eq("id", sub.id);
  if (subError) {
    // Desfaz a primeira metade para o plano não ficar com o alimento duplicado.
    await supabase
      .from("meal_items")
      .update(campos(item as unknown as Record<string, unknown>))
      .eq("id", item.id);
    return { success: false, message: subError.message };
  }

  revalidatePath(`/planos/${planId}`);
  return { success: true, message: `${sub.nome_alimento} agora é o alimento do plano.` };
}
