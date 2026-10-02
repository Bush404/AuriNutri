"use server";

import { createClient } from "@/lib/supabase/server";
import { entradasDaListaDeCompras } from "@/lib/shopping-list-data";
import { montarListaDeCompras, type GrupoListaDeCompras } from "@/lib/shopping-list";
import type { MealItem } from "@/lib/types/database.types";

/**
 * Lista de compras do plano (Fase 17, Bloco F) para a janela da tela do plano.
 * A RLS garante que só sai o plano do próprio profissional.
 */
export async function listaDeComprasDoPlano(planId: string, dias: number): Promise<GrupoListaDeCompras[]> {
  const diasValidos = Number.isInteger(dias) && dias >= 1 && dias <= 31 ? dias : 7;
  const supabase = await createClient();
  const { data: meals } = await supabase
    .from("meals")
    .select(
      "id, meal_items(food_id, recipe_id, nome_alimento, quantidade_g, medida_nome, medida_gramas, medida_quantidade)",
    )
    .eq("meal_plan_id", planId)
    .returns<{ id: string; meal_items: MealItem[] }[]>();
  const itens = (meals ?? []).flatMap((m) => m.meal_items ?? []);
  return montarListaDeCompras(await entradasDaListaDeCompras(supabase, itens), diasValidos);
}
