"use server";

import { createClient } from "@/lib/supabase/server";
import { compareWeights, computePatientPendencias, type PatientAgendaContext } from "@/lib/patient-context";
import { daysBetween } from "@/lib/agenda";
import { todayInTimeZone } from "@/lib/timezone";
import type { AppointmentStatus } from "@/lib/types/database.types";

interface GetPatientAgendaContextOptions {
  /** Exclui este agendamento da busca de "última consulta" — usado ao editar um agendamento já existente. */
  excludeAppointmentId?: string;
}

/**
 * Contexto clínico do paciente para a agenda: última consulta, última
 * avaliação (com evolução de peso), plano ativo, anamnese e pendências
 * automáticas. Só leitura — não é uma mutação, por isso não retorna
 * ActionResult, retorna o contexto (ou null se o paciente não existir/não
 * for visível pela RLS).
 */
export async function getPatientAgendaContext(
  patientId: string,
  timeZone: string,
  options: GetPatientAgendaContextOptions = {}
): Promise<PatientAgendaContext | null> {
  const supabase = createClient();

  let ultimaConsultaQuery = supabase
    .from("appointments")
    .select("data_hora, status")
    .eq("patient_id", patientId)
    .lt("data_hora", new Date().toISOString())
    .order("data_hora", { ascending: false })
    .limit(1);

  if (options.excludeAppointmentId) {
    ultimaConsultaQuery = ultimaConsultaQuery.neq("id", options.excludeAppointmentId);
  }

  const [{ data: patient }, { data: avaliacoes }, { data: anamneses }, { data: planos }, { data: ultimaConsultaRows }] =
    await Promise.all([
      supabase.from("patients").select("id, nome, telefone").eq("id", patientId).single<{
        id: string;
        nome: string;
        telefone: string | null;
      }>(),
      supabase
        .from("anthropometric_assessments")
        .select("data_avaliacao, peso_kg")
        .eq("patient_id", patientId)
        .order("data_avaliacao", { ascending: false })
        .limit(2)
        .returns<{ data_avaliacao: string; peso_kg: number }[]>(),
      supabase.from("anamnesis").select("id").eq("patient_id", patientId).limit(1),
      supabase
        .from("meal_plans")
        .select("id, nome, data_inicio")
        .eq("patient_id", patientId)
        .eq("ativo", true)
        .order("data_inicio", { ascending: false })
        .limit(1)
        .returns<{ id: string; nome: string; data_inicio: string }[]>(),
      ultimaConsultaQuery.returns<{ data_hora: string; status: AppointmentStatus }[]>(),
    ]);

  if (!patient) return null;

  const hojeStr = todayInTimeZone(timeZone);

  const ultimaAvaliacaoRow = avaliacoes?.[0] ?? null;
  const ultimaAvaliacao = ultimaAvaliacaoRow
    ? {
        data: ultimaAvaliacaoRow.data_avaliacao,
        diasAtras: Math.max(0, daysBetween(ultimaAvaliacaoRow.data_avaliacao, hojeStr)),
        pesoKg: ultimaAvaliacaoRow.peso_kg,
        pesoAnteriorKg: avaliacoes?.[1]?.peso_kg ?? null,
        evolucaoPeso: compareWeights(ultimaAvaliacaoRow.peso_kg, avaliacoes?.[1]?.peso_kg ?? null),
      }
    : null;

  const planoRow = planos?.[0] ?? null;
  const planoAtivo = planoRow
    ? {
        id: planoRow.id,
        nome: planoRow.nome,
        dataInicio: planoRow.data_inicio,
        diasAtras: Math.max(0, daysBetween(planoRow.data_inicio, hojeStr)),
      }
    : null;

  const ultimaConsultaRow = ultimaConsultaRows?.[0] ?? null;
  const ultimaConsulta = ultimaConsultaRow
    ? { dataHora: ultimaConsultaRow.data_hora, status: ultimaConsultaRow.status }
    : null;

  const temAnamnese = (anamneses?.length ?? 0) > 0;

  const pendencias = computePatientPendencias({
    hojeStr,
    temAnamnese,
    ultimaAvaliacao: ultimaAvaliacao ? { data: ultimaAvaliacao.data } : null,
    planoAtivo: planoAtivo ? { dataInicio: planoAtivo.dataInicio } : null,
    ultimaConsulta,
    telefone: patient.telefone,
  });

  return {
    patientId: patient.id,
    patientNome: patient.nome,
    patientTelefone: patient.telefone,
    ultimaConsulta,
    ultimaAvaliacao,
    planoAtivo,
    temAnamnese,
    pendencias,
  };
}
