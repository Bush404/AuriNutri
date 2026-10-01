"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { searchRecipesForPicker } from "@/lib/actions/recipes";
import { sanitizeRichText } from "@/lib/rich-text-sanitize";
import { isRichTextEmpty } from "@/lib/rich-text";
import type { ActionResult } from "@/lib/actions/patients";
import type { Food } from "@/lib/types/database.types";

export type FiltroBusca = "todos" | "favoritos" | "meus" | "receitas" | "taco";

/** Uma linha da busca da refeição: alimento (valores da porção de referência) ou receita (por porção). */
export type ResultadoBusca =
  | {
      tipo: "alimento";
      id: string;
      nome: string;
      origem: "TACO" | "Seu alimento";
      porcaoG: number;
      kcal: number;
      proteinas: number;
      lipidios: number;
      carboidratos: number;
      favorito: boolean;
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

  const alimentos = async (origem: "meus" | "taco" | "favoritos", limite: number) => {
    if (origem === "favoritos" && favoritos.size === 0) return [];
    let q = supabase.from("foods").select("*").order("nome").limit(limite);
    if (origem === "meus") q = q.eq("is_global", false);
    if (origem === "taco") q = q.eq("is_global", true);
    if (origem === "favoritos") q = q.in("id", [...favoritos]);
    if (busca) q = q.ilike("nome", `%${busca}%`);
    const { data } = await q.returns<Food[]>();
    return (data ?? []).map(
      (f): ResultadoBusca => ({
        tipo: "alimento",
        id: f.id,
        nome: f.nome,
        origem: f.is_global ? "TACO" : "Seu alimento",
        porcaoG: Number(f.porcao_referencia_g),
        kcal: Number(f.calorias_kcal ?? 0),
        proteinas: Number(f.proteinas_g ?? 0),
        lipidios: Number(f.gorduras_g ?? 0),
        carboidratos: Number(f.carboidratos_g ?? 0),
        favorito: favoritos.has(f.id),
      })
    );
  };
  const receitas = async (limite: number) =>
    (await searchRecipesForPicker(busca))
      .slice(0, limite)
      .map((r): ResultadoBusca => ({ tipo: "receita", id: r.id, nome: r.nome, origem: "Receita" }));

  switch (filtro) {
    case "favoritos":
      return alimentos("favoritos", LIMITE);
    case "meus":
      return alimentos("meus", LIMITE);
    case "taco":
      return alimentos("taco", LIMITE);
    case "receitas":
      return receitas(LIMITE);
    case "todos": {
      const [meus, taco, recs] = await Promise.all([alimentos("meus", 10), alimentos("taco", 20), receitas(5)]);
      const lista = [...meus, ...taco, ...recs];
      // Favoritos no topo, mantendo a ordem do resto.
      return [
        ...lista.filter((r) => r.tipo === "alimento" && r.favorito),
        ...lista.filter((r) => !(r.tipo === "alimento" && r.favorito)),
      ];
    }
  }
}

/** Estrela da busca: favoritar ou desfavoritar um alimento (migration 0044). */
export async function alternarFavoritoAlimento(foodId: string, favoritar: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Sessão expirada. Faça login novamente." };

  const { error } = favoritar
    ? await supabase.from("food_favorites").upsert({ user_id: user.id, food_id: foodId }, { onConflict: "user_id,food_id" })
    : await supabase.from("food_favorites").delete().eq("user_id", user.id).eq("food_id", foodId);
  if (error) return { success: false, message: error.message };
  return { success: true };
}

/**
 * Observações da refeição com texto formatado (Fase 17, 4.8; mesmo editor da
 * anamnese, Fase 14). O HTML é limpo aqui no servidor antes de gravar.
 */
export async function atualizarObservacoesRefeicao(planId: string, mealId: string, html: string): Promise<ActionResult> {
  if (html.length > 20000) return { success: false, message: "Observação longa demais." };
  const limpo = sanitizeRichText(html);
  const supabase = await createClient();
  const { error } = await supabase
    .from("meals")
    .update({ observacoes: isRichTextEmpty(limpo) ? null : limpo })
    .eq("id", mealId)
    .eq("meal_plan_id", planId);
  if (error) return { success: false, message: error.message };
  revalidatePath(`/planos/${planId}`);
  return { success: true };
}
