"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { medidaCaseiraSchema, type MedidaCaseiraInput } from "@/lib/validations/meal-plan";
import type { ActionResult } from "@/lib/actions/patients";
import type { FoodMeasure } from "@/lib/types/database.types";

/**
 * Medidas caseiras do profissional (Fase 17, Bloco D). As do IBGE são só de
 * leitura (vêm pelo script de importação); estas valem só para quem criou.
 * A RLS (migration 0045) só deixa criar para alimento que ele enxerga.
 */
export async function criarMedidaCaseira(
  foodId: string,
  input: MedidaCaseiraInput,
  planId?: string,
): Promise<ActionResult & { medida?: FoodMeasure }> {
  const parsed = medidaCaseiraSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Confira a medida." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Sessão expirada. Faça login novamente." };

  const { data, error } = await supabase
    .from("food_measures")
    .insert({
      food_id: foodId,
      user_id: user.id,
      nome: parsed.data.nome,
      gramas: parsed.data.gramas,
      fonte: "personalizado",
    })
    .select("*")
    .single<FoodMeasure>();
  if (error || !data) return { success: false, message: error?.message ?? "Não foi possível criar a medida." };

  if (planId) revalidatePath(`/planos/${planId}`);
  return { success: true, medida: data };
}

/** Apaga uma medida própria. Os planos que já a usaram guardam a cópia e não mudam. */
export async function excluirMedidaCaseira(medidaId: string, planId?: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("food_measures")
    .delete()
    .eq("id", medidaId)
    .eq("fonte", "personalizado")
    .select("id")
    .returns<{ id: string }[]>();
  if (error) return { success: false, message: error.message };
  if (!data?.length) return { success: false, message: "Medida não encontrada." };

  if (planId) revalidatePath(`/planos/${planId}`);
  return { success: true };
}
