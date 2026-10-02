import type { createClient } from "@/lib/supabase/server";
import type { Meal, MealItem, MealItemSubstitution } from "@/lib/types/database.types";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

type Linha = Record<string, unknown>;

/** Tira as colunas de controle (id, datas, soft delete) e as relações aninhadas, para inserir como linha nova. */
function semControle(row: Linha, ...extras: string[]) {
  const copia: Linha = { ...row };
  for (const k of ["id", "created_at", "updated_at", "deleted_at", ...extras]) delete copia[k];
  return copia;
}

/**
 * Copia todas as refeições de um plano para outro: refeições, alimentos e
 * substitutos, com a cópia (snapshot) nutricional como está — nunca relê o
 * alimento ou a receita "ao vivo". Usado por "Duplicar" e por "Começar de um
 * modelo" (Fase 17, Bloco G). Copiar todas as colunas (não uma lista) garante
 * que colunas novas — medida caseira, micronutrientes — venham junto.
 */
export async function copiarRefeicoes(
  supabase: SupabaseServer,
  userId: string,
  origemPlanoId: string,
  destinoPlanoId: string,
): Promise<string | null> {
  const { data: refeicoes, error } = await supabase
    .from("meals")
    .select("*, meal_items(*, meal_item_substitutions(*))")
    .eq("meal_plan_id", origemPlanoId)
    .order("ordem", { ascending: true })
    .returns<Array<Meal & { meal_items: Array<MealItem & { meal_item_substitutions: MealItemSubstitution[] }> }>>();
  if (error) return error.message;

  for (const refeicao of refeicoes ?? []) {
    const { data: nova, error: erroRefeicao } = await supabase
      .from("meals")
      .insert({
        ...semControle(refeicao as unknown as Linha, "meal_items"),
        meal_plan_id: destinoPlanoId,
        user_id: userId,
      })
      .select("id")
      .single<{ id: string }>();
    if (erroRefeicao || !nova) return erroRefeicao?.message ?? "Falha ao copiar uma refeição.";

    const itens = (refeicao.meal_items ?? []).filter((i) => !i.deleted_at).sort((a, b) => a.ordem - b.ordem);
    for (const item of itens) {
      const { data: novoItem, error: erroItem } = await supabase
        .from("meal_items")
        .insert({
          ...semControle(item as unknown as Linha, "meal_item_substitutions"),
          meal_id: nova.id,
          user_id: userId,
        })
        .select("id")
        .single<{ id: string }>();
      if (erroItem || !novoItem) return erroItem?.message ?? "Falha ao copiar um alimento.";

      const subs = (item.meal_item_substitutions ?? []).filter((s) => !(s as unknown as Linha).deleted_at);
      if (subs.length) {
        const { error: erroSub } = await supabase
          .from("meal_item_substitutions")
          .insert(
            subs.map((s) => ({ ...semControle(s as unknown as Linha), meal_item_id: novoItem.id, user_id: userId })),
          );
        if (erroSub) return erroSub.message;
      }
    }
  }
  return null;
}
