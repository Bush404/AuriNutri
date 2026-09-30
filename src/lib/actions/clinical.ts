"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { anamnesisSchema, type AnamnesisInput } from "@/lib/validations/patient";
import { assessmentSchema, CAMPOS_NUMERICOS, type AssessmentInput } from "@/lib/validations/assessment";
import { calcularResultados, sexoDasFormulas, type MedidasAvaliacao } from "@/lib/anthropometry-results";
import { idadeNaData, type ProtocoloDobras, type SexoParaFormula } from "@/lib/anthropometry";
import type { Patient } from "@/lib/types/database.types";
import type { ActionResult } from "@/lib/actions/patients";
import { sanitizeRichText } from "@/lib/rich-text-sanitize";
import { isRichTextEmpty } from "@/lib/rich-text";

/** Limpa e valida o texto da anamnese. Devolve `{ error }` se estiver inválido ou vazio. */
function prepareAnamnesis(input: AnamnesisInput) {
  const parsed = anamnesisSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos. Verifique o formulário." } as const;
  }
  const conteudo = sanitizeRichText(parsed.data.conteudo);
  if (isRichTextEmpty(conteudo)) {
    return { error: "Escreva a anamnese antes de salvar." } as const;
  }
  return { data: { titulo: parsed.data.titulo ?? null, conteudo } } as const;
}

/**
 * Cria um NOVO registro de anamnese. anamnesis é 1:N por paciente (histórico
 * clínico) — isto nunca sobrescreve um registro anterior. Texto livre (Fase
 * 14): só `titulo` e `conteudo`; as colunas por tema antigas não são escritas.
 */
export async function createAnamnesis(patientId: string, input: AnamnesisInput): Promise<ActionResult> {
  const prepared = prepareAnamnesis(input);
  if ("error" in prepared) {
    return { success: false, message: prepared.error };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  const { error } = await supabase.from("anamnesis").insert({
    patient_id: patientId,
    user_id: user.id,
    ...prepared.data,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/pacientes/${patientId}`);
  return { success: true, message: "Anamnese registrada com sucesso." };
}

/**
 * Corrige um registro de anamnese específico já existente (não cria um novo).
 * Num registro antigo, o texto montado das colunas por tema passa a ser o
 * `conteudo`; as colunas antigas continuam intactas no banco.
 */
export async function updateAnamnesis(
  anamnesisId: string,
  patientId: string,
  input: AnamnesisInput
): Promise<ActionResult> {
  const prepared = prepareAnamnesis(input);
  if ("error" in prepared) {
    return { success: false, message: prepared.error };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("anamnesis")
    .update(prepared.data)
    .eq("id", anamnesisId)
    .eq("patient_id", patientId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/pacientes/${patientId}`);
  return { success: true, message: "Anamnese atualizada com sucesso." };
}

/**
 * Soft delete via função `security definer` (migration 0037, padrão da 0017).
 * O registro some da tela mas continua no banco e no audit_log.
 */
export async function deleteAnamnesis(patientId: string, anamnesisId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("soft_delete_anamnesis", { anamnesis_id: anamnesisId });

  if (error) {
    return { success: false, message: error.message };
  }
  if (!data) {
    return { success: false, message: "Anamnese não encontrada." };
  }

  revalidatePath(`/pacientes/${patientId}`);
  return { success: true, message: "Anamnese excluída." };
}

/**
 * Monta a linha a gravar a partir do formulário. O % de gordura do protocolo é
 * recalculado AQUI no servidor (não confia no valor da tela) com o sexo e a
 * idade do cadastro, e gravado como foto do momento — ver migration 0039.
 */
async function prepareAssessment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  patientId: string,
  input: AssessmentInput
) {
  const parsed = assessmentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os valores informados." } as const;
  }
  const data = parsed.data;

  const { data: patient } = await supabase
    .from("patients")
    .select("sexo, data_nascimento")
    .eq("id", patientId)
    .single<Pick<Patient, "sexo" | "data_nascimento">>();
  if (!patient) {
    return { error: "Paciente não encontrado." } as const;
  }

  const sexo = sexoDasFormulas(patient.sexo, data.sexo_referencia as SexoParaFormula | undefined);
  const row = {
    data_avaliacao: data.data_avaliacao,
    peso_kg: data.peso_kg,
    altura_cm: data.altura_cm,
    peso_estimado: data.peso_estimado,
    altura_estimada: data.altura_estimada,
    ...Object.fromEntries(CAMPOS_NUMERICOS.map((c) => [c, data[c] ?? null])),
    bio_idade_metabolica: data.bio_idade_metabolica ?? null,
    lado_referencia: data.lado_referencia,
    protocolo_dobras: (data.protocolo_dobras as ProtocoloDobras | undefined) ?? null,
    formula_densidade: data.formula_densidade,
    sexo_referencia: sexo,
    observacoes: data.observacoes || null,
  } as unknown as Record<string, unknown> & MedidasAvaliacao;

  if (row.protocolo_dobras) {
    const resultados = calcularResultados(row, {
      sexo,
      idade: idadeNaData(patient.data_nascimento, data.data_avaliacao),
    });
    const gordura = resultados.gordura?.ok ? resultados.gordura : null;
    row.percentual_gordura = gordura ? Math.round(gordura.percentualGordura * 100) / 100 : null;
    row.densidade_corporal = gordura?.densidade ? Math.round(gordura.densidade * 100000) / 100000 : null;
  } else {
    row.densidade_corporal = null;
  }

  return { row } as const;
}

export async function createAssessment(
  patientId: string,
  input: AssessmentInput
): Promise<ActionResult & { id?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  const prepared = await prepareAssessment(supabase, patientId, input);
  if ("error" in prepared) {
    return { success: false, message: prepared.error };
  }

  const { data, error } = await supabase
    .from("anthropometric_assessments")
    .insert({ ...prepared.row, patient_id: patientId, user_id: user.id })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/pacientes/${patientId}`);
  return { success: true, message: "Avaliação registrada com sucesso.", id: data.id };
}

export async function updateAssessment(
  assessmentId: string,
  patientId: string,
  input: AssessmentInput
): Promise<ActionResult> {
  const supabase = await createClient();
  const prepared = await prepareAssessment(supabase, patientId, input);
  if ("error" in prepared) {
    return { success: false, message: prepared.error };
  }

  const { error } = await supabase
    .from("anthropometric_assessments")
    .update(prepared.row)
    .eq("id", assessmentId)
    .eq("patient_id", patientId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/pacientes/${patientId}`);
  revalidatePath(`/pacientes/${patientId}/avaliacoes/${assessmentId}`);
  return { success: true, message: "Avaliação atualizada com sucesso." };
}

/** Soft delete via função `security definer` (migration 0017) — ver comentário em deleteRecipe (recipes.ts). */
export async function deleteAssessment(patientId: string, assessmentId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("soft_delete_assessment", { assessment_id: assessmentId });

  if (error) {
    return { success: false, message: error.message };
  }
  if (!data) {
    return { success: false, message: "Avaliação não encontrada." };
  }

  revalidatePath(`/pacientes/${patientId}`);
  return { success: true };
}
