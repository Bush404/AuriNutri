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
 * Gera o PDF de "Avaliação antropométrica" de UMA avaliação específica
 * (escolhida por data na Central de Envio, não o histórico inteiro) — usado
 * pela Central de Envio. Retorna null se o paciente ou a avaliação não
 * existem/não pertencem ao usuário (RLS).
 */
export async function generateAntropometriaPdf(
  supabase: ReturnType<typeof createClient>,
  user: { id: string; email?: string | null },
  patientId: string,
  assessmentId: string
): Promise<GenerateAntropometriaPdfResult | null> {
  const { data: patient } = await supabase
    .from("patients")
    .select("nome")
    .eq("id", patientId)
    .single<{ nome: string }>();

  if (!patient) return null;

  const { data: assessment } = await supabase
    .from("anthropometric_assessments")
    .select("*")
    .eq("id", assessmentId)
    .eq("patient_id", patientId)
    .single<AnthropometricAssessment>();

  if (!assessment) return null;

  const profissional = await buildProfissionalPdfHeaderData(supabase, user);

  const element = createElement(AntropometriaPdfDocument, {
    data: {
      profissional,
      pacienteNome: patient.nome,
      geradoEm: new Date().toISOString(),
      assessments: [assessment],
    },
  }) as unknown as ReactElement<DocumentProps>;

  const buffer = await renderToBuffer(element);
  const filename = `avaliacao-antropometrica-${slugify(patient.nome)}-${assessment.data_avaliacao}.pdf`;

  return { buffer, pacienteNome: patient.nome, filename };
}
