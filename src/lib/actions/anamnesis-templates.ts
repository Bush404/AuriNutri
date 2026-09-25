"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { anamnesisTemplateSchema, type AnamnesisTemplateInput } from "@/lib/validations/patient";
import type { ActionResult } from "@/lib/actions/patients";
import { sanitizeRichText } from "@/lib/rich-text-sanitize";

/**
 * "Meus modelos de anamnese" (Fase 14, migration 0038). A lista aparece na aba
 * Anamnese de qualquer paciente, então toda mudança revalida as páginas de
 * paciente. Exclusão é real: modelo não é registro clínico.
 */
function revalidatePatientPages() {
  revalidatePath("/pacientes/[id]", "page");
}

function prepare(input: AnamnesisTemplateInput) {
  const parsed = anamnesisTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." } as const;
  }
  return { data: { nome: parsed.data.nome, conteudo: sanitizeRichText(parsed.data.conteudo) } } as const;
}

export async function createAnamnesisTemplate(input: AnamnesisTemplateInput): Promise<ActionResult> {
  const prepared = prepare(input);
  if ("error" in prepared) return { success: false, message: prepared.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Sessão expirada. Faça login novamente." };

  const { error } = await supabase.from("anamnesis_templates").insert({ user_id: user.id, ...prepared.data });
  if (error) return { success: false, message: error.message };

  revalidatePatientPages();
  return { success: true, message: "Modelo salvo." };
}

export async function updateAnamnesisTemplate(templateId: string, input: AnamnesisTemplateInput): Promise<ActionResult> {
  const prepared = prepare(input);
  if ("error" in prepared) return { success: false, message: prepared.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("anamnesis_templates")
    .update(prepared.data)
    .eq("id", templateId)
    .select("id");
  if (error) return { success: false, message: error.message };
  if (!data || data.length === 0) return { success: false, message: "Modelo não encontrado." };

  revalidatePatientPages();
  return { success: true, message: "Modelo atualizado." };
}

export async function deleteAnamnesisTemplate(templateId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("anamnesis_templates").delete().eq("id", templateId).select("id");
  if (error) return { success: false, message: error.message };
  if (!data || data.length === 0) return { success: false, message: "Modelo não encontrado." };

  revalidatePatientPages();
  return { success: true, message: "Modelo excluído." };
}
