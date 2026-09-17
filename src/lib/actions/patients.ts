"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { patientSchema, type PatientInput } from "@/lib/validations/patient";

export interface ActionResult {
  success: boolean;
  message?: string;
}

export async function createPatient(input: PatientInput): Promise<ActionResult> {
  const parsed = patientSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Dados inválidos. Verifique o formulário." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  const { data, error } = await supabase
    .from("patients")
    .insert({
      user_id: user.id,
      nome: parsed.data.nome,
      email: parsed.data.email || null,
      telefone: parsed.data.telefone || null,
      data_nascimento: parsed.data.data_nascimento || null,
      sexo: parsed.data.sexo || null,
      endereco: parsed.data.endereco || null,
      objetivo: parsed.data.objetivo || null,
      observacoes: parsed.data.observacoes || null,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/pacientes");
  redirect(`/pacientes/${data.id}`);
}

export async function updatePatient(patientId: string, input: PatientInput): Promise<ActionResult> {
  const parsed = patientSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Dados inválidos. Verifique o formulário." };
  }

  const supabase = createClient();

  const { error } = await supabase
    .from("patients")
    .update({
      nome: parsed.data.nome,
      email: parsed.data.email || null,
      telefone: parsed.data.telefone || null,
      data_nascimento: parsed.data.data_nascimento || null,
      sexo: parsed.data.sexo || null,
      endereco: parsed.data.endereco || null,
      objetivo: parsed.data.objetivo || null,
      observacoes: parsed.data.observacoes || null,
    })
    .eq("id", patientId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/pacientes");
  revalidatePath(`/pacientes/${patientId}`);
  redirect(`/pacientes/${patientId}`);
}

/**
 * Exclusão real e definitiva (decisão de produto — ver DECISIONS.md D5):
 * apaga o paciente e, em cascata (FK on delete cascade), anamnese,
 * avaliações, planos, refeições e itens dele. Diferente das exclusões
 * pontuais dentro de um paciente ativo (avaliação, plano, item de
 * refeição), que usam soft delete — aqui não há o que preservar.
 */
export async function deletePatient(patientId: string): Promise<ActionResult> {
  const supabase = createClient();

  const { error } = await supabase.from("patients").delete().eq("id", patientId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/pacientes");
  return { success: true };
}

export interface PatientPickerResult {
  id: string;
  nome: string;
}

/** Busca leve de pacientes para seletores (agenda, etc.) — mesmo padrão de searchFoodsForPicker. */
export async function searchPatientsForPicker(query: string): Promise<PatientPickerResult[]> {
  const supabase = createClient();
  const termo = query.trim();

  let q = supabase.from("patients").select("id, nome").order("nome").limit(8);
  if (termo) {
    q = q.ilike("nome", `%${termo}%`);
  }

  const { data } = await q.returns<PatientPickerResult[]>();
  return data ?? [];
}
