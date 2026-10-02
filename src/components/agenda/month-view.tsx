"use client";

import { CheckSquare } from "lucide-react";

import type { AppointmentStatus, AppointmentWithPatient, TaskWithPatient } from "@/lib/types/database.types";
import {
  APPOINTMENT_STATUS_META,
  WEEKDAY_HEADER_LABELS,
  agendaItemSortKey,
  isSameMonth,
  taskTimeLabel,
} from "@/lib/agenda";
import { utcInstantToZonedDateTime } from "@/lib/timezone";
import { cn } from "@/lib/utils";

const MAX_CHIPS_PER_DAY = 2;

/** Fundo suave da "pílula" de cada status (a bolinha usa o dotClassName do status). */
const PILL_BG: Record<AppointmentStatus, string> = {
  agendado: "bg-muted/70",
  confirmado: "bg-primary-50",
  realizado: "bg-success-soft",
  faltou: "bg-destructive/10",
  cancelado: "bg-muted/50 text-muted-foreground",
};

type DayItem =
  | { kind: "consulta"; timeStr: string; appointment: AppointmentWithPatient }
  | { kind: "tarefa"; timeStr: string | null; task: TaskWithPatient };

interface MonthViewProps {
  weeks: string[][];
  monthAnchor: string;
  todayStr: string;
  appointments: AppointmentWithPatient[];
  tasks: TaskWithPatient[];
  timeZone: string;
  selectedDate: string;
  selectedAppointmentId: string | null;
  onSelectDay: (dateStr: string) => void;
  /** Clique no espaço vazio do dia: seleciona e pergunta o que adicionar. */
  onEmptyClick: (dateStr: string) => void;
  onSelect: (appointment: AppointmentWithPatient) => void;
  onSelectTask: (task: TaskWithPatient) => void;
}

/**
 * Calendário do mês (Fase 19, layout de referência "Agenda mensal"): clicar no espaço
 * vazio de um dia seleciona o dia e pergunta o que adicionar; clicar numa consulta
 * mostra os detalhes no painel; a tarefa abre a própria janela; "+N mais" só seleciona.
 */
export function MonthView({
  weeks,
  monthAnchor,
  todayStr,
  appointments,
  tasks,
  timeZone,
  selectedDate,
  selectedAppointmentId,
  onSelectDay,
  onEmptyClick,
  onSelect,
  onSelectTask,
}: MonthViewProps) {
  const byDay = new Map<string, DayItem[]>();
  function push(dateStr: string, item: DayItem) {
    const list = byDay.get(dateStr) ?? [];
    list.push(item);
    byDay.set(dateStr, list);
  }
  for (const appointment of appointments) {
    const { dateStr, timeStr } = utcInstantToZonedDateTime(appointment.data_hora, timeZone);
    push(dateStr, { kind: "consulta", timeStr, appointment });
  }
  for (const task of tasks) {
    if (task.data_limite) push(task.data_limite, { kind: "tarefa", timeStr: taskTimeLabel(task.horario), task });
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => agendaItemSortKey(a).localeCompare(agendaItemSortKey(b)));
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAY_HEADER_LABELS.map((label) => (
          <div key={label} className="px-2 py-2.5 text-center text-xs font-medium text-muted-foreground">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {weeks.flat().map((dateStr, index) => {
          const dayItems = byDay.get(dateStr) ?? [];
          const visible = dayItems.slice(0, MAX_CHIPS_PER_DAY);
          const overflow = dayItems.length - visible.length;
          const isCurrentMonth = isSameMonth(dateStr, monthAnchor);
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          const dayNumber = Number(dateStr.slice(-2));
          const isLastColumn = index % 7 === 6;

          return (
            <div
              key={dateStr}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-label={`Dia ${dayNumber}: adicionar consulta, pacote ou tarefa`}
              onClick={() => onEmptyClick(dateStr)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onEmptyClick(dateStr);
                }
              }}
              className={cn(
                "flex min-h-[92px] cursor-pointer flex-col gap-1 border-b border-border p-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:min-h-[108px] sm:p-2",
                !isLastColumn && "border-r",
                isSelected ? "bg-secondary/70" : "bg-card hover:bg-muted/40"
              )}
            >
              <span
                className={cn(
                  "inline-flex h-6 min-w-6 items-center justify-center self-start rounded-full px-1 text-sm font-semibold tabular-nums",
                  isToday
                    ? "bg-primary text-primary-foreground"
                    : isCurrentMonth
                      ? "text-foreground"
                      : "font-normal text-muted-foreground/60"
                )}
              >
                {dayNumber}
              </span>

              <div className="flex flex-1 flex-col gap-1 overflow-hidden">
                {visible.map((item) => {
                  if (item.kind === "tarefa") {
                    const { task } = item;
                    return (
                      <button
                        key={task.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectTask(task);
                        }}
                        className={cn(
                          "flex items-center gap-1.5 truncate rounded-md border border-dashed border-foreground/30 bg-card px-1.5 py-1 text-left text-[11px] font-medium text-foreground transition-colors hover:bg-muted sm:text-xs",
                          task.concluida && "text-muted-foreground line-through"
                        )}
                        title={`Tarefa: ${item.timeStr ? item.timeStr + " — " : ""}${task.titulo}${task.concluida ? " (concluída)" : ""}`}
                      >
                        <CheckSquare className="h-3 w-3 shrink-0" aria-hidden />
                        {item.timeStr && <span className="hidden shrink-0 text-muted-foreground tabular-nums lg:inline">{item.timeStr}</span>}
                        <span className="truncate">{task.titulo}</span>
                      </button>
                    );
                  }
                  const { appointment, timeStr } = item;
                  const meta = APPOINTMENT_STATUS_META[appointment.status];
                  const isSelectedAppointment = appointment.id === selectedAppointmentId;
                  return (
                    <button
                      key={appointment.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(appointment);
                      }}
                      className={cn(
                        "flex items-center gap-1.5 truncate rounded-md px-1.5 py-1 text-left text-[11px] font-medium text-foreground transition-shadow hover:ring-1 hover:ring-primary-200 sm:text-xs",
                        PILL_BG[appointment.status],
                        meta.strikethrough && "line-through",
                        isSelectedAppointment && "ring-1 ring-primary"
                      )}
                      title={`${timeStr} — ${appointment.patients?.nome ?? "Paciente"} (${meta.label})`}
                    >
                      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", meta.dotClassName)} aria-hidden />
                      <span className="hidden shrink-0 text-muted-foreground tabular-nums lg:inline">{timeStr}</span>
                      <span className="truncate">{appointment.patients?.nome ?? "Paciente"}</span>
                    </button>
                  );
                })}

                {overflow > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectDay(dateStr);
                    }}
                    className="truncate px-1.5 text-left text-[11px] font-medium text-muted-foreground hover:text-foreground sm:text-xs"
                  >
                    +{overflow} mais
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
