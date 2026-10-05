/**
 * Aba Financeiro do paciente (Fase 19, 05/10/2026): leitura dos dados que já
 * existem — nenhuma regra financeira nova. "Pendente" continua sendo
 * data_pagamento nula; "Vencido" é só a leitura da data de vencimento que
 * cada pagamento já tem (pendente com vencimento antes de hoje).
 */

import type { AppointmentStatus, Payment, PatientBillingTipo } from "@/lib/types/database.types";

export interface ConsultaDoPacote {
  status: AppointmentStatus;
}

export interface PacoteParaResumo {
  tipo: PatientBillingTipo;
  numero_consultas: number | null;
  data_inicio: string;
  created_at: string;
  payments: Pick<Payment, "data_pagamento">[];
  pacote_consultas: ConsultaDoPacote[];
}

/** Uma consulta "ainda vai acontecer": agendada ou confirmada. */
const AINDA_VAI = (s: AppointmentStatus) => s === "agendado" || s === "confirmado";

/**
 * Pacote ativo = o mais recente que ainda tem consulta agendada ou
 * confirmada (decisão de 05/10/2026). Pacote não tem validade no sistema,
 * então "ativo" vem só das consultas.
 */
export function pacoteAtivo<T extends PacoteParaResumo>(billings: T[]): T | null {
  return (
    billings
      .filter((b) => b.tipo === "pacote" && b.pacote_consultas.some((c) => AINDA_VAI(c.status)))
      .sort((a, b) => b.data_inicio.localeCompare(a.data_inicio) || b.created_at.localeCompare(a.created_at))[0] ?? null
  );
}

/**
 * Consultas do pacote por situação. Falta fica SEPARADA de realizada: se a
 * falta "gasta" a consulta é política do consultório, não do sistema.
 */
export function consultasDoPacote(p: Pick<PacoteParaResumo, "numero_consultas" | "pacote_consultas">) {
  const conta = (s: AppointmentStatus) => p.pacote_consultas.filter((c) => c.status === s).length;
  return {
    total: p.numero_consultas ?? p.pacote_consultas.length,
    realizadas: conta("realizado"),
    faltas: conta("faltou"),
    agendadas: p.pacote_consultas.filter((c) => AINDA_VAI(c.status)).length,
  };
}

export type SituacaoPagamento = "pago" | "pendente" | "parcial";

/** Pago = todas as parcelas recebidas; parcial = parte delas (parcelado); pendente = nenhuma. */
export function situacaoPagamento(payments: Pick<Payment, "data_pagamento">[]): SituacaoPagamento {
  const pagas = payments.filter((p) => p.data_pagamento).length;
  if (payments.length > 0 && pagas === payments.length) return "pago";
  return pagas > 0 ? "parcial" : "pendente";
}

/** Pendente com vencimento antes de hoje ("yyyy-mm-dd" no fuso do Brasil). */
export function estaVencido(p: Pick<Payment, "data_pagamento" | "data_vencimento">, hoje: string): boolean {
  return !p.data_pagamento && p.data_vencimento < hoje;
}

/** Próxima cobrança = a pendente com o vencimento mais próximo (as vencidas vêm primeiro). */
export function proximaCobranca<T extends Pick<Payment, "data_pagamento" | "data_vencimento">>(pagamentos: T[]): T | null {
  return pagamentos.filter((p) => !p.data_pagamento).sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))[0] ?? null;
}

/** "1 avulsa • 1 pacote" (só o que existir). */
export function rotuloTipos(billings: Pick<PacoteParaResumo, "tipo">[]): string {
  const avulsas = billings.filter((b) => b.tipo === "avulso").length;
  const pacotes = billings.filter((b) => b.tipo === "pacote").length;
  return [
    avulsas > 0 && `${avulsas} ${avulsas === 1 ? "avulsa" : "avulsas"}`,
    pacotes > 0 && `${pacotes} ${pacotes === 1 ? "pacote" : "pacotes"}`,
  ]
    .filter(Boolean)
    .join(" • ");
}
