"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { taskSchema, type TaskInput } from "@/lib/validations/appointment";
import type { ActionResult } from "@/lib/actions/patients";

export async function createTask(input: TaskInput): Promise<ActionResult> {
  const parsed = taskSchema.safeParse(input);
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

  const { error } = await supabase.from("tasks").insert({
    user_id: user.id,
    patient_id: parsed.data.patient_id ?? null,
    appointment_id: parsed.data.appointment_id ?? null,
    titulo: parsed.data.titulo,
    descricao: parsed.data.descricao || null,
    data_limite: parsed.data.data_limite || null,
    concluida: parsed.data.concluida ?? false,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/agenda");
  if (parsed.data.patient_id) {
    revalidatePath(`/pacientes/${parsed.data.patient_id}`);
  }
  return { success: true, message: "Pendência criada com sucesso." };
}

export async function updateTask(taskId: string, input: TaskInput): Promise<ActionResult> {
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Dados inválidos. Verifique o formulário." };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("tasks")
    .update({
      patient_id: parsed.data.patient_id ?? null,
      appointment_id: parsed.data.appointment_id ?? null,
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao || null,
      data_limite: parsed.data.data_limite || null,
      concluida: parsed.data.concluida ?? false,
    })
    .eq("id", taskId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/agenda");
  if (parsed.data.patient_id) {
    revalidatePath(`/pacientes/${parsed.data.patient_id}`);
  }
  return { success: true, message: "Pendência atualizada com sucesso." };
}

export async function toggleTaskConcluida(taskId: string, concluida: boolean): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from("tasks").update({ concluida }).eq("id", taskId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/agenda");
  return { success: true };
}

/** Soft delete — mesmo padrão de deleteAssessment/deleteAppointment (deleted_at, nunca .delete() real). */
export async function deleteTask(taskId: string): Promise<ActionResult> {
  const supabase = createClient();

  const { error } = await supabase
    .from("tasks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", taskId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/agenda");
  return { success: true };
}
