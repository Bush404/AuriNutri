import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { createClient } from "@/lib/supabase/server";

import { buildProfissionalPdfHeaderData } from "@/lib/pdf/profissional-header";
import { AntropometriaPdfDocument } from "@/lib/pdf/antropometria-pdf-document";
import { slugify } from "@/lib/pdf/generate-plan-pdf";
import type { AnthropometricAssessment } from "@/lib/types/database.types";

export interface GenerateAntropometriaPdfResult {
  buffer: Buffer;
  pacienteNome: string;
  filename: string;
}

/**
 * Gera o PDF de "Evolução física" (todas as avaliações antropométricas do
 * paciente, em ordem cronológica) — usado pela Central de Envio. Retorna
 * null se o paciente não existe/não pertence ao usuário (RLS) ou não tem
 * nenhuma avaliação registrada ainda.
 */
export async function generateAntropometriaPdf(
  supabase: ReturnType<typeof createClient>,
  user: { id: string; email?: string | null },
  patientId: string
): Promise<GenerateAntropometriaPdfResult | null> {
  const { data: patient } = await supabase
    .from("patients")
    .select("nome")
    .eq("id", patientId)
    .single<{ nome: string }>();

  if (!patient) return null;

  const { data: assessments } = await supabase
    .from("anthropometric_assessments")
    .select("*")
    .eq("patient_id", patientId)
    .order("data_avaliacao", { ascending: true })
    .returns<AnthropometricAssessment[]>();

  if (!assessments || assessments.length === 0) return null;

  const profissional = await buildProfissionalPdfHeaderData(supabase, user);

  const element = createElement(AntropometriaPdfDocument, {
    data: {
      profissional,
      pacienteNome: patient.nome,
      geradoEm: new Date().toISOString(),
      assessments,
    },
  }) as unknown as ReactElement<DocumentProps>;

  const buffer = await renderToBuffer(element);
  const filename = `evolucao-fisica-${slugify(patient.nome)}.pdf`;

  return { buffer, pacienteNome: patient.nome, filename };
}
