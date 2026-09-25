"use client";

import { CalendarClock, CheckSquare, Plus } from "lucide-react";

import type { AppointmentWithPatient, TaskWithPatient } from "@/lib/types/database.types";
import { APPOINTMENT_STATUS_META, agendaItemSortKey, formatDayShort, taskChipClassName, taskTimeLabel } from "@/lib/agenda";
import { utcInstantToZonedDateTime } from "@/lib/timezone";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface DayDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateStr: string | null;
  appointments: AppointmentWithPatient[];
  tasks: TaskWithPatient[];
  timeZone: string;
  onCreate: (dateStr: string) => void;
  onCreateTask: (dateStr: string) => void;
  onSelect: (appointment: AppointmentWithPatient) => void;
  onSelectTask: (task: TaskWithPatient) => void;
}

export function DayDetailDialog({
  open,
  onOpenChange,
  dateStr,
  appointments,
  tasks,
  timeZone,
  onCreate,
  onCreateTask,
  onSelect,
  onSelectTask,
}: DayDetailDialogProps) {
  if (!dateStr) return null;

  const dayAppointments = appointments
    .filter((a) => utcInstantToZonedDateTime(a.data_hora, timeZone).dateStr === dateStr)
    .sort((a, b) => a.data_hora.localeCompare(b.data_hora));
  const dayTasks = tasks
    .filter((t) => t.data_limite === dateStr)
    .sort((a, b) =>
      agendaItemSortKey({ kind: "tarefa", timeStr: taskTimeLabel(a.horario) }).localeCompare(
        agendaItemSortKey({ kind: "tarefa", timeStr: taskTimeLabel(b.horario) })
      )
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dia {formatDayShort(dateStr)}</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          {dayAppointments.length === 0 && dayTasks.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma consulta ou tarefa neste dia.
            </p>
          )}

          {dayTasks.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => onSelectTask(task)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors hover:brightness-95",
                taskChipClassName(task.concluida)
              )}
            >
              <CheckSquare className="h-4 w-4 shrink-0" aria-hidden />
              <span className="font-medium">{taskTimeLabel(task.horario) ?? "Dia todo"}</span>
              <span className="truncate">{task.titulo}</span>
              {task.patients?.nome && <span className="truncate text-muted-foreground">· {task.patients.nome}</span>}
            </button>
          ))}

          {dayAppointments.map((appointment) => {
            const meta = APPOINTMENT_STATUS_META[appointment.status];
            const Icon = meta.icon;
            const { timeStr } = utcInstantToZonedDateTime(appointment.data_hora, timeZone);
            return (
              <button
                key={appointment.id}
                type="button"
                onClick={() => onSelect(appointment)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors hover:brightness-95",
                  meta.chipClassName
                )}
              >
                <span className="flex items-center gap-2 truncate">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="font-medium">{timeStr}</span>
                  <span className={cn("truncate", meta.strikethrough && "line-through")}>
                    {appointment.patients?.nome ?? "Paciente"}
                  </span>
                </span>
                <Badge variant={meta.badgeVariant} className="shrink-0">
                  {meta.label}
                </Badge>
              </button>
            );
          })}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              onCreate(dateStr);
            }}
          >
            <Plus className="h-4 w-4" />
            Nova consulta
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              onCreateTask(dateStr);
            }}
          >
            <CheckSquare className="h-4 w-4" />
            Nova tarefa
          </Button>
        </div>

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" />
          Horários no seu fuso ({timeZone.replace("_", " ")}).
        </p>
      </DialogContent>
    </Dialog>
  );
}
