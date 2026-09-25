"use client";

import { CheckSquare } from "lucide-react";

import type { AppointmentWithPatient, TaskWithPatient } from "@/lib/types/database.types";
import {
  APPOINTMENT_STATUS_META,
  WEEKDAY_LABELS,
  agendaItemSortKey,
  isSameMonth,
  taskChipClassName,
  taskTimeLabel,
} from "@/lib/agenda";
import { utcInstantToZonedDateTime } from "@/lib/timezone";
import { cn } from "@/lib/utils";

const MAX_CHIPS_PER_DAY = 3;

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
  onCreate: (dateStr: string) => void;
  onSelect: (appointment: AppointmentWithPatient) => void;
  onSelectTask: (task: TaskWithPatient) => void;
  onShowDay: (dateStr: string) => void;
}

export function MonthView({
  weeks,
  monthAnchor,
  todayStr,
  appointments,
  tasks,
  timeZone,
  onCreate,
  onSelect,
  onSelectTask,
  onShowDay,
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
      <div className="grid grid-cols-7 border-b border-border bg-muted/40">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {weeks.flat().map((dateStr) => {
          const dayItems = byDay.get(dateStr) ?? [];
          const visible = dayItems.slice(0, MAX_CHIPS_PER_DAY);
          const overflow = dayItems.length - visible.length;
          const isCurrentMonth = isSameMonth(dateStr, monthAnchor);
          const isToday = dateStr === todayStr;
          const dayNumber = Number(dateStr.slice(-2));

          return (
            <div
              key={dateStr}
              role="button"
              tabIndex={0}
              onClick={() => onCreate(dateStr)}
              onKeyDown={(e) => e.key === "Enter" && onCreate(dateStr)}
              className={cn(
                "flex min-h-[92px] flex-col gap-1 border-b border-r border-border p-1.5 text-left last:border-r-0 sm:min-h-[112px] sm:p-2",
                !isCurrentMonth && "bg-muted/20"
              )}
            >
              <span
                className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                  isToday ? "bg-primary text-primary-foreground" : isCurrentMonth ? "text-foreground" : "text-muted-foreground/60"
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
                          "flex items-center gap-1 truncate rounded border px-1.5 py-0.5 text-left text-[11px] font-medium hover:brightness-95 sm:text-xs",
                          taskChipClassName(task.concluida)
                        )}
                        title={`Tarefa: ${item.timeStr ? item.timeStr + " — " : ""}${task.titulo}${task.concluida ? " (concluída)" : ""}`}
                      >
                        <CheckSquare className="h-3 w-3 shrink-0" aria-hidden />
                        <span className="truncate">
                          {item.timeStr && <span className="hidden sm:inline">{item.timeStr} </span>}
                          {task.titulo}
                        </span>
                      </button>
                    );
                  }
                  const { appointment, timeStr } = item;
                  const meta = APPOINTMENT_STATUS_META[appointment.status];
                  return (
                    <button
                      key={appointment.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(appointment);
                      }}
                      className={cn(
                        "truncate rounded border px-1.5 py-0.5 text-left text-[11px] font-medium hover:brightness-95 sm:text-xs",
                        meta.chipClassName,
                        meta.strikethrough && "line-through"
                      )}
                      title={`${timeStr} — ${appointment.patients?.nome ?? "Paciente"} (${meta.label})`}
                    >
                      <span className="hidden sm:inline">{timeStr} </span>
                      {appointment.patients?.nome ?? "Paciente"}
                    </button>
                  );
                })}

                {overflow > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onShowDay(dateStr);
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
