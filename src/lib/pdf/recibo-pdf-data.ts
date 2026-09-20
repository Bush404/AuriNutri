import { formatCurrencyBRL } from "@/lib/finance";
import { formatDate } from "@/lib/utils";
import { valorPorExtenso } from "@/lib/pdf/valor-extenso";
import type { ProfissionalPdfHeaderData } from "@/lib/pdf/profissional-header";

/**
 * View-model puro do Recibo — sem I/O, só formatação. Mantém o mesmo
 * princípio de plan-pdf-data.ts: nenhuma conta acontece no componente
 * visual (recibo-pdf-document.tsx), só aqui, e é testável sem renderizar PDF.
 *
 * VOCABULÁRIO (Fase 9, Bloco C): este documento chama-se "Recibo", nunca
 * "nota fiscal"/"NFS-e"/"fatura" — não substitui documento fiscal, e por
 * isso também não tem numeração sequencial (isso pertenceria a um NFS-e).
 */
export interface ReciboPdfViewModel {
  profissional: ProfissionalPdfHeaderData;
  pacienteNome: string;
  descricao: string;
  valorFormatado: string;
  valorPorExtensoFormatado: string;
  dataPagamentoFormatada: string;
  geradoEmFormatada: string;
}

export interface BuildReciboPdfViewModelInput {
  profissional: ProfissionalPdfHeaderData;
  pacienteNome: string;
  descricao: string;
  valor: number;
  /** Data em que o pagamento foi recebido — "yyyy-mm-dd". */
  dataPagamento: string;
}

export function buildReciboPdfViewModel(input: BuildReciboPdfViewModelInput): ReciboPdfViewModel {
  return {
    profissional: input.profissional,
    pacienteNome: input.pacienteNome,
    descricao: input.descricao,
    valorFormatado: formatCurrencyBRL(input.valor),
    valorPorExtensoFormatado: valorPorExtenso(input.valor),
    dataPagamentoFormatada: formatDate(input.dataPagamento),
    geradoEmFormatada: formatDate(new Date().toISOString().slice(0, 10)),
  };
}
