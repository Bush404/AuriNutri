"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/patients";
import type {
  Food,
  FoodMeasure,
  MealItem,
  MealItemSubstitution,
  Recipe,
  RecipeIngredient,
} from "@/lib/types/database.types";
import { buildFoodSnapshotParaItem, buildRecipeSnapshot, type MacroTotals } from "@/lib/nutrition";
import { MICRONUTRIENTE_KEYS } from "@/lib/validations/food";
import { salvarRefeicaoSchema, type SalvarRefeicaoInput } from "@/lib/validations/meal-plan";
import { buscarMedida, camposDaMedida, medidasPorAlimento } from "@/lib/food-measures-db";
import { sanitizeRichText } from "@/lib/rich-text-sanitize";
import { isRichTextEmpty } from "@/lib/rich-text";
import type { SnapshotRascunho } from "@/lib/meal-draft";
import type { CriterioEquivalencia } from "@/lib/substitutions";
import { sugestoesParaAlimento, type SugestaoSubstituto } from "@/lib/substitution-suggestions";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Linha = Record<string, unknown>;
type ItemGravado = MealItem & { meal_item_substitutions: MealItemSubstitution[] };

/** Cópia nutricional de uma linha (item ou substituto) — o que "usar este" e o salvamento copiam. */
const COLUNAS_SNAPSHOT = [
  "food_id",
  "nome_alimento",
  "fonte_alimento",
  "fonte_descricao_alimento",
  "porcao_referencia_g",
  "calorias_kcal",
  "proteinas_g",
  "carboidratos_g",
  "gorduras_g",
  "fibras_g",
  ...MICRONUTRIENTE_KEYS,
  "valores_especiais",
  "micros_copiados",
] as const;
/** Só itens têm receita (substituto é sempre alimento). */
const COLUNAS_SO_DO_ITEM = ["recipe_id", "fontes_ingredientes_receita"] as const;

const copiar = (row: Linha, colunas: readonly string[]) => Object.fromEntries(colunas.map((c) => [c, row[c] ?? null]));

/** Cópia nutricional de um alimento AGORA (mesma regra de addMealItem). */
async function snapshotDoAlimento(supabase: Supabase, foodId: string): Promise<Linha | string> {
  const { data: food } = await supabase.from("foods").select("*").eq("id", foodId).maybeSingle<Food>();
  if (!food) return "Alimento não encontrado.";
  return { food_id: food.id, recipe_id: null, fontes_ingredientes_receita: null, ...buildFoodSnapshotParaItem(food) };
}

/** Cópia de uma receita por porção AGORA (mesma regra de addMealItemRecipe). */
async function snapshotDaReceita(supabase: Supabase, recipeId: string): Promise<Linha | string> {
  const [{ data: recipe }, { data: ingredients }] = await Promise.all([
    supabase.from("recipes").select("*").eq("id", recipeId).maybeSingle<Recipe>(),
    supabase.from("recipe_ingredients").select("*").eq("recipe_id", recipeId).returns<RecipeIngredient[]>(),
  ]);
  if (!recipe) return "Receita não encontrada.";
  if (recipe.rendimento_g === null || recipe.numero_porcoes === null) {
    return "Essa receita ainda é um rascunho — finalize o cadastro antes de usá-la em um plano.";
  }
  if (!ingredients || ingredients.length === 0) return "Essa receita ainda não tem ingredientes.";
  return { food_id: null, recipe_id: recipe.id, ...buildRecipeSnapshot(recipe, ingredients) };
}

function paraRascunho(s: Linha): SnapshotRascunho {
  return {
    nome_alimento: String(s.nome_alimento),
    fonte_alimento: s.fonte_alimento as SnapshotRascunho["fonte_alimento"],
    food_id: (s.food_id as string | null) ?? null,
    recipe_id: (s.recipe_id as string | null) ?? null,
    porcao_referencia_g: Number(s.porcao_referencia_g),
    calorias_kcal: Number(s.calorias_kcal ?? 0),
    proteinas_g: Number(s.proteinas_g ?? 0),
    carboidratos_g: Number(s.carboidratos_g ?? 0),
    gorduras_g: Number(s.gorduras_g ?? 0),
    fibras_g: Number(s.fibras_g ?? 0),
  };
}

/**
 * Valores para mostrar um alimento ou receita recém-escolhido no rascunho da
 * janela da refeição, e as medidas caseiras do alimento. Só leitura: a cópia
 * que vale é tirada de novo em salvarRefeicao.
 */
export async function previaParaRefeicao(
  fonte: { de: "alimento"; food_id: string } | { de: "receita"; recipe_id: string },
): Promise<{ success: true; snapshot: SnapshotRascunho; medidas: FoodMeasure[] } | { success: false; message: string }> {
  const supabase = await createClient();
  const snap =
    fonte.de === "alimento"
      ? await snapshotDoAlimento(supabase, fonte.food_id)
      : await snapshotDaReceita(supabase, fonte.recipe_id);
  if (typeof snap === "string") return { success: false, message: snap };
  const medidas = fonte.de === "alimento" ? ((await medidasPorAlimento(supabase, [fonte.food_id]))[fonte.food_id] ?? []) : [];
  return { success: true, snapshot: paraRascunho(snap), medidas };
}

/** Sugestões rápidas de substitutos para um item do rascunho (gravado ou não). */
export async function sugerirSubstitutosRascunho(
  base: { food_id: string; nome_alimento: string; quantidade_g: number; macros: MacroTotals },
  jaUsados: string[],
  criterio: CriterioEquivalencia,
): Promise<SugestaoSubstituto[]> {
  const supabase = await createClient();
  return sugestoesParaAlimento(supabase, base, new Set(jaUsados), criterio);
}

/**
 * "Salvar alterações" da janela da refeição (Fase 19): grava a refeição
 * inteira de uma vez — nome, horário, observações, alimentos (na ordem da
 * tela), quantidades e substitutos.
 *
 * Linhas que já existiam são atualizadas (mesmo id); linhas novas são
 * inseridas; alimentos tirados da refeição vão para a lixeira como sempre
 * (soft delete, soft_delete_meal_item) e substitutos tirados são apagados,
 * como em deleteMealItemSubstitution. A cópia nutricional de cada linha é
 * sempre tirada aqui, a partir da fonte — a linha gravada, outra linha da
 * mesma refeição ("usar este") ou o alimento/receita escolhido —, nunca dos
 * números que vieram da tela. A gravação é uma transação só (função
 * salvar_refeicao, migration 0049): ou grava tudo, ou nada.
 */
export async function salvarRefeicao(planId: string, mealId: string, input: SalvarRefeicaoInput): Promise<ActionResult> {
  const parsed = salvarRefeicaoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Confira os dados da refeição." };
  }
  const dados = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Sessão expirada. Faça login novamente." };

  const { data: meal } = await supabase
    .from("meals")
    .select("id")
    .eq("id", mealId)
    .eq("meal_plan_id", planId)
    .maybeSingle<{ id: string }>();
  if (!meal) return { success: false, message: "Refeição não encontrada." };

  const { data: gravados, error: erroLeitura } = await supabase
    .from("meal_items")
    .select("*, meal_item_substitutions(*)")
    .eq("meal_id", mealId)
    .returns<ItemGravado[]>();
  if (erroLeitura) return { success: false, message: erroLeitura.message };

  const itemPorId = new Map((gravados ?? []).map((i) => [i.id, i]));
  const subPorId = new Map((gravados ?? []).flatMap((i) => i.meal_item_substitutions.map((s) => [s.id, s] as const)));

  // ---- 1. Resolve tudo antes de gravar qualquer coisa ----------------------
  const cacheFonte = new Map<string, Linha | string>();
  async function snapshotDa(fonte: SalvarRefeicaoInput["itens"][number]["fonte"]): Promise<{ snap: Linha; origem: Linha | null } | string> {
    if (fonte.de === "item") {
      const row = itemPorId.get(fonte.id);
      if (!row) return "Um alimento desta refeição não foi encontrado. Feche e abra a refeição de novo.";
      return { snap: copiar(row as unknown as Linha, [...COLUNAS_SNAPSHOT, ...COLUNAS_SO_DO_ITEM]), origem: row as unknown as Linha };
    }
    if (fonte.de === "sub") {
      const row = subPorId.get(fonte.id);
      if (!row) return "Um substituto desta refeição não foi encontrado. Feche e abra a refeição de novo.";
      return {
        snap: { ...copiar(row as unknown as Linha, COLUNAS_SNAPSHOT), recipe_id: null, fontes_ingredientes_receita: null },
        origem: row as unknown as Linha,
      };
    }
    const chave = fonte.de === "alimento" ? `a:${fonte.food_id}` : `r:${fonte.recipe_id}`;
    if (!cacheFonte.has(chave)) {
      cacheFonte.set(
        chave,
        fonte.de === "alimento"
          ? await snapshotDoAlimento(supabase, fonte.food_id)
          : await snapshotDaReceita(supabase, fonte.recipe_id),
      );
    }
    const snap = cacheFonte.get(chave)!;
    return typeof snap === "string" ? snap : { snap, origem: null };
  }

  async function quantidadeDa(
    q: SalvarRefeicaoInput["itens"][number]["quantidade"],
    snap: Linha,
    origem: Linha | null,
    nome: string,
  ): Promise<Linha | string> {
    const ehReceita = !!snap.recipe_id;
    const semMedida = { medida_nome: null, medida_gramas: null, medida_quantidade: null };
    if (q.tipo === "porcoes") {
      if (!ehReceita) return `${nome}: porções só valem para receitas.`;
      return { ...semMedida, quantidade_porcoes: q.valor, quantidade_g: q.valor * Number(snap.porcao_referencia_g) };
    }
    if (ehReceita) return `${nome}: receita é sempre em porções.`;
    if (q.tipo === "g") return { ...semMedida, quantidade_porcoes: null, quantidade_g: q.valor };
    let medida: { nome: string; gramas: number } | null = null;
    if (q.medida_id) {
      if (!snap.food_id) return `${nome}: este alimento não tem medidas caseiras.`;
      medida = await buscarMedida(supabase, q.medida_id, String(snap.food_id));
    } else if (origem?.medida_nome && origem.medida_gramas) {
      medida = { nome: String(origem.medida_nome), gramas: Number(origem.medida_gramas) };
    }
    if (!medida) return `${nome}: medida caseira não encontrada.`;
    return { quantidade_porcoes: null, ...camposDaMedida(medida, q.valor) };
  }

  const usados = new Set<string>();
  const usarId = (id: string | null, existe: boolean) => {
    if (!id) return true;
    if (!existe || usados.has(id)) return false;
    usados.add(id);
    return true;
  };

  type Pronto = { id: string | null; row: Linha; subs: { id: string | null; row: Linha }[] };
  const prontos: Pronto[] = [];
  for (const [i, item] of dados.itens.entries()) {
    if (!usarId(item.id, !!item.id && itemPorId.has(item.id))) {
      return { success: false, message: "A refeição mudou em outro lugar. Feche e abra de novo." };
    }
    const r = await snapshotDa(item.fonte);
    if (typeof r === "string") return { success: false, message: r };
    const nome = String(r.snap.nome_alimento);
    const qtd = await quantidadeDa(item.quantidade, r.snap, r.origem, nome);
    if (typeof qtd === "string") return { success: false, message: qtd };

    const subs: Pronto["subs"] = [];
    for (const [j, sub] of item.substitutos.entries()) {
      if (!usarId(sub.id, !!sub.id && subPorId.has(sub.id))) {
        return { success: false, message: "A refeição mudou em outro lugar. Feche e abra de novo." };
      }
      const rs = await snapshotDa(sub.fonte);
      if (typeof rs === "string") return { success: false, message: rs };
      if (rs.snap.recipe_id) return { success: false, message: "Receita não pode ser substituto." };
      const nomeSub = String(rs.snap.nome_alimento);
      const qs = await quantidadeDa(sub.quantidade, rs.snap, rs.origem, nomeSub);
      if (typeof qs === "string") return { success: false, message: qs };
      const { quantidade_porcoes: _p, ...qtdSub } = qs;
      void _p;
      subs.push({ id: sub.id, row: { ...copiar(rs.snap, COLUNAS_SNAPSHOT), ...qtdSub, ordem: j } });
    }
    prontos.push({ id: item.id, row: { ...r.snap, ...qtd, ordem: i }, subs });
  }

  // ---- 2. Grava tudo numa transação só (função salvar_refeicao, migration 0049) ----
  const itensMantidos = new Set(prontos.map((p) => p.id).filter(Boolean));
  const subsMantidos = new Set(prontos.flatMap((p) => p.subs.map((s) => s.id)).filter(Boolean));
  const itensRemovidos = (gravados ?? []).filter((i) => !itensMantidos.has(i.id)).map((i) => i.id);
  const subsRemovidos = (gravados ?? [])
    .filter((i) => itensMantidos.has(i.id))
    .flatMap((i) => i.meal_item_substitutions.map((s) => s.id))
    .filter((id) => !subsMantidos.has(id));
  const observacoes = sanitizeRichText(dados.observacoes);

  const { error: erroGravacao } = await supabase.rpc("salvar_refeicao", {
    p_meal_id: mealId,
    p_refeicao: {
      nome: dados.nome,
      horario: dados.horario || null,
      observacoes: isRichTextEmpty(observacoes) ? null : observacoes,
    },
    p_itens: prontos.map((p) => ({
      id: p.id,
      linha: p.row,
      substitutos: p.subs.map((s) => ({ id: s.id, linha: s.row })),
    })),
    p_itens_removidos: itensRemovidos,
    p_subs_removidos: subsRemovidos,
  });
  // Qualquer falha desfaz tudo no banco: a refeição continua como estava antes do clique.
  if (erroGravacao) return { success: false, message: erroGravacao.message };

  revalidatePath(`/planos/${planId}`);
  return { success: true, message: "Refeição salva." };
}
