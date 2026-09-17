"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { AppointmentWithPatient } from "@/lib/types/database.types";
import { rescheduleAppointment } from "@/lib/actions/appointments";
import { utcInstantToZonedDateTime } from "@/lib/timezone";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface RescheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: AppointmentWithPatient | null;
  timeZone: string;
}

/** Caminho rápido pra só mudar data/hora — a edição completa fica no diálogo de editar. */
export function RescheduleDialog({ open, onOpenChange, appointment, timeZone }: RescheduleDialogProps) {
  const [dataHoraLocal, setDataHoraLocal] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !appointment) return;
    const { dateStr, timeStr } = utcInstantToZonedDateTime(appointment.data_hora, timeZone);
    setDataHoraLocal(`${dateStr}T${timeStr}`);
  }, [open, appointment, timeZone]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!appointment) return;

    startTransition(async () => {
      const result = await rescheduleAppointment(appointment.id, dataHoraLocal);
      if (!result.success) {
        toast.error("Não foi possível remarcar", { description: result.message });
        return;
      }
      toast.success(result.message ?? "Consulta remarcada.");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Remarcar consulta</DialogTitle>
          <DialogDescription>
            {appointment?.patients?.nome ?? "Paciente"} — só a data/horário muda, o resto da consulta continua igual.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reschedule_data_hora">Nova data e horário</Label>
            <Input
              id="reschedule_data_hora"
              type="datetime-local"
              value={dataHoraLocal}
              onChange={(e) => setDataHoraLocal(e.target.value)}
              required
              disabled={isPending}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Remarcar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
