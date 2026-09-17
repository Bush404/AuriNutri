"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  appointmentSchema,
  type AppointmentInput,
  APPOINTMENT_STATUSES,
} from "@/lib/validations/appointment";
import { zonedWallTimeToUtc, DEFAULT_TIME_ZONE } from "@/lib/timezone";
import type { ActionResult } from "@/lib/actions/patients";
import type { AppointmentStatus } from "@/lib/types/database.types";

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

export async function createAppointment(input: AppointmentInput): Promise<ActionResult> {
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

  const { error } = await supabase.from("appointments").insert({
    patient_id: parsed.data.patient_id,
    user_id: user.id,
    data_hora: dataHoraUtc.toISOString(),
    duracao_min: parsed.data.duracao_min,
    tipo: parsed.data.tipo,
    status: parsed.data.status ?? "agendado",
    observacoes: parsed.data.observacoes || null,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/agenda");
  revalidatePath(`/pacientes/${parsed.data.patient_id}`);
  return { success: true, message: "Consulta agendada com sucesso." };
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

  const { error } = await supabase
    .from("appointments")
    .update({
      patient_id: parsed.data.patient_id,
      data_hora: dataHoraUtc.toISOString(),
      duracao_min: parsed.data.duracao_min,
      tipo: parsed.data.tipo,
      status: parsed.data.status ?? "agendado",
      observacoes: parsed.data.observacoes || null,
    })
    .eq("id", appointmentId);

  if (error) {
    return { success: false, message: error.message };
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
export async function rescheduleAppointment(
  appointmentId: string,
  dataHoraLocal: string
): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  const timeZone = await getProfessionalTimeZone(supabase, user.id);
  const dataHoraUtc = zonedWallTimeToUtc(dataHoraLocal, timeZone);

  const { error } = await supabase
    .from("appointments")
    .update({ data_hora: dataHoraUtc.toISOString() })
    .eq("id", appointmentId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/agenda");
  return { success: true, message: "Consulta remarcada." };
}

/** Soft delete — mesmo padrão de deleteAssessment/deleteMealPlan (deleted_at, nunca .delete() real). */
export async function deleteAppointment(appointmentId: string): Promise<ActionResult> {
  const supabase = createClient();

  const { error } = await supabase
    .from("appointments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", appointmentId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/agenda");
  return { success: true };
}
