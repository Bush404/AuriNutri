"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { patientConsentSchema, type PatientConsentInput } from "@/lib/validations/patient-consent";
import type { ActionResult } from "@/lib/actions/patients";
import type { TipoConsentimento } from "@/lib/types/database.types";

const TIPO_LABELS: Record<TipoConsentimento, string> = {
  exames: "exames",
  fotos: "fotos",
  dados_clinicos: "dados clínicos",
};

/**
 * Registra um novo consentimento — sempre um INSERT (um evento novo), nunca
 * reaproveita uma linha existente. Se já houver um consentimento ATIVO desse
 * tipo para o paciente, recusa (a UI deve mostrar "revogar", não "conceder"
 * de novo, quando já ativo) — evita duas linhas ativas simultâneas para o
 * mesmo tipo, o que tornaria ambíguo qual revogar.
 */
export async function grantPatientConsent(patientId: string, input: PatientConsentInput): Promise<ActionResult> {
  const parsed = patientConsentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Selecione o tipo de dado e como o consentimento foi obtido." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  const jaAtivo = await hasActiveConsent(patientId, parsed.data.tipo);
  if (jaAtivo) {
    return { success: false, message: `Já existe um consentimento ativo para ${TIPO_LABELS[parsed.data.tipo]}.` };
  }

  const { error } = await supabase.from("patient_consents").insert({
    patient_id: patientId,
    user_id: user.id,
    tipo: parsed.data.tipo,
    forma: parsed.data.forma,
    observacoes: parsed.data.observacoes ?? null,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/pacientes/${patientId}`);
  return { success: true, message: "Consentimento registrado." };
}

/**
 * Revoga um consentimento ativo — UPDATE no MESMO registro (concedido=false,
 * data_revogacao=now()), nunca cria linha nova nem apaga a antiga. Só marca
 * `concedido`/`data_revogacao`: são as únicas colunas que a role
 * `authenticated` tem permissão de editar (ver migration 0019) — o resto do
 * registro (tipo, forma, quando foi concedido) fica congelado para sempre.
 *
 * DECISÃO REGISTRADA (2026-09-19): revogar bloqueia novo uso desse tipo a
 * partir de agora (via has_active_patient_consent, consultado pelos blocos
 * de upload) — NÃO apaga automaticamente arquivo/dado já existente. Excluir
 * o que já existe, se o paciente pedir, é uma ação separada e explícita a
 * ser implementada à parte, não um efeito colateral automático daqui.
 */
export async function revokePatientConsent(patientId: string, consentId: string): Promise<ActionResult> {
  const supabase = createClient();

  const { error } = await supabase
    .from("patient_consents")
    .update({ concedido: false, data_revogacao: new Date().toISOString() })
    .eq("id", consentId)
    .eq("concedido", true)
    .is("data_revogacao", null);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/pacientes/${patientId}`);
  return { success: true, message: "Consentimento revogado." };
}

/**
 * Checagem reutilizável pelos blocos de upload (exames, fotos — ainda não
 * implementados): existe consentimento ATIVO desse tipo para este paciente?
 * A REGRA ESTRUTURAL do Bloco A é que a opção de enviar um arquivo não deve
 * nem aparecer sem isso — os componentes de upload futuros chamam esta
 * função ANTES de renderizar qualquer botão/campo de upload, não depois.
 * Roda via `has_active_patient_consent` (security definer, migration 0019),
 * mas o filtro por `auth.uid()` já está dentro da função — nunca vaza
 * consentimento de paciente de outro profissional.
 */
export async function hasActiveConsent(patientId: string, tipo: TipoConsentimento): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase.rpc("has_active_patient_consent", { p_patient_id: patientId, p_tipo: tipo });
  return data === true;
}
