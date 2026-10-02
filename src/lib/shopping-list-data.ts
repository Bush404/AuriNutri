import type { createClient } from "@/lib/supabase/server";
import type { MealItem } from "@/lib/types/database.types";
import type { EntradaListaDeCompras } from "@/lib/shopping-list";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

/**
 * Entradas da lista de compras de um cardápio (Fase 17, Bloco F). Alimentos
 * entram com o que está no plano; receitas entram pelos ingredientes, na
 * proporção do que foi prescrito (gramas do item ÷ rendimento da receita).
 * Aqui é lista de compras, não cálculo nutricional — por isso pode ler a
 * receita e o grupo do alimento atuais. Receita excluída entra pelo nome.
 */
export async function entradasDaListaDeCompras(
  supabase: SupabaseServer,
  itens: Pick<
    MealItem,
    "food_id" | "recipe_id" | "nome_alimento" | "quantidade_g" | "medida_nome" | "medida_gramas" | "medida_quantidade"
  >[],
): Promise<EntradaListaDeCompras[]> {
  const recipeIds = [...new Set(itens.map((i) => i.recipe_id).filter((id): id is string => !!id))];
  const [{ data: receitas }, { data: ingredientes }] = await Promise.all([
    recipeIds.length
      ? supabase
          .from("recipes")
          .select("id, rendimento_g")
          .in("id", recipeIds)
          .returns<{ id: string; rendimento_g: number | null }[]>()
      : Promise.resolve({ data: [] as { id: string; rendimento_g: number | null }[] }),
    recipeIds.length
      ? supabase
          .from("recipe_ingredients")
          .select("recipe_id, food_id, nome_alimento, quantidade_g")
          .in("recipe_id", recipeIds)
          .returns<{ recipe_id: string; food_id: string | null; nome_alimento: string; quantidade_g: number }[]>()
      : Promise.resolve({
          data: [] as { recipe_id: string; food_id: string | null; nome_alimento: string; quantidade_g: number }[],
        }),
  ]);

  const foodIds = [
    ...new Set(
      [...itens.map((i) => i.food_id), ...(ingredientes ?? []).map((i) => i.food_id)].filter(
        (id): id is string => !!id,
      ),
    ),
  ];
  const { data: foods } = foodIds.length
    ? await supabase
        .from("foods")
        .select("id, categoria")
        .in("id", foodIds)
        .returns<{ id: string; categoria: string }[]>()
    : { data: [] as { id: string; categoria: string }[] };
  const grupoDe = new Map((foods ?? []).map((f) => [f.id, f.categoria]));
  const rendimentoDe = new Map((receitas ?? []).map((r) => [r.id, Number(r.rendimento_g) || 0]));

  const entradas: EntradaListaDeCompras[] = [];
  for (const item of itens) {
    const rendimento = item.recipe_id ? rendimentoDe.get(item.recipe_id) : undefined;
    const doItem = (ingredientes ?? []).filter((i) => i.recipe_id === item.recipe_id);
    if (item.recipe_id && rendimento && doItem.length) {
      const fator = Number(item.quantidade_g) / rendimento;
      for (const ing of doItem) {
        entradas.push({
          chave: ing.food_id ?? `nome:${ing.nome_alimento}`,
          nome: ing.nome_alimento,
          grupo: ing.food_id ? (grupoDe.get(ing.food_id) ?? null) : null,
          gramas: Number(ing.quantidade_g) * fator,
        });
      }
      continue;
    }
    entradas.push({
      chave: item.food_id ?? `nome:${item.nome_alimento}`,
      nome: item.nome_alimento,
      grupo: item.recipe_id ? "Receitas" : item.food_id ? (grupoDe.get(item.food_id) ?? null) : null,
      gramas: Number(item.quantidade_g),
      medida:
        item.medida_nome && item.medida_gramas && item.medida_quantidade
          ? { nome: item.medida_nome, gramas: Number(item.medida_gramas), quantidade: Number(item.medida_quantidade) }
          : null,
    });
  }
  return entradas;
}
