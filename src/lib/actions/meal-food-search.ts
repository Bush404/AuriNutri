"use server";

import { createClient } from "@/lib/supabase/server";
import { searchRecipesForPicker } from "@/lib/actions/recipes";
import type { ActionResult } from "@/lib/actions/patients";
import { medidaUsual } from "@/lib/household-measures";
import { origemDoAlimento } from "@/lib/nutrition";
import { medidasPorAlimento } from "@/lib/food-measures-db";
import type { Food, FoodMeasure } from "@/lib/types/database.types";

/** "alimentos" = todas as fontes de alimento, sem receitas (aba "Alimentos" da janela da refeição, Fase 19). */
export type FiltroBusca = "todos" | "alimentos" | "favoritos" | "meus" | "receitas" | "taco" | "usda";

/** Uma linha da busca da refeição: alimento (valores da porção de referência) ou receita (por porção). */
export type ResultadoBusca =
  | {
      tipo: "alimento";
      id: string;
      nome: string;
      origem: "TACO" | "USDA" | "Seu alimento";
      porcaoG: number;
      kcal: number;
      proteinas: number;
      lipidios: number;
      carboidratos: number;
      favorito: boolean;
      /** Medida caseira usual (Fase 17, Bloco D) — é com ela que o alimento entra na refeição. */
      medida: { id: string; nome: string; gramas: number } | null;
    }
  | { tipo: "receita"; id: string; nome: string; origem: "Receita" };

const LIMITE = 30;

/**
 * Busca da janela da refeição (Fase 17, Bloco C), com os filtros do WebDiet:
 * Todos, Favoritos, Seus alimentos, Receitas e TACO. Respeita a RLS (TACO é
 * global; alimentos e receitas, só os do profissional). Os favoritos vêm
 * primeiro em "Todos".
 */
export async function buscarAlimentosRefeicao(termo: string, filtro: FiltroBusca): Promise<ResultadoBusca[]> {
  const supabase = await createClient();
  const busca = termo.trim();

  const { data: favs } = await supabase.from("food_favorites").select("food_id").returns<{ food_id: string }[]>();
  const favoritos = new Set((favs ?? []).map((f) => f.food_id));

  const alimentos = async (origem: "meus" | "taco" | "usda" | "favoritos", limite: number) => {
    if (origem === "favoritos" && favoritos.size === 0) return [];
    let q = supabase.from("foods").select("*").order("nome").limit(limite);
    if (origem === "meus") q = q.eq("is_global", false);
    if (origem === "taco" || origem === "usda") q = q.eq("is_global", true).eq("fonte", origem);
    if (origem === "favoritos") q = q.in("id", [...favoritos]);
    if (busca) q = q.ilike("nome", `%${busca}%`);
    const { data } = await q.returns<Food[]>();
    return (data ?? []).map((f): ResultadoBusca => ({
      tipo: "alimento",
      id: f.id,
      nome: f.nome,
      origem: origemDoAlimento(f),
      porcaoG: Number(f.porcao_referencia_g),
      kcal: Number(f.calorias_kcal ?? 0),
      proteinas: Number(f.proteinas_g ?? 0),
      lipidios: Number(f.gorduras_g ?? 0),
      carboidratos: Number(f.carboidratos_g ?? 0),
      favorito: favoritos.has(f.id),
      medida: null,
    }));
  };
  const receitas = async (limite: number) =>
    (await searchRecipesForPicker(busca))
      .slice(0, limite)
      .map((r): ResultadoBusca => ({ tipo: "receita", id: r.id, nome: r.nome, origem: "Receita" }));

  return comMedidaUsual(supabase, await porFiltro());

  async function porFiltro(): Promise<ResultadoBusca[]> {
    switch (filtro) {
      case "favoritos":
        return alimentos("favoritos", LIMITE);
      case "meus":
        return alimentos("meus", LIMITE);
      case "taco":
        return alimentos("taco", LIMITE);
      case "usda":
        return alimentos("usda", LIMITE);
      case "receitas":
        return receitas(LIMITE);
      case "todos":
      case "alimentos": {
        // A TACO vem antes da USDA: é a referência brasileira.
        const [meus, taco, usda, recs] = await Promise.all([
          alimentos("meus", 10),
          alimentos("taco", 20),
          alimentos("usda", 10),
          filtro === "todos" ? receitas(5) : Promise.resolve([]),
        ]);
        const lista = [...meus, ...taco, ...usda, ...recs];
        // Favoritos no topo, mantendo a ordem do resto.
        return [
          ...lista.filter((r) => r.tipo === "alimento" && r.favorito),
          ...lista.filter((r) => !(r.tipo === "alimento" && r.favorito)),
        ];
      }
    }
  }
}

/** Preenche a medida caseira usual de cada alimento do resultado (IBGE ou do profissional, pela RLS). */
async function comMedidaUsual(supabase: Awaited<ReturnType<typeof createClient>>, lista: ResultadoBusca[]) {
  const porAlimento = await medidasPorAlimento(
    supabase,
    lista.filter((r) => r.tipo === "alimento").map((r) => r.id),
  );
  return lista.map((r) => {
    if (r.tipo !== "alimento") return r;
    const m = medidaUsual(porAlimento[r.id] ?? []);
    return m ? { ...r, medida: { id: m.id, nome: m.nome, gramas: Number(m.gramas) } } : r;
  });
}

/** Medidas caseiras dos alimentos pedidos, por alimento (seletor de cada item; substitutos). */
export async function medidasDosAlimentos(foodIds: string[]): Promise<Record<string, FoodMeasure[]>> {
  return medidasPorAlimento(await createClient(), foodIds.slice(0, 500));
}
/** Estrela da busca: favoritar ou desfavoritar um alimento (migration 0044). */
export async function alternarFavoritoAlimento(foodId: string, favoritar: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Sessão expirada. Faça login novamente." };

  const { error } = favoritar
    ? await supabase
        .from("food_favorites")
        .upsert({ user_id: user.id, food_id: foodId }, { onConflict: "user_id,food_id" })
    : await supabase.from("food_favorites").delete().eq("user_id", user.id).eq("food_id", foodId);
  if (error) return { success: false, message: error.message };
  return { success: true };
}
