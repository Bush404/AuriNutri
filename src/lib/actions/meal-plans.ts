"use server";

import { revalidatePath } from "next/cache";
import { copiarRefeicoes } from "@/lib/plan-copy";
import { kcalDoPlano } from "@/lib/meal-planning";
import { quantidadeDoItem } from "@/lib/household-measures";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  mealPlanSchema,
  planejamentoSchema,
  type MealPlanInput,
  type PlanejamentoInput,
} from "@/lib/validations/meal-plan";
import { distribuirMacros } from "@/lib/meal-planning";
import type { ActionResult } from "@/lib/actions/patients";
import type { Meal, MealItem, MealPlan } from "@/lib/types/database.types";

export async function createMealPlan(patientId: string, input: MealPlanInput): Promise<ActionResult> {
  const parsed = mealPlanSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Verifique os dados do plano." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  const { data, error } = await supabase
    .from("meal_plans")
    .insert({
      patient_id: patientId,
      user_id: user.id,
      nome: parsed.data.nome,
      data_inicio: parsed.data.data_inicio,
      observacoes: parsed.data.observacoes || null,
      meta_kcal: parsed.data.meta_kcal ?? null,
      meta_proteinas_g: parsed.data.meta_proteinas_g ?? null,
      meta_carboidratos_g: parsed.data.meta_carboidratos_g ?? null,
      meta_gorduras_g: parsed.data.meta_gorduras_g ?? null,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    return { success: false, message: error.message };
  }

  // Plano em branco já vem com as três refeições básicas (Fase 17, Bloco G — como no WebDiet).
  const { error: refeicoesError } = await supabase
    .from("meals")
    .insert(REFEICOES_PADRAO.map((r, ordem) => ({ ...r, ordem, meal_plan_id: data.id, user_id: user.id })));
  if (refeicoesError) {
    return { success: false, message: refeicoesError.message };
  }

  revalidatePath(`/pacientes/${patientId}`);
  revalidatePath("/planos");
  redirect(`/planos/${data.id}`);
}

const REFEICOES_PADRAO = [
  { nome: "Café da manhã", horario: "07:00" },
  { nome: "Almoço", horario: "12:00" },
  { nome: "Jantar", horario: "19:00" },
];

/**
 * "Começar de um modelo" (Fase 17, Bloco G): plano novo para o paciente com
 * as refeições, alimentos e substitutos de um plano favorito (de qualquer
 * paciente do mesmo profissional — a RLS só deixa ler os próprios). O
 * planejamento teórico NÃO vem: as metas eram do outro paciente.
 */
export async function criarPlanoDeModelo(
  patientId: string,
  modeloId: string,
  input: MealPlanInput,
): Promise<ActionResult> {
  const parsed = mealPlanSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Verifique os dados do plano." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  const { data: modelo } = await supabase
    .from("meal_plans")
    .select("id, observacoes")
    .eq("id", modeloId)
    .eq("favorito", true)
    .maybeSingle<{ id: string; observacoes: string | null }>();
  if (!modelo) {
    return { success: false, message: "Modelo não encontrado." };
  }

  const { data, error } = await supabase
    .from("meal_plans")
    .insert({
      patient_id: patientId,
      user_id: user.id,
      nome: parsed.data.nome,
      data_inicio: parsed.data.data_inicio,
      observacoes: parsed.data.observacoes || modelo.observacoes,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) {
    return { success: false, message: error?.message ?? "Falha ao criar o plano." };
  }

  const erroCopia = await copiarRefeicoes(supabase, user.id, modelo.id, data.id);
  if (erroCopia) {
    return { success: false, message: erroCopia };
  }

  revalidatePath(`/pacientes/${patientId}`);
  revalidatePath("/planos");
  redirect(`/planos/${data.id}`);
}

/** Estrela do plano: favorito = modelo para outros pacientes. */
export async function alternarPlanoFavorito(
  planId: string,
  favorito: boolean,
  patientId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("meal_plans").update({ favorito }).eq("id", planId);
  if (error) return { success: false, message: error.message };
  revalidatePath(`/pacientes/${patientId}`);
  return { success: true, message: favorito ? "Plano salvo como modelo." : "Plano tirado dos modelos." };
}

/** "Ordenar planos": `ids` na ordem em que devem aparecer na aba do paciente. */
export async function reordenarPlanos(patientId: string, ids: string[]): Promise<ActionResult> {
  if (!ids.length || ids.length > 200) return { success: false, message: "Ordem inválida." };
  const supabase = await createClient();
  const resultados = await Promise.all(
    ids.map((id, ordem) => supabase.from("meal_plans").update({ ordem }).eq("id", id).eq("patient_id", patientId)),
  );
  const erro = resultados.find((r) => r.error)?.error;
  if (erro) return { success: false, message: erro.message };
  revalidatePath(`/pacientes/${patientId}`);
  return { success: true };
}

export interface ModeloDePlano {
  id: string;
  nome: string;
  paciente: string;
  kcal: number;
  refeicoes: number;
}

/** Os planos favoritos do profissional, para "De um modelo". */
export async function listarModelosDePlano(): Promise<ModeloDePlano[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("meal_plans")
    .select("id, nome, patients(nome), meals(id, meal_items(quantidade_g, porcao_referencia_g, calorias_kcal))")
    .eq("favorito", true)
    .order("nome")
    .returns<
      {
        id: string;
        nome: string;
        patients: { nome: string } | null;
        meals: { id: string; meal_items: Pick<MealItem, "quantidade_g" | "porcao_referencia_g" | "calorias_kcal">[] }[];
      }[]
    >();
  return (data ?? []).map((p) => ({
    id: p.id,
    nome: p.nome,
    paciente: p.patients?.nome ?? "",
    kcal: kcalDoPlano(p.meals.flatMap((m) => m.meal_items)),
    refeicoes: p.meals.length,
  }));
}

export interface PreviaDoModelo {
  refeicoes: { nome: string; horario: string | null; itens: { nome: string; quantidade: string }[] }[];
}

/** "Preview" do modelo: as refeições e os alimentos, sem abrir o plano. */
export async function previaDoModelo(modeloId: string): Promise<PreviaDoModelo> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("meals")
    .select(
      "nome, horario, ordem, meal_items(nome_alimento, quantidade_g, quantidade_porcoes, medida_nome, medida_gramas, medida_quantidade, ordem)",
    )
    .eq("meal_plan_id", modeloId)
    .order("ordem")
    .returns<(Pick<Meal, "nome" | "horario" | "ordem"> & { meal_items: MealItem[] })[]>();
  return {
    refeicoes: (data ?? []).map((m) => ({
      nome: m.nome,
      horario: m.horario,
      itens: (m.meal_items ?? [])
        .slice()
        .sort((a, b) => a.ordem - b.ordem)
        .map((i) => ({
          nome: i.nome_alimento,
          quantidade: i.quantidade_porcoes !== null ? `${i.quantidade_porcoes} porção(ões)` : quantidadeDoItem(i),
        })),
    })),
  };
}

export async function updateMealPlan(planId: string, input: MealPlanInput): Promise<ActionResult> {
  const parsed = mealPlanSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Verifique os dados do plano." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("meal_plans")
    .update({
      nome: parsed.data.nome,
      data_inicio: parsed.data.data_inicio,
      observacoes: parsed.data.observacoes || null,
      meta_kcal: parsed.data.meta_kcal ?? null,
      meta_proteinas_g: parsed.data.meta_proteinas_g ?? null,
      meta_carboidratos_g: parsed.data.meta_carboidratos_g ?? null,
      meta_gorduras_g: parsed.data.meta_gorduras_g ?? null,
    })
    .eq("id", planId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/planos/${planId}`);
  revalidatePath("/planos");
  return { success: true, message: "Plano atualizado com sucesso." };
}

/**
 * "Adicionar planejamento teórico" (Fase 17, Bloco A). Os gramas e o GET são
 * recalculados AQUI (não confia na tela) e gravados nas metas do plano
 * (migration 0007); o modo e os valores digitados ficam em planejamento_*
 * (migration 0043) para a janela reabrir igual.
 */
export async function salvarPlanejamentoTeorico(planId: string, input: PlanejamentoInput): Promise<ActionResult> {
  const parsed = planejamentoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Verifique os valores do planejamento." };
  }
  const d = parsed.data;
  const r = distribuirMacros({
    modo: d.modo,
    pesoKg: d.peso_kg ?? null,
    getKcal: d.get_kcal ?? null,
    proteinas: d.proteinas,
    lipidios: d.lipidios,
    carboidratos: d.carboidratos,
  });
  if (!r.ok) return { success: false, message: r.motivo };

  const arred = (v: number) => Math.round(v * 10) / 10;
  const supabase = await createClient();
  const { error } = await supabase
    .from("meal_plans")
    .update({
      meta_kcal: Math.round(r.metas.kcal),
      meta_proteinas_g: arred(r.metas.proteinas_g),
      meta_gorduras_g: arred(r.metas.lipidios_g),
      meta_carboidratos_g: arred(r.metas.carboidratos_g),
      planejamento_modo: d.modo,
      planejamento_peso_kg: d.peso_kg ?? null,
      planejamento_proteinas: d.proteinas,
      planejamento_lipidios: d.lipidios,
      planejamento_carboidratos: d.carboidratos,
      planejamento_calculo_id: d.calculo_id ?? null,
    })
    .eq("id", planId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/planos/${planId}`);
  return { success: true, message: "Planejamento teórico salvo." };
}

/** Tira o planejamento teórico (e as metas) do plano. */
export async function removerPlanejamentoTeorico(planId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("meal_plans")
    .update({
      meta_kcal: null,
      meta_proteinas_g: null,
      meta_gorduras_g: null,
      meta_carboidratos_g: null,
      planejamento_modo: null,
      planejamento_peso_kg: null,
      planejamento_proteinas: null,
      planejamento_lipidios: null,
      planejamento_carboidratos: null,
      planejamento_calculo_id: null,
    })
    .eq("id", planId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/planos/${planId}`);
  return { success: true, message: "Planejamento teórico removido." };
}

export async function toggleMealPlanStatus(planId: string, ativo: boolean, patientId?: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("meal_plans").update({ ativo }).eq("id", planId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/planos/${planId}`);
  revalidatePath("/planos");
  if (patientId) revalidatePath(`/pacientes/${patientId}`);
  return { success: true };
}

/**
 * Duplica um plano inteiro (plano + refeições + itens + substitutos) para o mesmo
 * paciente. DECISÃO: copia os snapshots nutricionais VERBATIM — nunca
 * rebusca os valores atuais do alimento em `foods`. O profissional edita
 * depois o que quiser na cópia, sem afetar o plano original.
 */
export async function duplicateMealPlan(planId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  const { data: originalPlan, error: planError } = await supabase
    .from("meal_plans")
    .select("*")
    .eq("id", planId)
    .single<MealPlan>();

  if (planError || !originalPlan) {
    return { success: false, message: "Plano não encontrado." };
  }

  const { data: newPlan, error: newPlanError } = await supabase
    .from("meal_plans")
    .insert({
      patient_id: originalPlan.patient_id,
      user_id: user.id,
      nome: `${originalPlan.nome} (cópia)`,
      data_inicio: new Date().toISOString().slice(0, 10),
      observacoes: originalPlan.observacoes,
      meta_kcal: originalPlan.meta_kcal,
      meta_proteinas_g: originalPlan.meta_proteinas_g,
      meta_carboidratos_g: originalPlan.meta_carboidratos_g,
      meta_gorduras_g: originalPlan.meta_gorduras_g,
      planejamento_modo: originalPlan.planejamento_modo,
      planejamento_peso_kg: originalPlan.planejamento_peso_kg,
      planejamento_proteinas: originalPlan.planejamento_proteinas,
      planejamento_lipidios: originalPlan.planejamento_lipidios,
      planejamento_carboidratos: originalPlan.planejamento_carboidratos,
      planejamento_calculo_id: originalPlan.planejamento_calculo_id,
    })
    .select("id")
    .single<{ id: string }>();

  if (newPlanError || !newPlan) {
    return { success: false, message: newPlanError?.message ?? "Falha ao duplicar o plano." };
  }

  // Refeições, alimentos e substitutos, com a cópia nutricional como está (src/lib/plan-copy.ts).
  const erroCopia = await copiarRefeicoes(supabase, user.id, planId, newPlan.id);
  if (erroCopia) {
    return { success: false, message: erroCopia };
  }

  revalidatePath(`/pacientes/${originalPlan.patient_id}`);
  revalidatePath("/planos");
  redirect(`/planos/${newPlan.id}`);
}

/** Soft delete via função `security definer` (migration 0017) — ver comentário em deleteRecipe (recipes.ts). */
export async function deleteMealPlan(planId: string, patientId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("soft_delete_meal_plan", { plan_id: planId });

  if (error) {
    return { success: false, message: error.message };
  }
  if (!data) {
    return { success: false, message: "Plano não encontrado." };
  }

  revalidatePath(`/pacientes/${patientId}`);
  revalidatePath("/planos");
  return { success: true };
}
