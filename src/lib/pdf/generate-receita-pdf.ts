import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { createClient } from "@/lib/supabase/server";

import { buildProfissionalPdfHeaderData } from "@/lib/pdf/profissional-header";
import { ReceitaPdfDocument } from "@/lib/pdf/receita-pdf-document";
import { slugify } from "@/lib/pdf/generate-plan-pdf";
import { calculateRecipeEffectivePerPortion } from "@/lib/nutrition";
import type { Recipe, RecipeIngredient } from "@/lib/types/database.types";

export interface GenerateReceitaPdfResult {
  buffer: Buffer;
  nome: string;
  filename: string;
}

/**
 * Gera o PDF de uma receita (ingredientes, modo de preparo, macros por
 * porção) — usado pelo item "Impressos" da Central de Envio, pra mandar
 * QUALQUER receita do profissional (não só as usadas no plano ativo) como
 * PDF de verdade. Retorna null se a receita não existe/não pertence ao
 * usuário (RLS) ou ainda é um rascunho (sem rendimento_g/numero_porcoes).
 */
export async function generateReceitaPdf(
  supabase: ReturnType<typeof createClient>,
  user: { id: string; email?: string | null },
  recipeId: string
): Promise<GenerateReceitaPdfResult | null> {
  const { data: recipe } = await supabase.from("recipes").select("*").eq("id", recipeId).single<Recipe>();

  if (!recipe || recipe.rendimento_g === null || recipe.numero_porcoes === null) return null;

  const { data: ingredients } = await supabase
    .from("recipe_ingredients")
    .select("*")
    .eq("recipe_id", recipeId)
    .order("ordem", { ascending: true })
    .returns<RecipeIngredient[]>();

  const profissional = await buildProfissionalPdfHeaderData(supabase, user);
  const macrosPorPorcao = calculateRecipeEffectivePerPortion(
    ingredients ?? [],
    recipe.numero_porcoes,
    recipe.valores_sobrescritos
  );

  const element = createElement(ReceitaPdfDocument, {
    data: {
      profissional,
      nome: recipe.nome,
      descricao: recipe.descricao,
      modoPreparo: recipe.modo_preparo,
      rendimentoG: recipe.rendimento_g,
      numeroPorcoes: recipe.numero_porcoes,
      tempoPreparoMin: recipe.tempo_preparo_min,
      ingredientes: (ingredients ?? []).map((i) => ({ nome: i.nome_alimento, quantidadeG: i.quantidade_g })),
      macrosPorPorcao,
    },
  }) as unknown as ReactElement<DocumentProps>;

  const buffer = await renderToBuffer(element);
  const filename = `receita-${slugify(recipe.nome)}.pdf`;

  return { buffer, nome: recipe.nome, filename };
}
