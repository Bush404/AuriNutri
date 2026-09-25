import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { createClient } from "@/lib/supabase/server";

import { buildProfissionalPdfHeaderData } from "@/lib/pdf/profissional-header";
import { buildReciboPdfViewModel } from "@/lib/pdf/recibo-pdf-data";
import { ReciboPdfDocument } from "@/lib/pdf/recibo-pdf-document";
import { slugify } from "@/lib/pdf/generate-plan-pdf";

interface PaymentForRecibo {
  id: string;
  valor: number;
  data_pagamento: string | null;
  patient_billings: { descricao: string; patients: { nome: string } | null } | null;
}

export interface GenerateReciboPdfResult {
  buffer: Buffer;
  pacienteNome: string;
  filename: string;
}

/**
 * Gera o Recibo de UM pagamento já recebido (Fase 9, Bloco C) — usado pelo
 * item "Recibo de pagamento" da Central de Envio. Retorna null se o
 * pagamento não existe/não pertence ao usuário (RLS) ou ainda está pendente
 * (data_pagamento is null) — um recibo só faz sentido pra dinheiro já
 * recebido, nunca pra uma cobrança em aberto.
 */
export async function generateReciboPdf(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; email?: string | null },
  paymentId: string
): Promise<GenerateReciboPdfResult | null> {
  const { data: payment } = await supabase
    .from("payments")
    .select("id, valor, data_pagamento, patient_billings(descricao, patients(nome))")
    .eq("id", paymentId)
    .single<PaymentForRecibo>();

  if (!payment || !payment.data_pagamento || !payment.patient_billings) return null;

  const pacienteNome = payment.patient_billings.patients?.nome ?? "Paciente";
  const profissional = await buildProfissionalPdfHeaderData(supabase, user);

  const viewModel = buildReciboPdfViewModel({
    profissional,
    pacienteNome,
    descricao: payment.patient_billings.descricao,
    valor: payment.valor,
    dataPagamento: payment.data_pagamento,
  });

  const element = createElement(ReciboPdfDocument, { data: viewModel }) as unknown as ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(element);
  const filename = `recibo-${slugify(pacienteNome)}-${payment.data_pagamento}.pdf`;

  return { buffer, pacienteNome, filename };
}
