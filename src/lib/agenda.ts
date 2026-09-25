import { Ban, CalendarCheck, CheckCircle2, Clock, XCircle, type LucideIcon } from "lucide-react";
import type { BadgeProps } from "@/components/ui/badge";
import type { AppointmentStatus, AppointmentTipo } from "@/lib/types/database.types";

// ============================================================================
// Metadados de status/tipo — cores derivadas da paleta já existente
// (primary/muted/destructive/accent), nenhuma cor nova introduzida.
// ============================================================================

export interface AppointmentStatusMeta {
  label: string;
  badgeVariant: NonNullable<BadgeProps["variant"]>;
  /** Ponto sólido usado nos chips compactos da visão mensal. */
  dotClassName: string;
  /** Fundo/borda do card/chip na visão semanal e nos chips do mês. */
  chipClassName: string;
  icon: LucideIcon;
  /** cancelado usa risco no texto para se diferenciar de faltou (ambos "negativos"). */
  strikethrough?: boolean;
}

export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "agendado",
  "confirmado",
  "realizado",
  "faltou",
  "cancelado",
];

export const APPOINTMENT_STATUS_META: Record<AppointmentStatus, AppointmentStatusMeta> = {
  agendado: {
    label: "Agendado",
    badgeVariant: "outline",
    dotClassName: "bg-muted-foreground/50",
    chipClassName: "border-border bg-muted/50 text-foreground",
    icon: Clock,
  },
  confirmado: {
    label: "Confirmado",
    badgeVariant: "default",
    dotClassName: "bg-primary-500",
    chipClassName: "border-primary-200 bg-primary-50 text-primary-800",
    icon: CalendarCheck,
  },
  realizado: {
    label: "Realizado",
    badgeVariant: "success",
    dotClassName: "bg-primary-700",
    chipClassName: "border-primary-300 bg-primary-100 text-primary-800",
    icon: CheckCircle2,
  },
  faltou: {
    label: "Faltou",
    badgeVariant: "destructive",
    dotClassName: "bg-destructive",
    chipClassName: "border-destructive/30 bg-destructive/10 text-destructive",
    icon: XCircle,
  },
  cancelado: {
    label: "Cancelado",
    badgeVariant: "warning",
    dotClassName: "bg-accent",
    chipClassName: "border-accent/40 bg-accent/10 text-accent-foreground",
    icon: Ban,
    strikethrough: true,
  },
};

export const APPOINTMENT_TIPO_LABELS: Record<AppointmentTipo, string> = {
  primeira_consulta: "Primeira consulta",
  retorno: "Retorno",
  avaliacao: "Avaliação",
  outro: "Outro",
};

export const APPOINTMENT_TIPOS: AppointmentTipo[] = [
  "primeira_consulta",
  "retorno",
  "avaliacao",
  "outro",
];

// ============================================================================
// Grade de calendário — funções puras sobre strings "AAAA-MM-DD" (dias de
// calendário já resolvidos no fuso do profissional pela página; nenhuma
// destas funções precisa saber de fuso horário).
// ============================================================================

export const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const MONTH_LABELS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function parseDateStr(dateStr: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateStr.split("-").map(Number);
  return { year, month, day };
}

function toDateStr(utcDate: Date): string {
  return utcDate.toISOString().slice(0, 10);
}

export function addDays(dateStr: string, delta: number): string {
  const { year, month, day } = parseDateStr(dateStr);
  return toDateStr(new Date(Date.UTC(year, month - 1, day + delta)));
}

/** Anda `delta` meses, sempre voltando ao dia 1 — evita "31/jan + 1 mês = 3/mar". */
export function addMonths(dateStr: string, delta: number): string {
  const { year, month } = parseDateStr(dateStr);
  return toDateStr(new Date(Date.UTC(year, month - 1 + delta, 1)));
}

export function startOfMonth(dateStr: string): string {
  const { year, month } = parseDateStr(dateStr);
  return toDateStr(new Date(Date.UTC(year, month - 1, 1)));
}

export function weekdayOf(dateStr: string): number {
  const { year, month, day } = parseDateStr(dateStr);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Os 7 dias (domingo a sábado) da semana que contém `dateStr`. */
export function getWeekDays(dateStr: string): string[] {
  const sunday = addDays(dateStr, -weekdayOf(dateStr));
  return Array.from({ length: 7 }, (_, i) => addDays(sunday, i));
}

/** Semanas completas (domingo a sábado) que cobrem o mês de `dateStr`. */
export function getMonthGridWeeks(dateStr: string): string[][] {
  const { year, month } = parseDateStr(dateStr);
  const firstOfMonth = toDateStr(new Date(Date.UTC(year, month - 1, 1)));
  const lastOfMonth = toDateStr(new Date(Date.UTC(year, month, 0)));

  const gridStart = getWeekDays(firstOfMonth)[0];
  const gridEnd = getWeekDays(lastOfMonth)[6];

  const weeks: string[][] = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(cursor, i)));
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

/** Diferença em dias entre duas datas "AAAA-MM-DD" (positiva quando `toStr` é depois de `fromStr`). */
export function daysBetween(fromStr: string, toStr: string): number {
  const { year: y1, month: m1, day: d1 } = parseDateStr(fromStr);
  const { year: y2, month: m2, day: d2 } = parseDateStr(toStr);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / msPerDay);
}

export function isSameMonth(dateStr: string, referenceDateStr: string): boolean {
  return dateStr.slice(0, 7) === referenceDateStr.slice(0, 7);
}

export function formatMonthLabel(dateStr: string): string {
  const { year, month } = parseDateStr(dateStr);
  return `${MONTH_LABELS[month - 1]} de ${year}`;
}

export function formatDayShort(dateStr: string): string {
  const { day, month } = parseDateStr(dateStr);
  return `${day}/${month}`;
}

export function formatWeekRangeLabel(days: string[]): string {
  return `${formatDayShort(days[0])} – ${formatDayShort(days[6])}`;
}

// ============================================================================
// Horário de parede ("HH:mm") — usado para compor início/término de consulta
// no formulário e para checar sobreposição de agendamentos.
// ============================================================================

export function timeStrToMinutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

export function minutesToTimeStr(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Soma minutos a um horário "HH:mm" — dá a volta à meia-noite se passar de 23:59. */
export function addMinutesToTimeStr(time: string, minutes: number): string {
  return minutesToTimeStr(timeStrToMinutes(time) + minutes);
}

/** Dois intervalos [aStart, aEnd) e [bStart, bEnd) (em minutos ou ms) se sobrepõem? */
export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

// ============================================================================
// Tarefas (Fase 13 do Roadmap 2) — aparecem no calendário junto das consultas,
// com visual próprio (borda tracejada), sem cor nova.
// ============================================================================

/** Chip de tarefa: tracejado para não ser confundido com consulta. */
export function taskChipClassName(concluida: boolean): string {
  return concluida
    ? "border-dashed border-border bg-muted/30 text-muted-foreground line-through"
    : "border-dashed border-foreground/40 bg-background text-foreground";
}

/** "14:30:00" (Postgres `time`) → "14:30". Sem horário → null. */
export function taskTimeLabel(horario: string | null | undefined): string | null {
  return horario ? horario.slice(0, 5) : null;
}

/**
 * Ordem de exibição dentro de um dia: tarefas sem horário primeiro (valem
 * para o dia todo), depois tudo por horário. Empate: consulta antes de tarefa.
 */
export function agendaItemSortKey(item: { kind: "consulta" | "tarefa"; timeStr: string | null }): string {
  if (item.timeStr === null) return "0";
  return `1${item.timeStr}${item.kind === "consulta" ? "0" : "1"}`;
}
