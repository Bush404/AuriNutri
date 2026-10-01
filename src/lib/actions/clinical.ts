"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { anamnesisSchema, type AnamnesisInput } from "@/lib/validations/patient";
import { assessmentSchema, CAMPOS_NUMERICOS, type AssessmentInput } from "@/lib/validations/assessment";
import { calcularResultados, sexoDasFormulas, type MedidasAvaliacao } from "@/lib/anthropometry-results";
import { idadeNaData, type ProtocoloDobras, type SexoParaFormula } from "@/lib/anthropometry";
import { gorduraInfantil, idadeEmMeses, MESES_MAXIMO_INFANTIL } from "@/lib/growth/growth";
import type { AnthropometricAssessment, Patient } from "@/lib/types/database.types";
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

  if (data.tipo === "crianca") {
    const meses = idadeEmMeses(patient.data_nascimento, data.data_avaliacao);
    if (meses === null) {
      return { error: "Cadastre a data de nascimento do paciente para a avaliação infantil." } as const;
    }
    if (meses > MESES_MAXIMO_INFANTIL) {
      return { error: "O protocolo infantil da OMS vai até 19 anos (228 meses). Use a avaliação de adultos." } as const;
    }
    if (!sexo) {
      return { error: "Escolha a base (masculino ou feminino) para as curvas de crescimento." } as const;
    }
    const gordura = gorduraInfantil({
      sexo,
      idadeAnos: Math.floor(meses / 12),
      tricepsMm: data.dobra_triceps_mm ?? null,
      subescapularMm: data.dobra_subescapular_mm ?? null,
      panturrilhaMm: data.dobra_panturrilha_mm ?? null,
    });
    // Só as medidas do formulário infantil; o resto fica vazio.
    const row = {
      tipo: "crianca",
      data_avaliacao: data.data_avaliacao,
      peso_kg: data.peso_kg ?? null,
      altura_cm: data.altura_cm ?? null,
      dobra_triceps_mm: data.dobra_triceps_mm ?? null,
      dobra_subescapular_mm: data.dobra_subescapular_mm ?? null,
      dobra_panturrilha_mm: data.dobra_panturrilha_mm ?? null,
      sexo_referencia: sexo,
      protocolo_dobras: null,
      densidade_corporal: null,
      percentual_gordura: gordura?.ok ? Math.round(gordura.percentualGordura * 100) / 100 : null,
      observacoes: data.observacoes || null,
    };
    return { row } as const;
  }

  const row = {
    tipo: "adulto",
    data_avaliacao: data.data_avaliacao,
    peso_kg: data.peso_kg ?? null,
    altura_cm: data.altura_cm ?? null,
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

/**
 * "Nova avaliação" e "Duplicar": cria o registro na hora (como no WebDiet) e
 * abre a página dele, onde o formulário salva sozinho a cada alteração — fechar
 * a tela nunca perde a avaliação (migration 0041). A nova de adulto já vem com
 * a altura da primeira avaliação do paciente; a duplicada copia as medidas da
 * origem com a data de hoje, sem as observações nem o % digitado à mão numa
 * avaliação antiga (é de outra data).
 */
export async function iniciarAvaliacao(
  patientId: string,
  tipo: "adulto" | "crianca",
  deId?: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  const hoje = new Date().toISOString().slice(0, 10);
  let row: Record<string, unknown> = { tipo, data_avaliacao: hoje };

  if (deId) {
    const { data: origem } = await supabase
      .from("anthropometric_assessments")
      .select("*")
      .eq("id", deId)
      .eq("patient_id", patientId)
      .maybeSingle<AnthropometricAssessment>();
    if (!origem) {
      return { success: false, message: "Avaliação de origem não encontrada." };
    }
    const prepared = await prepareAssessment(supabase, patientId, {
      ...Object.fromEntries(CAMPOS_NUMERICOS.map((c) => [c, origem[c] ?? undefined])),
      percentual_gordura: undefined,
      tipo: "adulto",
      data_avaliacao: hoje,
      peso_kg: origem.peso_kg ?? undefined,
      altura_cm: origem.altura_cm ?? undefined,
      peso_estimado: origem.peso_estimado,
      altura_estimada: origem.altura_estimada,
      bio_idade_metabolica: origem.bio_idade_metabolica ?? undefined,
      lado_referencia: origem.lado_referencia,
      protocolo_dobras: origem.protocolo_dobras ?? undefined,
      formula_densidade: origem.formula_densidade,
      sexo_referencia: origem.sexo_referencia ?? undefined,
    } as AssessmentInput);
    if ("error" in prepared) {
      return { success: false, message: prepared.error };
    }
    row = prepared.row;
  } else if (tipo === "adulto") {
    // Altura de adulto quase não muda: a nova já vem com a da primeira avaliação.
    const { data: primeira } = await supabase
      .from("anthropometric_assessments")
      .select("altura_cm")
      .eq("patient_id", patientId)
      .eq("tipo", "adulto")
      .not("altura_cm", "is", null)
      .order("data_avaliacao", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ altura_cm: number }>();
    row.altura_cm = primeira?.altura_cm ?? null;
  }

  const { data, error } = await supabase
    .from("anthropometric_assessments")
    .insert({ ...row, patient_id: patientId, user_id: user.id })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/pacientes/${patientId}`);
  redirect(`/pacientes/${patientId}/avaliacoes/${data.id}`);
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
