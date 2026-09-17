"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, Loader2, MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { AppointmentWithPatient, AppointmentStatus, AppointmentTipo } from "@/lib/types/database.types";
import type { PatientPickerResult } from "@/lib/actions/patients";
import { createAppointment, deleteAppointment, updateAppointment, updateAppointmentStatus } from "@/lib/actions/appointments";
import { getPatientAgendaContext } from "@/lib/actions/patient-context";
import type { PatientAgendaContext } from "@/lib/patient-context";
import { APPOINTMENT_STATUSES, APPOINTMENT_STATUS_META, APPOINTMENT_TIPOS, APPOINTMENT_TIPO_LABELS } from "@/lib/agenda";
import { utcInstantToZonedDateTime } from "@/lib/timezone";
import { formatDate } from "@/lib/utils";
import { buildAppointmentReminderMessage, buildWhatsAppUrl } from "@/lib/whatsapp";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PatientCombobox } from "@/components/shared/patient-combobox";
import { PatientContextPanel } from "@/components/agenda/patient-context-panel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface FormState {
  dataHoraLocal: string;
  duracaoMin: string;
  tipo: AppointmentTipo | "";
  status: AppointmentStatus;
  observacoes: string;
}

function buildInitialState(
  timeZone: string,
  appointment: AppointmentWithPatient | undefined,
  defaultDateStr: string | undefined,
  defaultTimeStr: string | undefined
): FormState {
  if (appointment) {
    const { dateStr, timeStr } = utcInstantToZonedDateTime(appointment.data_hora, timeZone);
    return {
      dataHoraLocal: `${dateStr}T${timeStr}`,
      duracaoMin: String(appointment.duracao_min),
      tipo: appointment.tipo,
      status: appointment.status,
      observacoes: appointment.observacoes ?? "",
    };
  }
  return {
    dataHoraLocal: `${defaultDateStr ?? new Date().toISOString().slice(0, 10)}T${defaultTimeStr ?? "08:00"}`,
    duracaoMin: "60",
    tipo: "",
    status: "agendado",
    observacoes: "",
  };
}

interface AppointmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timeZone: string;
  appointment?: AppointmentWithPatient;
  defaultDateStr?: string;
  defaultTimeStr?: string;
  defaultPatient?: PatientPickerResult | null;
}

/** Diálogo único de criar/editar consulta — reaproveitado em modo edição, mesmo padrão de NewAssessmentDialog. */
export function AppointmentFormDialog({
  open,
  onOpenChange,
  timeZone,
  appointment,
  defaultDateStr,
  defaultTimeStr,
  defaultPatient,
}: AppointmentFormDialogProps) {
  const isEditing = Boolean(appointment);
  const [selectedPatient, setSelectedPatient] = useState<PatientPickerResult | null>(
    appointment ? { id: appointment.patient_id, nome: appointment.patients?.nome ?? "Paciente" } : defaultPatient ?? null
  );
  const [form, setForm] = useState<FormState>(() =>
    buildInitialState(timeZone, appointment, defaultDateStr, defaultTimeStr)
  );
  const [patientError, setPatientError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [context, setContext] = useState<PatientAgendaContext | null>(null);
  const [contextLoading, setContextLoading] = useState(false);

  // O diálogo não desmonta entre aberturas — reseta os valores toda vez que abre.
  useEffect(() => {
    if (!open) return;
    setForm(buildInitialState(timeZone, appointment, defaultDateStr, defaultTimeStr));
    setSelectedPatient(
      appointment ? { id: appointment.patient_id, nome: appointment.patients?.nome ?? "Paciente" } : defaultPatient ?? null
    );
    setPatientError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Contexto clínico segue a seleção de paciente — carrega de novo sempre que ela muda.
  useEffect(() => {
    if (!open || !selectedPatient) {
      setContext(null);
      return;
    }
    let cancelled = false;
    setContextLoading(true);
    getPatientAgendaContext(selectedPatient.id, timeZone, { excludeAppointmentId: appointment?.id }).then((data) => {
      if (cancelled) return;
      setContext(data);
      setContextLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedPatient?.id, timeZone]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const tipo = form.tipo;
    if (!selectedPatient) {
      setPatientError("Selecione um paciente.");
      return;
    }
    if (!tipo) {
      toast.error("Selecione o tipo de consulta.");
      return;
    }

    const payload = {
      patient_id: selectedPatient.id,
      data_hora_local: form.dataHoraLocal,
      duracao_min: Number(form.duracaoMin),
      tipo,
      status: isEditing ? form.status : undefined,
      observacoes: form.observacoes,
    };

    startTransition(async () => {
      const result = isEditing
        ? await updateAppointment(appointment!.id, payload)
        : await createAppointment(payload);

      if (!result.success) {
        toast.error(`Não foi possível ${isEditing ? "atualizar" : "agendar"} a consulta`, {
          description: result.message,
        });
        return;
      }

      toast.success(result.message ?? "Consulta salva.");
      onOpenChange(false);
    });
  }

  function handleDelete() {
    if (!appointment) return;
    startTransition(async () => {
      const result = await deleteAppointment(appointment.id);
      if (!result.success) {
        toast.error("Não foi possível excluir a consulta", { description: result.message });
        return;
      }
      toast.success("Consulta excluída.");
      onOpenChange(false);
    });
  }

  function handleMarkRealizado() {
    if (!appointment) return;
    startTransition(async () => {
      const result = await updateAppointmentStatus(appointment.id, "realizado");
      if (!result.success) {
        toast.error("Não foi possível marcar como realizado", { description: result.message });
        return;
      }
      toast.success("Consulta marcada como realizada.");
      onOpenChange(false);
    });
  }

  function buildWhatsAppHref() {
    if (!appointment) return "#";
    const nome = selectedPatient?.nome ?? appointment.patients?.nome ?? "";
    const telefone = context?.patientTelefone ?? null;
    const { dateStr, timeStr } = utcInstantToZonedDateTime(appointment.data_hora, timeZone);
    const mensagem = buildAppointmentReminderMessage(nome, formatDate(dateStr), timeStr);
    return buildWhatsAppUrl(telefone, mensagem);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar consulta" : "Nova consulta"}</DialogTitle>
          <DialogDescription>
            Horário exibido no seu fuso ({timeZone.replace("_", " ")}).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Paciente *</Label>
            <PatientCombobox
              value={selectedPatient}
              onChange={(patient) => {
                setSelectedPatient(patient);
                setPatientError(null);
              }}
              disabled={isPending}
            />
            {patientError && <p className="text-xs text-destructive">{patientError}</p>}
          </div>

          {selectedPatient && (
            <PatientContextPanel patientId={selectedPatient.id} context={context} loading={contextLoading} />
          )}

          {isEditing && appointment && (
            <div className="flex flex-wrap gap-2">
              {appointment.status !== "realizado" && (
                <Button type="button" variant="outline" size="sm" onClick={handleMarkRealizado} disabled={isPending}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Marcar como realizado
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" asChild>
                <a href={buildWhatsAppHref()} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-3.5 w-3.5" />
                  Lembrete WhatsApp
                </a>
              </Button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="data_hora_local">Data e horário *</Label>
              <Input
                id="data_hora_local"
                type="datetime-local"
                value={form.dataHoraLocal}
                onChange={(e) => setForm((f) => ({ ...f, dataHoraLocal: e.target.value }))}
                required
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duracao_min">Duração (min) *</Label>
              <Input
                id="duracao_min"
                type="number"
                min={5}
                step={5}
                value={form.duracaoMin}
                onChange={(e) => setForm((f) => ({ ...f, duracaoMin: e.target.value }))}
                required
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo *</Label>
              <Select
                value={form.tipo}
                onValueChange={(v) => setForm((f) => ({ ...f, tipo: v as AppointmentTipo }))}
                disabled={isPending}
              >
                <SelectTrigger id="tipo">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {APPOINTMENT_TIPOS.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>
                      {APPOINTMENT_TIPO_LABELS[tipo]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isEditing && (
              <div className="space-y-2 col-span-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v as AppointmentStatus }))}
                  disabled={isPending}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {APPOINTMENT_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {APPOINTMENT_STATUS_META[status].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2 col-span-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                rows={2}
                value={form.observacoes}
                onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                disabled={isPending}
              />
            </div>
          </div>

          <DialogFooter className="sm:justify-between">
            {isEditing ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={handleDelete}
                disabled={isPending}
              >
                <Trash2 className="h-4 w-4" />
                Excluir
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? "Salvar alterações" : "Agendar consulta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
