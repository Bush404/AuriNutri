"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  recipeIdentificationSchema,
  recipeIngredientSchema,
  recipeModoPreparoSchema,
  recipeResultadoSchema,
  valoresSobrescritosSchema,
  tagsFromInput,
  type RecipeIdentificationInput,
  type RecipeIngredientInput,
  type RecipeModoPreparoInput,
  type RecipeResultadoInput,
  type ValoresSobrescritosInput,
} from "@/lib/validations/recipe";
import { buildFoodSnapshotWithMicros } from "@/lib/nutrition";
import { rateLimitOrError } from "@/lib/rate-limit";
import type { ActionResult } from "@/lib/actions/patients";
import type { Food, Recipe } from "@/lib/types/database.types";

export interface CreateRecipeResult extends ActionResult {
  id?: string;
}

function recipePath(id: string) {
  return `/receitas/${id}/editar`;
}

/** ETAPA 1 (criação) — cria o rascunho só com identificação; rendimento/porções ficam NULL até a Etapa 4. */
export async function createRecipeDraft(input: RecipeIdentificationInput): Promise<CreateRecipeResult> {
  const parsed = recipeIdentificationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Verifique os dados informados." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  const { data, error } = await supabase
    .from("recipes")
    .insert({
      user_id: user.id,
      nome: parsed.data.nome,
      descricao: parsed.data.descricao || null,
      tags: tagsFromInput(parsed.data),
      tempo_preparo_min: parsed.data.tempo_preparo_min ?? null,
      imagem_url: parsed.data.imagem_url || null,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/receitas");
  return { success: true, id: data.id };
}

/** ETAPA 1 (edição) — atualiza identificação de uma receita já existente. */
export async function updateRecipeIdentification(
  recipeId: string,
  input: RecipeIdentificationInput
): Promise<ActionResult> {
  const parsed = recipeIdentificationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Verifique os dados informados." };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("recipes")
    .update({
      nome: parsed.data.nome,
      descricao: parsed.data.descricao || null,
      tags: tagsFromInput(parsed.data),
      tempo_preparo_min: parsed.data.tempo_preparo_min ?? null,
      imagem_url: parsed.data.imagem_url || null,
    })
    .eq("id", recipeId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/receitas");
  revalidatePath(recipePath(recipeId));
  return { success: true, message: "Identificação salva." };
}

/** ETAPA 3 — modo de preparo. */
export async function updateRecipeModoPreparo(
  recipeId: string,
  input: RecipeModoPreparoInput
): Promise<ActionResult> {
  const parsed = recipeModoPreparoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Verifique o modo de preparo." };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("recipes")
    .update({ modo_preparo: parsed.data.modo_preparo || null })
    .eq("id", recipeId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(recipePath(recipeId));
  return { success: true, message: "Modo de preparo salvo." };
}

/** ETAPA 4 — rendimento e número de porções da preparação pronta. */
export async function updateRecipeResultado(recipeId: string, input: RecipeResultadoInput): Promise<ActionResult> {
  const parsed = recipeResultadoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Informe o rendimento e o número de porções corretamente." };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("recipes")
    .update({
      rendimento_g: parsed.data.rendimento_g,
      numero_porcoes: parsed.data.numero_porcoes,
    })
    .eq("id", recipeId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/receitas");
  revalidatePath(recipePath(recipeId));
  return { success: true, message: "Receita concluída." };
}

/**
 * Sobrescreve manualmente um ou mais valores calculados (macro/micro, em
 * qualquer das 3 visões) — grava em `valores_sobrescritos`, mesclando com o
 * que já existe (nunca substitui o mapa inteiro, pra não perder overrides
 * de outros campos feitos antes).
 */
export async function setRecipeValorSobrescrito(
  recipeId: string,
  updates: ValoresSobrescritosInput
): Promise<ActionResult> {
  const parsed = valoresSobrescritosSchema.safeParse(updates);
  if (!parsed.success) {
    return { success: false, message: "Valor inválido." };
  }

  const supabase = createClient();
  const { data: current } = await supabase
    .from("recipes")
    .select("valores_sobrescritos")
    .eq("id", recipeId)
    .single<{ valores_sobrescritos: Record<string, number> }>();

  const merged = { ...(current?.valores_sobrescritos ?? {}), ...parsed.data };

  const { error } = await supabase.from("recipes").update({ valores_sobrescritos: merged }).eq("id", recipeId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(recipePath(recipeId));
  return { success: true };
}

/** Remove um valor sobrescrito, voltando a aceitar o calculado para aquele campo. */
export async function clearRecipeValorSobrescrito(recipeId: string, campo: string): Promise<ActionResult> {
  const supabase = createClient();
  const { data: current } = await supabase
    .from("recipes")
    .select("valores_sobrescritos")
    .eq("id", recipeId)
    .single<{ valores_sobrescritos: Record<string, number> }>();

  const merged = { ...(current?.valores_sobrescritos ?? {}) };
  delete merged[campo];

  const { error } = await supabase.from("recipes").update({ valores_sobrescritos: merged }).eq("id", recipeId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(recipePath(recipeId));
  return { success: true };
}

/**
 * Soft delete — via função `security definer` (migration 0017), não via
 * `.update()` direto. RLS puro falha aqui: a policy de SELECT filtra
 * `deleted_at is null`, e o Postgres rejeita o UPDATE que torna a própria
 * linha invisível por essa mesma policy ("new row violates row-level
 * security policy"), mesmo a policy de UPDATE permitindo a operação.
 */
export async function deleteRecipe(recipeId: string): Promise<ActionResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("soft_delete_recipe", { recipe_id: recipeId });

  if (error) {
    return { success: false, message: error.message };
  }
  if (!data) {
    return { success: false, message: "Receita não encontrada." };
  }

  revalidatePath("/receitas");
  return { success: true, message: "Receita excluída." };
}

// ----------------------------------------------------------------------------
// ETAPA 2 — ingredientes
// ----------------------------------------------------------------------------

export async function addRecipeIngredient(
  recipeId: string,
  input: RecipeIngredientInput,
  ordem: number
): Promise<ActionResult> {
  const parsed = recipeIngredientSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Selecione um alimento e informe a quantidade." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  // Snapshot COMPLETO (macros + micros + valores_especiais) no momento da
  // inclusão — nunca uma referência "ao vivo". Editar/excluir o alimento
  // depois não pode mudar uma receita já salva (mesmo princípio de meal_items).
  const { data: food, error: foodError } = await supabase
    .from("foods")
    .select("*")
    .eq("id", parsed.data.food_id)
    .single<Food>();

  if (foodError || !food) {
    return { success: false, message: "Alimento não encontrado." };
  }

  const { error } = await supabase.from("recipe_ingredients").insert({
    recipe_id: recipeId,
    food_id: food.id,
    user_id: user.id,
    quantidade_g: parsed.data.quantidade_g,
    ordem,
    ...buildFoodSnapshotWithMicros(food),
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(recipePath(recipeId));
  return { success: true };
}

/** Exclusão real — sem soft delete nesta tabela (ver comentário na migration 0013). */
export async function removeRecipeIngredient(recipeId: string, ingredientId: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from("recipe_ingredients").delete().eq("id", ingredientId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(recipePath(recipeId));
  return { success: true };
}

/** Reordena a lista inteira, gravando `ordem` = posição no array recebido. */
export async function reorderRecipeIngredients(recipeId: string, orderedIds: string[]): Promise<ActionResult> {
  const supabase = createClient();

  const results = await Promise.all(
    orderedIds.map((id, index) => supabase.from("recipe_ingredients").update({ ordem: index }).eq("id", id))
  );

  const failed = results.find((r) => r.error);
  if (failed?.error) {
    return { success: false, message: failed.error.message };
  }

  revalidatePath(recipePath(recipeId));
  return { success: true };
}

// ----------------------------------------------------------------------------
// Imagem da receita — bucket privado 'receitas', mesmo padrão do bucket
// 'profissional' (src/lib/actions/profile.ts).
// ----------------------------------------------------------------------------

const BUCKET = "receitas";
const SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 60; // 1 hora
const IMAGE_ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
const IMAGE_MAX_BYTES = 4 * 1024 * 1024; // 4MB
const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export interface UploadRecipeImageResult extends ActionResult {
  path?: string;
}

/**
 * Recebe a imagem via FormData e sobe para `{auth.uid()}/<uuid>.<ext>` no
 * bucket privado 'receitas'. O nome não depende do id da receita porque a
 * imagem pode ser escolhida na Etapa 1 antes do rascunho existir (ver
 * createRecipeDraft) — o path só é gravado em `recipes.imagem_url` quando a
 * etapa é salva.
 */
export async function uploadRecipeImage(formData: FormData): Promise<UploadRecipeImageResult> {
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { success: false, message: "Nenhum arquivo enviado." };
  }

  if (!IMAGE_ACCEPTED_TYPES.includes(file.type as (typeof IMAGE_ACCEPTED_TYPES)[number])) {
    return { success: false, message: "Formato inválido. Use PNG, JPG ou WEBP." };
  }

  if (file.size > IMAGE_MAX_BYTES) {
    return { success: false, message: "Arquivo muito grande. O limite é 4MB." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  const limited = await rateLimitOrError(supabase, "enviar_arquivo");
  if (limited) return limited;

  const extension = EXTENSION_BY_MIME_TYPE[file.type];
  const path = `${user.id}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true, path };
}

/** Confere que o path pertence ao usuário autenticado antes de assinar — mesmo padrão de getProfileFileSignedUrl. */
export async function getRecipeImageSignedUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !path.startsWith(`${user.id}/`)) {
    return null;
  }

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_EXPIRES_IN_SECONDS);

  if (error) {
    return null;
  }

  return data.signedUrl;
}

/**
 * Busca receitas para o seletor do construtor de plano alimentar (Fase 6,
 * Bloco C) — só retorna receitas FINALIZADAS (rendimento_g/numero_porcoes
 * preenchidos, ou seja, fora da Etapa 4 ainda em rascunho), já que só essas
 * têm os dados necessários para virar um item de refeição.
 */
export async function searchRecipesForPicker(query: string): Promise<Recipe[]> {
  const supabase = createClient();
  const termo = query.trim();

  let recipesQuery = supabase
    .from("recipes")
    .select("*")
    .not("rendimento_g", "is", null)
    .not("numero_porcoes", "is", null)
    .order("nome")
    .limit(8);

  if (termo) {
    recipesQuery = recipesQuery.ilike("nome", `%${termo}%`);
  }

  const { data } = await recipesQuery.returns<Recipe[]>();
  return data ?? [];
}
