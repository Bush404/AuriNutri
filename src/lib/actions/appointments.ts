"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  appointmentSchema,
  type AppointmentInput,
  APPOINTMENT_STATUSES,
} from "@/lib/validations/appointment";
import { zonedWallTimeToUtc, utcInstantToZonedDateTime, DEFAULT_TIME_ZONE } from "@/lib/timezone";
import { rangesOverlap } from "@/lib/agenda";
import type { ActionResult } from "@/lib/actions/patients";
import type { AppointmentStatus } from "@/lib/types/database.types";
import { cancelAppointmentBilling } from "@/lib/actions/finance";

/** Busca o fuso do profissional para interpretar o horário de parede digitado. Nunca usa o fuso do servidor. */
async function getProfessionalTimeZone(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("fuso_horario")
    .eq("id", userId)
    .single<{ fuso_horario: string | null }>();
  return data?.fuso_horario || DEFAULT_TIME_ZONE;
}

/**
 * Checagem amigável de sobreposição, feita ANTES de gravar — só pra dar uma
 * mensagem específica (com o horário do conflito) em vez do erro genérico do
 * Postgres. A garantia de verdade é a exclusion constraint da migration
 * 0012 (cobre corrida de requisições concorrentes, que esta checagem sozinha
 * não cobriria).
 */
async function findConflictingAppointment(
  supabase: ReturnType<typeof createClient>,
  newStartIso: string,
  newEndIso: string,
  excludeId?: string
): Promise<{ dataHora: string; duracaoMin: number } | null> {
  // Nenhuma consulta dura mais de 24h — essa janela já cobre qualquer candidata real.
  const windowStart = new Date(new Date(newEndIso).getTime() - 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from("appointments")
    .select("id, data_hora, duracao_min")
    .neq("status", "cancelado")
    .gte("data_hora", windowStart)
    .lt("data_hora", newEndIso);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data } = await query.returns<{ id: string; data_hora: string; duracao_min: number }[]>();

  const newStartMs = new Date(newStartIso).getTime();
  const newEndMs = new Date(newEndIso).getTime();

  for (const row of data ?? []) {
    const rowStartMs = new Date(row.data_hora).getTime();
    const rowEndMs = rowStartMs + row.duracao_min * 60_000;
    if (rangesOverlap(newStartMs, newEndMs, rowStartMs, rowEndMs)) {
      return { dataHora: row.data_hora, duracaoMin: row.duracao_min };
    }
  }
  return null;
}

function conflictMessage(conflict: { dataHora: string; duracaoMin: number }, timeZone: string): string {
  const inicio = utcInstantToZonedDateTime(conflict.dataHora, timeZone).timeStr;
  const fimIso = new Date(new Date(conflict.dataHora).getTime() + conflict.duracaoMin * 60_000).toISOString();
  const fim = utcInstantToZonedDateTime(fimIso, timeZone).timeStr;
  return `Já existe uma consulta agendada nesse horário (${inicio}–${fim}).`;
}

/** Traduz a exclusion constraint da migration 0012 (rede de segurança contra corrida de requisições). */
function isOverlapConstraintError(error: { code?: string } | null): boolean {
  return error?.code === "23P01";
}

export interface CreateAppointmentResult extends ActionResult {
  /** Id da consulta recém-criada — usado pelo diálogo pra ligar o Status financeiro a ela logo em seguida. */
  id?: string;
}

export async function createAppointment(input: AppointmentInput): Promise<CreateAppointmentResult> {
  const parsed = appointmentSchema.safeParse(input);
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

  const timeZone = await getProfessionalTimeZone(supabase, user.id);
  const dataHoraUtc = zonedWallTimeToUtc(parsed.data.data_hora_local, timeZone);
  const dataHoraIso = dataHoraUtc.toISOString();
  const fimIso = new Date(dataHoraUtc.getTime() + parsed.data.duracao_min * 60_000).toISOString();

  const conflict = await findConflictingAppointment(supabase, dataHoraIso, fimIso);
  if (conflict) {
    return { success: false, message: conflictMessage(conflict, timeZone) };
  }

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      patient_id: parsed.data.patient_id,
      user_id: user.id,
      data_hora: dataHoraIso,
      data_fim: fimIso,
      duracao_min: parsed.data.duracao_min,
      tipo: parsed.data.tipo,
      status: parsed.data.status ?? "agendado",
      observacoes: parsed.data.observacoes || null,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    return {
      success: false,
      message: isOverlapConstraintError(error) ? "Já existe uma consulta agendada nesse horário." : error.message,
    };
  }

  revalidatePath("/agenda");
  revalidatePath(`/pacientes/${parsed.data.patient_id}`);
  return { success: true, message: "Consulta agendada com sucesso.", id: data.id };
}

export async function updateAppointment(
  appointmentId: string,
  input: AppointmentInput
): Promise<ActionResult> {
  const parsed = appointmentSchema.safeParse(input);
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

  const timeZone = await getProfessionalTimeZone(supabase, user.id);
  const dataHoraUtc = zonedWallTimeToUtc(parsed.data.data_hora_local, timeZone);
  const dataHoraIso = dataHoraUtc.toISOString();
  const fimIso = new Date(dataHoraUtc.getTime() + parsed.data.duracao_min * 60_000).toISOString();

  const conflict = await findConflictingAppointment(supabase, dataHoraIso, fimIso, appointmentId);
  if (conflict) {
    return { success: false, message: conflictMessage(conflict, timeZone) };
  }

  const { error } = await supabase
    .from("appointments")
    .update({
      patient_id: parsed.data.patient_id,
      data_hora: dataHoraIso,
      data_fim: fimIso,
      duracao_min: parsed.data.duracao_min,
      tipo: parsed.data.tipo,
      status: parsed.data.status ?? "agendado",
      observacoes: parsed.data.observacoes || null,
    })
    .eq("id", appointmentId);

  if (error) {
    return {
      success: false,
      message: isOverlapConstraintError(error) ? "Já existe uma consulta agendada nesse horário." : error.message,
    };
  }

  revalidatePath("/agenda");
  revalidatePath(`/pacientes/${parsed.data.patient_id}`);
  return { success: true, message: "Consulta atualizada com sucesso." };
}

export async function updateAppointmentStatus(
  appointmentId: string,
  status: AppointmentStatus
): Promise<ActionResult> {
  if (!APPOINTMENT_STATUSES.includes(status)) {
    return { success: false, message: "Status inválido." };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("appointments")
    .update({ status })
    .eq("id", appointmentId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/agenda");
  return { success: true };
}

/**
 * Remarca só a data/hora, sem tocar nos demais campos — usada pelo botão
 * "Remarcar" e pelo arrastar-para-remarcar da visão semanal, que não têm
 * (nem precisam ter) o restante do formulário em mãos.
 */
const WALL_TIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export async function rescheduleAppointment(
  appointmentId: string,
  dataHoraLocal: string
): Promise<ActionResult> {
  if (!WALL_TIME_REGEX.test(dataHoraLocal) || Number(dataHoraLocal.slice(-2)) % 15 !== 0) {
    return { success: false, message: "Horário inválido — use intervalos de 15 minutos." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  const { data: current } = await supabase
    .from("appointments")
    .select("duracao_min")
    .eq("id", appointmentId)
    .single<{ duracao_min: number }>();

  if (!current) {
    return { success: false, message: "Consulta não encontrada." };
  }

  const timeZone = await getProfessionalTimeZone(supabase, user.id);
  const dataHoraUtc = zonedWallTimeToUtc(dataHoraLocal, timeZone);
  const dataHoraIso = dataHoraUtc.toISOString();
  const fimIso = new Date(dataHoraUtc.getTime() + current.duracao_min * 60_000).toISOString();

  const conflict = await findConflictingAppointment(supabase, dataHoraIso, fimIso, appointmentId);
  if (conflict) {
    return { success: false, message: conflictMessage(conflict, timeZone) };
  }

  const { error } = await supabase
    .from("appointments")
    .update({ data_hora: dataHoraIso, data_fim: fimIso })
    .eq("id", appointmentId);

  if (error) {
    return {
      success: false,
      message: isOverlapConstraintError(error) ? "Já existe uma consulta agendada nesse horário." : error.message,
    };
  }

  revalidatePath("/agenda");
  return { success: true, message: "Consulta remarcada." };
}

/**
 * Soft delete via função `security definer` (migration 0017) — ver comentário em deleteRecipe
 * (recipes.ts). Também cancela a cobrança financeira ligada à consulta (avulsa sempre, pacote
 * só quando a última consulta dele é excluída) — ver cancelAppointmentBilling (finance.ts).
 *
 * `keepBilling: true` pula essa cascata — usado quando a consulta já foi paga e o profissional
 * escolheu explicitamente manter o pagamento registrado ao excluir só a consulta da Agenda (não
 * faz sentido apagar dinheiro já recebido só porque a consulta some do calendário).
 */
export async function deleteAppointment(
  appointmentId: string,
  options?: { keepBilling?: boolean }
): Promise<ActionResult> {
  const supabase = createClient();

  const { data: appointment } = await supabase
    .from("appointments")
    .select("patient_id, patient_billing_id")
    .eq("id", appointmentId)
    .single<{ patient_id: string; patient_billing_id: string | null }>();

  const { data, error } = await supabase.rpc("soft_delete_appointment", { appointment_id: appointmentId });

  if (error) {
    return { success: false, message: error.message };
  }
  if (!data) {
    return { success: false, message: "Agendamento não encontrado." };
  }

  if (!options?.keepBilling) {
    await cancelAppointmentBilling(appointmentId, appointment?.patient_billing_id ?? null);
  }

  revalidatePath("/agenda");
  revalidatePath("/financeiro");
  revalidatePath("/dashboard");
  if (appointment?.patient_id) {
    revalidatePath(`/pacientes/${appointment.patient_id}`);
  }
  return { success: true };
}
