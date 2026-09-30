import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { createClient } from "@/lib/supabase/server";

import { buildProfissionalPdfHeaderData } from "@/lib/pdf/profissional-header";
import { AntropometriaPdfDocument } from "@/lib/pdf/antropometria-pdf-document";
import { slugify } from "@/lib/pdf/generate-plan-pdf";
import type { AnthropometricAssessment, Patient } from "@/lib/types/database.types";
import { calcularResultados, sexoDasFormulas } from "@/lib/anthropometry-results";
import { idadeNaData } from "@/lib/anthropometry";

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
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; email?: string | null },
  patientId: string,
  assessmentId: string
): Promise<GenerateAntropometriaPdfResult | null> {
  const { data: patient } = await supabase
    .from("patients")
    .select("nome, sexo, data_nascimento")
    .eq("id", patientId)
    .single<Pick<Patient, "nome" | "sexo" | "data_nascimento">>();

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
      assessment,
      resultados: calcularResultados(assessment, {
        sexo: sexoDasFormulas(patient.sexo, assessment.sexo_referencia),
        idade: idadeNaData(patient.data_nascimento, assessment.data_avaliacao),
      }),
    },
  }) as unknown as ReactElement<DocumentProps>;

  const buffer = await renderToBuffer(element);
  const filename = `avaliacao-antropometrica-${slugify(patient.nome)}-${assessment.data_avaliacao}.pdf`;

  return { buffer, pacienteNome: patient.nome, filename };
}
