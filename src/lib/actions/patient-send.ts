"use server";

import { createClient } from "@/lib/supabase/server";
import { listPlanShareLinks } from "@/lib/actions/plan-share";
import { utcInstantToZonedDateTime } from "@/lib/timezone";
import { formatDate } from "@/lib/utils";
import type { PlanShareToken, Recipe, RecipeIngredient } from "@/lib/types/database.types";

export interface SendCenterRecipe {
  id: string;
  nome: string;
  modoPreparo: string | null;
  rendimentoG: number | null;
  numeroPorcoes: number | null;
  ingredientes: { nome: string; quantidadeG: number }[];
}

export interface SendCenterContext {
  profissionalNome: string;
  planoAtivo: { id: string; nome: string } | null;
  planoShareLinks: PlanShareToken[];
  receitasDoPlano: SendCenterRecipe[];
  /** Data/hora já formatadas no fuso do profissional (profiles.fuso_horario) — nunca no fuso do processo/servidor. */
  proximaConsulta: { dataFormatada: string; horaFormatada: string } | null;
}

/**
 * Reúne tudo que a Central de Envio precisa mostrar — só leitura, nenhuma
 * mutação (gerar o link do plano continua sendo uma ação explícita do
 * profissional, ver createPlanShareLink em plan-share.ts, nunca disparada
 * automaticamente aqui). "Plano ativo" usa o mesmo critério já usado no
 * painel de contexto da agenda (meal_plans.ativo = true, mais recente por
 * data_inicio) — não um critério novo.
 */
export async function getSendCenterContext(patientId: string): Promise<SendCenterContext | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: profile }, { data: planos }, { data: proximaRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("nome, fuso_horario")
      .eq("id", user.id)
      .single<{ nome: string; fuso_horario: string }>(),
    supabase
      .from("meal_plans")
      .select("id, nome")
      .eq("patient_id", patientId)
      .eq("ativo", true)
      .order("data_inicio", { ascending: false })
      .limit(1)
      .returns<{ id: string; nome: string }[]>(),
    supabase
      .from("appointments")
      .select("data_hora")
      .eq("patient_id", patientId)
      .gte("data_hora", new Date().toISOString())
      .neq("status", "cancelado")
      .order("data_hora", { ascending: true })
      .limit(1)
      .returns<{ data_hora: string }[]>(),
  ]);

  const planoAtivo = planos?.[0] ?? null;

  const [planoShareLinks, receitasDoPlano] = await Promise.all([
    planoAtivo ? listPlanShareLinks(planoAtivo.id) : Promise.resolve([]),
    planoAtivo ? buscarReceitasDoPlano(supabase, planoAtivo.id) : Promise.resolve([]),
  ]);

  const timeZone = profile?.fuso_horario || "America/Sao_Paulo";
  const proximaRow = proximaRows?.[0] ?? null;
  const proximaConsulta = proximaRow
    ? (() => {
        const { dateStr, timeStr } = utcInstantToZonedDateTime(proximaRow.data_hora, timeZone);
        return { dataFormatada: formatDate(dateStr), horaFormatada: timeStr };
      })()
    : null;

  return {
    profissionalNome: profile?.nome ?? "",
    planoAtivo: planoAtivo ? { id: planoAtivo.id, nome: planoAtivo.nome } : null,
    planoShareLinks,
    receitasDoPlano,
    proximaConsulta,
  };
}

/** Receitas distintas usadas nos itens de refeição do plano — via meal_items.recipe_id, mesmo vínculo criado na Fase 6, Bloco C. */
async function buscarReceitasDoPlano(
  supabase: ReturnType<typeof createClient>,
  planoId: string
): Promise<SendCenterRecipe[]> {
  const { data: meals } = await supabase
    .from("meals")
    .select("id")
    .eq("meal_plan_id", planoId)
    .returns<{ id: string }[]>();

  const mealIds = (meals ?? []).map((m) => m.id);
  if (mealIds.length === 0) return [];

  const { data: items } = await supabase
    .from("meal_items")
    .select("recipe_id")
    .in("meal_id", mealIds)
    .not("recipe_id", "is", null)
    .returns<{ recipe_id: string }[]>();

  const recipeIds = Array.from(new Set((items ?? []).map((i) => i.recipe_id)));
  if (recipeIds.length === 0) return [];

  const [{ data: recipes }, { data: ingredientes }] = await Promise.all([
    supabase
      .from("recipes")
      .select("id, nome, modo_preparo, rendimento_g, numero_porcoes")
      .in("id", recipeIds)
      .returns<Pick<Recipe, "id" | "nome" | "modo_preparo" | "rendimento_g" | "numero_porcoes">[]>(),
    supabase
      .from("recipe_ingredients")
      .select("recipe_id, nome_alimento, quantidade_g")
      .in("recipe_id", recipeIds)
      .order("ordem")
      .returns<Pick<RecipeIngredient, "recipe_id" | "nome_alimento" | "quantidade_g">[]>(),
  ]);

  return (recipes ?? []).map((r) => ({
    id: r.id,
    nome: r.nome,
    modoPreparo: r.modo_preparo,
    rendimentoG: r.rendimento_g,
    numeroPorcoes: r.numero_porcoes,
    ingredientes: (ingredientes ?? [])
      .filter((i) => i.recipe_id === r.id)
      .map((i) => ({ nome: i.nome_alimento, quantidadeG: i.quantidade_g })),
  }));
}
