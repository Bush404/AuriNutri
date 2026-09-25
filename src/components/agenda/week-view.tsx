"use client";

import { useState, useTransition } from "react";
import { CheckSquare, Clock } from "lucide-react";
import { toast } from "sonner";

import type { AppointmentWithPatient, TaskWithPatient } from "@/lib/types/database.types";
import {
  APPOINTMENT_STATUS_META,
  WEEKDAY_LABELS,
  formatDayShort,
  taskChipClassName,
  taskTimeLabel,
  timeStrToMinutes,
  weekdayOf,
} from "@/lib/agenda";
import { utcInstantToZonedDateTime } from "@/lib/timezone";
import { rescheduleAppointment } from "@/lib/actions/appointments";
import { cn } from "@/lib/utils";

const GRID_START_HOUR = 6;
const GRID_END_HOUR = 21;
const HOUR_HEIGHT_PX = 56;
const GRID_HEIGHT_PX = (GRID_END_HOUR - GRID_START_HOUR) * HOUR_HEIGHT_PX;
const PX_PER_MINUTE = HOUR_HEIGHT_PX / 60;
const DRAG_CLICK_THRESHOLD_PX = 4;
const SNAP_MINUTES = 15;

const HOURS = Array.from({ length: GRID_END_HOUR - GRID_START_HOUR }, (_, i) => GRID_START_HOUR + i);

interface WeekViewProps {
  days: string[];
  todayStr: string;
  appointments: AppointmentWithPatient[];
  tasks: TaskWithPatient[];
  timeZone: string;
  onCreate: (dateStr: string, timeStr: string) => void;
  onSelect: (appointment: AppointmentWithPatient) => void;
  onSelectTask: (task: TaskWithPatient) => void;
  onReschedule: (appointment: AppointmentWithPatient) => void;
}

export function WeekView({
  days,
  todayStr,
  appointments,
  tasks,
  timeZone,
  onCreate,
  onSelect,
  onSelectTask,
  onReschedule,
}: WeekViewProps) {
  const byDay = new Map<string, AppointmentWithPatient[]>();
  for (const appointment of appointments) {
    const { dateStr } = utcInstantToZonedDateTime(appointment.data_hora, timeZone);
    const list = byDay.get(dateStr) ?? [];
    list.push(appointment);
    byDay.set(dateStr, list);
  }

  // Tarefa com horário dentro da grade vai na hora; sem horário (ou fora da
  // grade de 6h–21h) vai no topo do dia, no cabeçalho.
  const timedTasks = new Map<string, TaskWithPatient[]>();
  const allDayTasks = new Map<string, TaskWithPatient[]>();
  for (const task of tasks) {
    if (!task.data_limite) continue;
    const time = taskTimeLabel(task.horario);
    const minutes = time ? timeStrToMinutes(time) : null;
    const inGrid = minutes !== null && minutes >= GRID_START_HOUR * 60 && minutes < GRID_END_HOUR * 60;
    const target = inGrid ? timedTasks : allDayTasks;
    const list = target.get(task.data_limite) ?? [];
    list.push(task);
    target.set(task.data_limite, list);
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <div className="grid min-w-[900px] grid-cols-[56px_repeat(7,minmax(140px,1fr))]">
        {/* Cabeçalho */}
        <div className="sticky left-0 z-20 border-b border-r border-border bg-background" />
        {days.map((dateStr) => (
          <div
            key={dateStr}
            className={cn(
              "border-b border-r border-border bg-muted/40 px-2 py-2 text-center last:border-r-0",
              dateStr === todayStr && "bg-primary-50"
            )}
          >
            <p className="text-xs font-semibold text-muted-foreground">{WEEKDAY_LABELS[weekdayOf(dateStr)]}</p>
            <p className={cn("text-sm font-semibold", dateStr === todayStr ? "text-primary-800" : "text-foreground")}>
              {formatDayShort(dateStr)}
            </p>
            {(allDayTasks.get(dateStr) ?? []).map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => onSelectTask(task)}
                className={cn(
                  "mt-1 flex w-full items-center gap-1 truncate rounded border px-1.5 py-0.5 text-left text-[11px] font-medium hover:brightness-95",
                  taskChipClassName(task.concluida)
                )}
                title={`Tarefa: ${taskTimeLabel(task.horario) ? taskTimeLabel(task.horario) + " — " : ""}${task.titulo}`}
              >
                <CheckSquare className="h-3 w-3 shrink-0" aria-hidden />
                <span className="truncate">
                  {taskTimeLabel(task.horario) && `${taskTimeLabel(task.horario)} `}
                  {task.titulo}
                </span>
              </button>
            ))}
          </div>
        ))}

        {/* Coluna de horários */}
        <div className="sticky left-0 z-20 border-r border-border bg-background">
          {HOURS.map((hour) => (
            <div
              key={hour}
              style={{ height: HOUR_HEIGHT_PX }}
              className="flex items-start justify-end border-b border-border pr-1.5 pt-0.5 text-[11px] text-muted-foreground"
            >
              {String(hour).padStart(2, "0")}h
            </div>
          ))}
        </div>

        {/* Colunas dos dias */}
        {days.map((dateStr) => (
          <div key={dateStr} className="relative border-r border-border last:border-r-0" style={{ height: GRID_HEIGHT_PX }}>
            {HOURS.map((hour) => (
              <button
                key={hour}
                type="button"
                style={{ height: HOUR_HEIGHT_PX }}
                onClick={() => onCreate(dateStr, `${String(hour).padStart(2, "0")}:00`)}
                className="block w-full border-b border-border text-left hover:bg-muted/40"
                aria-label={`Nova consulta em ${formatDayShort(dateStr)} às ${hour}h`}
              />
            ))}

            {(timedTasks.get(dateStr) ?? []).map((task) => {
              const time = taskTimeLabel(task.horario)!;
              const top = (timeStrToMinutes(time) - GRID_START_HOUR * 60) * PX_PER_MINUTE;
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onSelectTask(task)}
                  style={{ top, height: 22 }}
                  className={cn(
                    "absolute inset-x-0.5 z-10 flex items-center gap-1 overflow-hidden rounded border px-1.5 text-left text-[11px] shadow-sm hover:brightness-95 sm:text-xs",
                    taskChipClassName(task.concluida)
                  )}
                  title={`Tarefa: ${time} — ${task.titulo}`}
                >
                  <CheckSquare className="h-3 w-3 shrink-0" aria-hidden />
                  <span className="truncate font-medium">
                    {time} {task.titulo}
                  </span>
                </button>
              );
            })}

            {(byDay.get(dateStr) ?? []).map((appointment) => (
              <AppointmentBlock
                key={appointment.id}
                appointment={appointment}
                dateStr={dateStr}
                timeZone={timeZone}
                onSelect={onSelect}
                onReschedule={onReschedule}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

interface AppointmentBlockProps {
  appointment: AppointmentWithPatient;
  dateStr: string;
  timeZone: string;
  onSelect: (appointment: AppointmentWithPatient) => void;
  onReschedule: (appointment: AppointmentWithPatient) => void;
}

/** Bloco posicionado na grade, com arrastar vertical (mesmo dia) para remarcar. */
function AppointmentBlock({ appointment, dateStr, timeZone, onSelect, onReschedule }: AppointmentBlockProps) {
  const meta = APPOINTMENT_STATUS_META[appointment.status];
  const Icon = meta.icon;
  const { hour, minute, timeStr } = utcInstantToZonedDateTime(appointment.data_hora, timeZone);

  const startMinutesFromGrid = (hour - GRID_START_HOUR) * 60 + minute;
  const top = startMinutesFromGrid * PX_PER_MINUTE;
  const height = Math.max(appointment.duracao_min * PX_PER_MINUTE, 22);

  const [dragPx, setDragPx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [, startTransition] = useTransition();

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragging(true);
    setDragPx(0);
    (e.currentTarget as HTMLDivElement).dataset.startY = String(e.clientY);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const startY = Number(e.currentTarget.dataset.startY ?? e.clientY);
    setDragPx(e.clientY - startY);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    setDragging(false);

    if (Math.abs(dragPx) < DRAG_CLICK_THRESHOLD_PX) {
      setDragPx(0);
      onSelect(appointment);
      return;
    }

    const deltaMinutesRaw = dragPx / PX_PER_MINUTE;
    const deltaMinutes = Math.round(deltaMinutesRaw / SNAP_MINUTES) * SNAP_MINUTES;
    const newStartMinutes = Math.min(
      Math.max(startMinutesFromGrid + deltaMinutes, 0),
      (GRID_END_HOUR - GRID_START_HOUR) * 60 - SNAP_MINUTES
    );
    const newHour = GRID_START_HOUR + Math.floor(newStartMinutes / 60);
    const newMinute = newStartMinutes % 60;
    const newTimeStr = `${String(newHour).padStart(2, "0")}:${String(newMinute).padStart(2, "0")}`;

    setDragPx(0);

    if (newTimeStr === timeStr) return;

    startTransition(async () => {
      const result = await rescheduleAppointment(appointment.id, `${dateStr}T${newTimeStr}`);
      if (!result.success) {
        toast.error("Não foi possível remarcar", { description: result.message });
        return;
      }
      toast.success(`Remarcada para ${newTimeStr}.`);
    });
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        top,
        height,
        transform: dragging ? `translateY(${dragPx}px)` : undefined,
      }}
      className={cn(
        "group absolute inset-x-0.5 z-10 overflow-hidden rounded border px-1.5 py-0.5 text-left text-[11px] shadow-sm touch-none sm:text-xs",
        meta.chipClassName,
        dragging && "cursor-grabbing shadow-md",
        !dragging && "cursor-grab"
      )}
      title={`${timeStr} — ${appointment.patients?.nome ?? "Paciente"} (${meta.label}) — arraste para remarcar`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="flex items-center gap-1 truncate font-medium">
          <Icon className="h-3 w-3 shrink-0" />
          <span className={cn(meta.strikethrough && "line-through")}>
            {timeStr} {appointment.patients?.nome ?? "Paciente"}
          </span>
        </span>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onReschedule(appointment);
          }}
          className="shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100"
          aria-label="Remarcar"
          title="Remarcar"
        >
          <Clock className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
