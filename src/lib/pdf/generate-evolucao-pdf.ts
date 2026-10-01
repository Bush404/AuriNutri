import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { createClient } from "@/lib/supabase/server";

import { buildProfissionalPdfHeaderData } from "@/lib/pdf/profissional-header";
import { EvolucaoPdfDocument } from "@/lib/pdf/evolucao-pdf-document";
import { slugify } from "@/lib/pdf/generate-plan-pdf";
import { montarComparacao, type ChaveItem } from "@/lib/evolution";
import type { AnthropometricAssessment, AnthropometricAttachment, Patient } from "@/lib/types/database.types";

/**
 * PDF "Evolução" comparando até 5 avaliações/relatórios do paciente.
 * Retorna null se o paciente não existe/não é do usuário (RLS) ou se nenhum
 * dos itens pedidos foi encontrado.
 */
export async function generateEvolucaoPdf(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; email?: string | null },
  patientId: string,
  chaves: ChaveItem[]
): Promise<{ buffer: Buffer; filename: string } | null> {
  const idsAvaliacoes = chaves.filter((c) => c.startsWith("a:")).map((c) => c.slice(2));
  const idsAnexos = chaves.filter((c) => c.startsWith("x:")).map((c) => c.slice(2));

  const [{ data: patient }, { data: assessments }, { data: attachments }] = await Promise.all([
    supabase
      .from("patients")
      .select("nome, sexo, data_nascimento")
      .eq("id", patientId)
      .single<Pick<Patient, "nome" | "sexo" | "data_nascimento">>(),
    idsAvaliacoes.length
      ? supabase
          .from("anthropometric_assessments")
          .select("*")
          .eq("patient_id", patientId)
          .in("id", idsAvaliacoes)
          .returns<AnthropometricAssessment[]>()
      : Promise.resolve({ data: [] as AnthropometricAssessment[] }),
    idsAnexos.length
      ? supabase
          .from("anthropometric_attachments")
          .select("*")
          .eq("patient_id", patientId)
          .in("id", idsAnexos)
          .returns<AnthropometricAttachment[]>()
      : Promise.resolve({ data: [] as AnthropometricAttachment[] }),
  ]);
  if (!patient) return null;

  const comparacao = montarComparacao(
    { assessments: assessments ?? [], attachments: attachments ?? [], sexo: patient.sexo, dataNascimento: patient.data_nascimento },
    chaves
  );
  if (comparacao.colunas.length === 0) return null;

  const profissional = await buildProfissionalPdfHeaderData(supabase, user);
  const element = createElement(EvolucaoPdfDocument, {
    data: { profissional, pacienteNome: patient.nome, geradoEm: new Date().toISOString(), comparacao },
  }) as unknown as ReactElement<DocumentProps>;

  const buffer = await renderToBuffer(element);
  const ultima = comparacao.colunas[comparacao.colunas.length - 1].data;
  return { buffer, filename: `evolucao-${slugify(patient.nome)}-${ultima}.pdf` };
}
