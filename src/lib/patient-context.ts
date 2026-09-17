import { CalendarX2, FileWarning, PhoneOff, Salad, Scale } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AppointmentStatus } from "@/lib/types/database.types";
import { daysBetween } from "@/lib/agenda";

// ============================================================================
// Limiares clínicos — ajustáveis aqui sem tocar no resto do código.
// ============================================================================
export const AVALIACAO_DESATUALIZADA_DIAS = 60;
export const PLANO_DESATUALIZADO_DIAS = 90;

export type PendenciaTipo =
  | "sem_anamnese"
  | "nunca_avaliado"
  | "avaliacao_desatualizada"
  | "sem_plano_ativo"
  | "plano_desatualizado"
  | "faltou_ultima_consulta"
  | "sem_telefone";

export interface PendenciaMeta {
  label: string;
  icon: LucideIcon;
}

export const PENDENCIA_META: Record<PendenciaTipo, PendenciaMeta> = {
  sem_anamnese: { label: "Sem anamnese registrada", icon: FileWarning },
  nunca_avaliado: { label: "Nunca avaliado", icon: Scale },
  avaliacao_desatualizada: {
    label: `Avaliação há mais de ${AVALIACAO_DESATUALIZADA_DIAS} dias`,
    icon: Scale,
  },
  sem_plano_ativo: { label: "Sem plano alimentar ativo", icon: Salad },
  plano_desatualizado: {
    label: `Plano com mais de ${PLANO_DESATUALIZADO_DIAS} dias`,
    icon: Salad,
  },
  faltou_ultima_consulta: { label: "Faltou na última consulta", icon: CalendarX2 },
  sem_telefone: { label: "Sem telefone cadastrado", icon: PhoneOff },
};

/** Ordem de exibição — as mais graves clinicamente primeiro. */
export const PENDENCIA_ORDEM: PendenciaTipo[] = [
  "sem_anamnese",
  "nunca_avaliado",
  "faltou_ultima_consulta",
  "avaliacao_desatualizada",
  "sem_plano_ativo",
  "plano_desatualizado",
  "sem_telefone",
];

export type EvolucaoPeso = "subiu" | "desceu" | "estavel" | "sem_comparacao";

export interface UltimaAvaliacaoInfo {
  data: string; // yyyy-mm-dd
  diasAtras: number;
  pesoKg: number;
  pesoAnteriorKg: number | null;
  evolucaoPeso: EvolucaoPeso;
}

export interface PlanoAtivoInfo {
  id: string;
  nome: string;
  dataInicio: string; // yyyy-mm-dd
  diasAtras: number;
}

export interface UltimaConsultaInfo {
  dataHora: string; // instante UTC
  status: AppointmentStatus;
}

export interface PatientAgendaContext {
  patientId: string;
  patientNome: string;
  patientTelefone: string | null;
  ultimaConsulta: UltimaConsultaInfo | null;
  ultimaAvaliacao: UltimaAvaliacaoInfo | null;
  planoAtivo: PlanoAtivoInfo | null;
  temAnamnese: boolean;
  pendencias: PendenciaTipo[];
}

const PESO_ESTAVEL_EPSILON_KG = 0.1;

/** "hoje" / "há 1 dia" / "há N dias" — usado nos dois lugares que mostram diasAtras. */
export function formatDiasAtras(dias: number): string {
  if (dias <= 0) return "hoje";
  if (dias === 1) return "há 1 dia";
  return `há ${dias} dias`;
}

/** Compara duas avaliações (mais recente primeiro) e classifica a evolução do peso. */
export function compareWeights(pesoAtual: number, pesoAnterior: number | null): EvolucaoPeso {
  if (pesoAnterior === null) return "sem_comparacao";
  const diff = pesoAtual - pesoAnterior;
  if (Math.abs(diff) < PESO_ESTAVEL_EPSILON_KG) return "estavel";
  return diff > 0 ? "subiu" : "desceu";
}

export interface ComputePendenciasInput {
  hojeStr: string; // yyyy-mm-dd
  temAnamnese: boolean;
  ultimaAvaliacao: { data: string } | null;
  planoAtivo: { dataInicio: string } | null;
  ultimaConsulta: { status: AppointmentStatus } | null;
  telefone: string | null;
}

/** Regras de pendência — puro, sem I/O, fácil de testar e de ajustar os limiares. */
export function computePatientPendencias(input: ComputePendenciasInput): PendenciaTipo[] {
  const pendencias: PendenciaTipo[] = [];

  if (!input.temAnamnese) {
    pendencias.push("sem_anamnese");
  }

  if (!input.ultimaAvaliacao) {
    pendencias.push("nunca_avaliado");
  } else if (daysBetween(input.ultimaAvaliacao.data, input.hojeStr) > AVALIACAO_DESATUALIZADA_DIAS) {
    pendencias.push("avaliacao_desatualizada");
  }

  if (!input.planoAtivo) {
    pendencias.push("sem_plano_ativo");
  } else if (daysBetween(input.planoAtivo.dataInicio, input.hojeStr) > PLANO_DESATUALIZADO_DIAS) {
    pendencias.push("plano_desatualizado");
  }

  if (input.ultimaConsulta?.status === "faltou") {
    pendencias.push("faltou_ultima_consulta");
  }

  if (!input.telefone) {
    pendencias.push("sem_telefone");
  }

  return pendencias;
}
