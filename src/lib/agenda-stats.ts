import type { AppointmentStatus } from "@/lib/types/database.types";
import { addDays, getWeekDays } from "@/lib/agenda";
import { variacaoPercentual } from "@/lib/dashboard";
import { utcInstantToZonedDateTime } from "@/lib/timezone";

/**
 * Números do topo da Agenda (Fase 19): sempre em relação a HOJE, no fuso do
 * profissional — não mudam ao navegar pelo calendário. Consulta cancelada não conta.
 */
export interface AgendaStatsRow {
  data_hora: string;
  status: AppointmentStatus;
  patient_id: string;
}

export interface AgendaStats {
  hoje: { total: number; confirmadas: number; agendadas: number };
  proximasHoje: number;
  semana: { total: number; variacao: number | null };
  atendidosMes: { total: number; variacao: number | null };
}

/** Primeiro dia (aaaa-mm-dd) da janela que as estatísticas precisam buscar. */
export function inicioDaJanelaDeStats(todayStr: string): string {
  const semanaPassada = getWeekDays(addDays(todayStr, -7))[0];
  const [ano, mes] = todayStr.split("-").map(Number);
  const mesAnterior = mes === 1 ? `${ano - 1}-12-01` : `${ano}-${String(mes - 1).padStart(2, "0")}-01`;
  return semanaPassada < mesAnterior ? semanaPassada : mesAnterior;
}

/** Dia seguinte ao último que as estatísticas precisam (fim exclusivo). */
export function fimDaJanelaDeStats(todayStr: string): string {
  const fimDaSemana = addDays(getWeekDays(todayStr)[6], 1);
  const [ano, mes] = todayStr.split("-").map(Number);
  const proximoMes = mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, "0")}-01`;
  return fimDaSemana > proximoMes ? fimDaSemana : proximoMes;
}

export function calcularAgendaStats(
  rows: AgendaStatsRow[],
  todayStr: string,
  nowIso: string,
  timeZone: string
): AgendaStats {
  const validas = rows
    .filter((r) => r.status !== "cancelado")
    .map((r) => ({ ...r, dateStr: utcInstantToZonedDateTime(r.data_hora, timeZone).dateStr }));

  const deHoje = validas.filter((r) => r.dateStr === todayStr);
  const semana = new Set(getWeekDays(todayStr));
  const semanaPassada = new Set(getWeekDays(addDays(todayStr, -7)));
  const totalSemana = validas.filter((r) => semana.has(r.dateStr)).length;
  const totalSemanaPassada = validas.filter((r) => semanaPassada.has(r.dateStr)).length;

  const mes = todayStr.slice(0, 7);
  const [ano, m] = todayStr.split("-").map(Number);
  const mesAnterior = m === 1 ? `${ano - 1}-12` : `${ano}-${String(m - 1).padStart(2, "0")}`;
  const atendidos = (chave: string) =>
    new Set(validas.filter((r) => r.status === "realizado" && r.dateStr.slice(0, 7) === chave).map((r) => r.patient_id)).size;
  const atendidosMes = atendidos(mes);

  return {
    hoje: {
      total: deHoje.length,
      confirmadas: deHoje.filter((r) => r.status === "confirmado").length,
      agendadas: deHoje.filter((r) => r.status === "agendado").length,
    },
    proximasHoje: deHoje.filter(
      (r) => r.data_hora > nowIso && (r.status === "agendado" || r.status === "confirmado")
    ).length,
    semana: { total: totalSemana, variacao: variacaoPercentual(totalSemana, totalSemanaPassada) },
    atendidosMes: { total: atendidosMes, variacao: variacaoPercentual(atendidosMes, atendidos(mesAnterior)) },
  };
}
