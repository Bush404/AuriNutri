import type { createClient } from "@/lib/supabase/server";
import type { FoodMeasure } from "@/lib/types/database.types";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

/**
 * Medida caseira que o profissional enxerga (IBGE ou dele, pela RLS) e que é
 * mesmo deste alimento — usado ao gravar itens e substitutos (Fase 17, Blocos D e E).
 */
export async function buscarMedida(supabase: SupabaseServer, medidaId: string, foodId: string) {
  const { data } = await supabase
    .from("food_measures")
    .select("*")
    .eq("id", medidaId)
    .eq("food_id", foodId)
    .maybeSingle<FoodMeasure>();
  return data;
}

/** Colunas de snapshot da medida; quantidade_g = medidas × gramas de uma medida. */
export function camposDaMedida(medida: { nome: string; gramas: number }, medidaQuantidade: number) {
  const gramas = Number(medida.gramas);
  return {
    medida_nome: medida.nome,
    medida_gramas: gramas,
    medida_quantidade: medidaQuantidade,
    quantidade_g: Math.round(medidaQuantidade * gramas * 100) / 100,
  };
}

/** Todas as medidas dos alimentos pedidos, agrupadas por alimento (menor primeiro). */
export async function medidasPorAlimento(supabase: SupabaseServer, foodIds: string[]) {
  const porAlimento: Record<string, FoodMeasure[]> = {};
  if (foodIds.length === 0) return porAlimento;
  const { data } = await supabase
    .from("food_measures")
    .select("*")
    .in("food_id", [...new Set(foodIds)])
    .order("gramas")
    .order("created_at")
    .returns<FoodMeasure[]>();
  for (const m of data ?? []) (porAlimento[m.food_id] ??= []).push(m);
  return porAlimento;
}
