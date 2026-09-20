"use server";

import { createClient } from "@/lib/supabase/server";
import { listPlanShareLinks } from "@/lib/actions/plan-share";
import { utcInstantToZonedDateTime } from "@/lib/timezone";
import { formatCurrencyBRL } from "@/lib/finance";
import { formatDate } from "@/lib/utils";
import type { PlanShareToken } from "@/lib/types/database.types";

export interface SendCenterAssessment {
  id: string;
  dataFormatada: string;
}

export interface SendCenterPayment {
  id: string;
  descricao: string;
  valorFormatado: string;
  dataFormatada: string;
}

export interface SendCenterContext {
  profissionalNome: string;
  planoAtivo: { id: string; nome: string } | null;
  planoShareLinks: PlanShareToken[];
  /** Avaliações antropométricas do paciente, mais recente primeiro — o profissional escolhe qual data enviar. */
  avaliacoes: SendCenterAssessment[];
  /** Data/hora já formatadas no fuso do profissional (profiles.fuso_horario) — nunca no fuso do processo/servidor. */
  proximaConsulta: { dataFormatada: string; horaFormatada: string } | null;
  /** Pagamentos já recebidos deste paciente, mais recente primeiro — só estes podem virar Recibo (pagamento pendente não tem o que recibar). */
  pagamentosRecebidos: SendCenterPayment[];
}

/**
 * Reúne tudo que a Central de Envio precisa mostrar — só leitura, nenhuma
 * mutação (gerar o link do plano continua sendo uma ação explícita do
 * profissional, ver createPlanShareLink em plan-share.ts, nunca disparada
 * automaticamente aqui). "Plano ativo" usa o mesmo critério já usado no
 * painel de contexto da agenda (meal_plans.ativo = true, mais recente por
 * data_inicio) — não um critério novo.
 */
export async function getSendCenterContext(patientId: string): Promise<SendCenterContext | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: profile }, { data: planos }, { data: proximaRows }, { data: avaliacoesRows }, { data: pagamentosRows }] =
    await Promise.all([
    supabase
      .from("profiles")
      .select("nome, fuso_horario")
      .eq("id", user.id)
      .single<{ nome: string; fuso_horario: string }>(),
    supabase
      .from("meal_plans")
      .select("id, nome")
      .eq("patient_id", patientId)
      .eq("ativo", true)
      .order("data_inicio", { ascending: false })
      .limit(1)
      .returns<{ id: string; nome: string }[]>(),
    supabase
      .from("appointments")
      .select("data_hora")
      .eq("patient_id", patientId)
      .gte("data_hora", new Date().toISOString())
      .neq("status", "cancelado")
      .order("data_hora", { ascending: true })
      .limit(1)
      .returns<{ data_hora: string }[]>(),
    supabase
      .from("anthropometric_assessments")
      .select("id, data_avaliacao")
      .eq("patient_id", patientId)
      .order("data_avaliacao", { ascending: false })
      .returns<{ id: string; data_avaliacao: string }[]>(),
    supabase
      .from("payments")
      .select("id, valor, data_pagamento, patient_billings!inner(descricao, patient_id)")
      .eq("patient_billings.patient_id", patientId)
      .not("data_pagamento", "is", null)
      .order("data_pagamento", { ascending: false })
      .returns<{ id: string; valor: number; data_pagamento: string; patient_billings: { descricao: string } }[]>(),
  ]);

  const planoAtivo = planos?.[0] ?? null;

  const planoShareLinks = planoAtivo ? await listPlanShareLinks(planoAtivo.id) : [];

  const timeZone = profile?.fuso_horario || "America/Sao_Paulo";
  const proximaRow = proximaRows?.[0] ?? null;
  const proximaConsulta = proximaRow
    ? (() => {
        const { dateStr, timeStr } = utcInstantToZonedDateTime(proximaRow.data_hora, timeZone);
        return { dataFormatada: formatDate(dateStr), horaFormatada: timeStr };
      })()
    : null;

  return {
    profissionalNome: profile?.nome ?? "",
    planoAtivo: planoAtivo ? { id: planoAtivo.id, nome: planoAtivo.nome } : null,
    planoShareLinks,
    avaliacoes: (avaliacoesRows ?? []).map((a) => ({ id: a.id, dataFormatada: formatDate(a.data_avaliacao) })),
    proximaConsulta,
    pagamentosRecebidos: (pagamentosRows ?? []).map((p) => ({
      id: p.id,
      descricao: p.patient_billings.descricao,
      valorFormatado: formatCurrencyBRL(p.valor),
      dataFormatada: formatDate(p.data_pagamento),
    })),
  };
}
