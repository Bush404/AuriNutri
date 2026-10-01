"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { resultadoDoCalculo } from "@/lib/energy-calculation";
import { massaLivreDaAvaliacao } from "@/lib/evolution";
import { energyCalculationSchema, type EnergyCalculationInput } from "@/lib/validations/energy-calculation";
import type { AnthropometricAssessment, EnergyCalculation, Patient } from "@/lib/types/database.types";
import type { ActionResult } from "@/lib/actions/patients";

const arredondar = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);

/** Colunas copiadas ao duplicar (tudo que é entrada do cálculo). */
const COLUNAS_ENTRADA = [
  "peso_kg",
  "altura_cm",
  "massa_livre_gordura_kg",
  "sexo_referencia",
  "formula",
  "nivel_eer",
  "kcal_por_kg",
  "valor_manual_kcal",
  "fator_atividade",
  "fator_injuria",
  "fator_injuria_label",
  "atividades_met",
  "venta_kg",
  "venta_dias",
  "adicional_gestante_kcal",
  "assessment_id",
  "tmb_kcal",
  "get_kcal",
  "observacoes",
] as const;

/**
 * "Novo cálculo" e "Duplicar": cria o registro na hora e abre a página dele,
 * onde o formulário salva sozinho (mesmo fluxo da antropometria). O novo já
 * vem com peso, altura e massa livre de gordura da avaliação mais recente.
 */
export async function iniciarCalculoEnergetico(
  patientId: string,
  nome: string,
  deId?: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Sessão expirada. Faça login novamente." };

  const hoje = new Date().toISOString().slice(0, 10);
  let row: Record<string, unknown> = { nome: nome.trim().slice(0, 80) || null, data_calculo: hoje };

  if (deId) {
    const { data: origem } = await supabase
      .from("energy_calculations")
      .select("*")
      .eq("id", deId)
      .eq("patient_id", patientId)
      .maybeSingle<EnergyCalculation>();
    if (!origem) return { success: false, message: "Cálculo de origem não encontrado." };
    row = {
      ...Object.fromEntries(COLUNAS_ENTRADA.map((c) => [c, origem[c]])),
      nome: row.nome ?? (origem.nome ? `${origem.nome} (cópia)`.slice(0, 80) : null),
      data_calculo: hoje,
    };
  } else {
    const [{ data: patient }, { data: ultima }] = await Promise.all([
      supabase.from("patients").select("sexo, data_nascimento").eq("id", patientId).single<Pick<Patient, "sexo" | "data_nascimento">>(),
      supabase
        .from("anthropometric_assessments")
        .select("*")
        .eq("patient_id", patientId)
        .not("peso_kg", "is", null)
        .order("data_avaliacao", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<AnthropometricAssessment>(),
    ]);
    if (!patient) return { success: false, message: "Paciente não encontrado." };
    if (ultima) {
      const mlg = massaLivreDaAvaliacao(ultima, patient.sexo, patient.data_nascimento);
      row = {
        ...row,
        assessment_id: ultima.id,
        peso_kg: ultima.peso_kg,
        altura_cm: ultima.altura_cm,
        massa_livre_gordura_kg: arredondar(mlg),
        sexo_referencia: ultima.sexo_referencia,
      };
    }
  }

  const { data, error } = await supabase
    .from("energy_calculations")
    .insert({ ...row, patient_id: patientId, user_id: user.id })
    .select("id")
    .single<{ id: string }>();
  if (error) return { success: false, message: error.message };

  revalidatePath(`/pacientes/${patientId}`);
  redirect(`/pacientes/${patientId}/calculos/${data.id}`);
}

/**
 * Salvamento automático. TMB e GET são recalculados AQUI no servidor (não
 * confia no valor da tela), com o sexo e a data de nascimento do cadastro.
 */
export async function atualizarCalculoEnergetico(
  calculoId: string,
  patientId: string,
  input: EnergyCalculationInput
): Promise<ActionResult> {
  const parsed = energyCalculationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Verifique os valores informados." };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { data: patient } = await supabase
    .from("patients")
    .select("sexo, data_nascimento")
    .eq("id", patientId)
    .single<Pick<Patient, "sexo" | "data_nascimento">>();
  if (!patient) return { success: false, message: "Paciente não encontrado." };

  const entradas = {
    data_calculo: d.data_calculo,
    peso_kg: d.peso_kg ?? null,
    altura_cm: d.altura_cm ?? null,
    massa_livre_gordura_kg: d.massa_livre_gordura_kg ?? null,
    sexo_referencia: (d.sexo_referencia as "masculino" | "feminino" | undefined) ?? null,
    formula: d.formula ?? null,
    nivel_eer: (d.nivel_eer as EnergyCalculation["nivel_eer"] | undefined) ?? null,
    kcal_por_kg: d.kcal_por_kg ?? null,
    valor_manual_kcal: d.valor_manual_kcal ?? null,
    fator_atividade: d.fator_atividade,
    fator_injuria: d.fator_injuria,
    atividades_met: d.atividades_met,
    venta_kg: d.venta_kg || null,
    venta_dias: d.venta_dias ?? null,
    adicional_gestante_kcal: d.adicional_gestante_kcal ?? null,
  };
  const r = resultadoDoCalculo(entradas, patient);

  const { error } = await supabase
    .from("energy_calculations")
    .update({
      ...entradas,
      nome: d.nome?.slice(0, 80) ?? null,
      assessment_id: d.assessment_id ?? null,
      fator_injuria_label: d.fator_injuria_label ?? null,
      observacoes: d.observacoes ?? null,
      tmb_kcal: arredondar(r.tmb),
      get_kcal: arredondar(r.get),
    })
    .eq("id", calculoId)
    .eq("patient_id", patientId);
  if (error) return { success: false, message: error.message };

  revalidatePath(`/pacientes/${patientId}`);
  return { success: true };
}

/** Soft delete via função `security definer` (migration 0042, padrão da 0017). */
export async function excluirCalculoEnergetico(patientId: string, calculoId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("soft_delete_energy_calculation", { calculation_id: calculoId });
  if (error) return { success: false, message: error.message };
  if (!data) return { success: false, message: "Cálculo não encontrado." };
  revalidatePath(`/pacientes/${patientId}`);
  return { success: true };
}
