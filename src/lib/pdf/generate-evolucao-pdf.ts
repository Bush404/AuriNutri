import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { createClient } from "@/lib/supabase/server";

import { buildProfissionalPdfHeaderData } from "@/lib/pdf/profissional-header";
import { EvolucaoPdfDocument } from "@/lib/pdf/evolucao-pdf-document";
import { slugify } from "@/lib/pdf/generate-plan-pdf";
import { montarSeries, type IndicadorEvolucao } from "@/lib/evolution";
import type { AnthropometricAssessment, AnthropometricAttachment, Patient } from "@/lib/types/database.types";

/**
 * Gera o PDF "Evolução física" de um paciente até a data `ate`, com os
 * indicadores escolhidos. Retorna null se o paciente não existe/não é do
 * usuário (RLS).
 */
export async function generateEvolucaoPdf(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; email?: string | null },
  patientId: string,
  ate: string,
  indicadores: IndicadorEvolucao[]
): Promise<{ buffer: Buffer; filename: string } | null> {
  const [{ data: patient }, { data: assessments }, { data: attachments }] = await Promise.all([
    supabase
      .from("patients")
      .select("nome, sexo, data_nascimento")
      .eq("id", patientId)
      .single<Pick<Patient, "nome" | "sexo" | "data_nascimento">>(),
    supabase
      .from("anthropometric_assessments")
      .select("*")
      .eq("patient_id", patientId)
      .lte("data_avaliacao", ate)
      .returns<AnthropometricAssessment[]>(),
    supabase
      .from("anthropometric_attachments")
      .select("*")
      .eq("patient_id", patientId)
      .lte("data_avaliacao", ate)
      .returns<AnthropometricAttachment[]>(),
  ]);
  if (!patient) return null;

  const series = montarSeries(
    { assessments: assessments ?? [], attachments: attachments ?? [], sexo: patient.sexo, dataNascimento: patient.data_nascimento },
    ate
  );
  const profissional = await buildProfissionalPdfHeaderData(supabase, user);

  const element = createElement(EvolucaoPdfDocument, {
    data: {
      profissional,
      pacienteNome: patient.nome,
      ate,
      geradoEm: new Date().toISOString(),
      indicadores: indicadores.map((id) => ({ id, pontos: series[id] })),
    },
  }) as unknown as ReactElement<DocumentProps>;

  const buffer = await renderToBuffer(element);
  return { buffer, filename: `evolucao-fisica-${slugify(patient.nome)}-${ate}.pdf` };
}
