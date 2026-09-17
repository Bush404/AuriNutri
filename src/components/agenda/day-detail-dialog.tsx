"use client";

import { CalendarClock, Plus } from "lucide-react";

import type { AppointmentWithPatient } from "@/lib/types/database.types";
import { APPOINTMENT_STATUS_META, formatDayShort } from "@/lib/agenda";
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
  timeZone: string;
  onCreate: (dateStr: string) => void;
  onSelect: (appointment: AppointmentWithPatient) => void;
}

export function DayDetailDialog({
  open,
  onOpenChange,
  dateStr,
  appointments,
  timeZone,
  onCreate,
  onSelect,
}: DayDetailDialogProps) {
  if (!dateStr) return null;

  const dayAppointments = appointments
    .filter((a) => utcInstantToZonedDateTime(a.data_hora, timeZone).dateStr === dateStr)
    .sort((a, b) => a.data_hora.localeCompare(b.data_hora));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dia {formatDayShort(dateStr)}</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          {dayAppointments.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma consulta neste dia.
            </p>
          )}

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

        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            onOpenChange(false);
            onCreate(dateStr);
          }}
        >
          <Plus className="h-4 w-4" />
          Nova consulta neste dia
        </Button>

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" />
          Horários no seu fuso ({timeZone.replace("_", " ")}).
        </p>
      </DialogContent>
    </Dialog>
  );
}
