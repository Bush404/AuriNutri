"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Ban, CalendarCheck, CalendarClock, CheckSquare, FileText, Mail, MessageSquareText, Pencil, Phone, Tag } from "lucide-react";

import type { AppointmentStatus, AppointmentWithPatient, Sexo, TaskWithPatient } from "@/lib/types/database.types";
import { APPOINTMENT_STATUS_META, APPOINTMENT_TIPO_LABELS, agendaItemSortKey, taskTimeLabel } from "@/lib/agenda";
import { utcInstantToZonedDateTime } from "@/lib/timezone";
import { updateAppointmentStatus } from "@/lib/actions/appointments";
import { calculateAge, cn, getInitials } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Dados do paciente que a Agenda busca junto com a consulta (painel de detalhes). */
export interface AgendaPatientInfo {
  nome: string;
  telefone: string | null;
  email: string | null;
  data_nascimento: string | null;
  sexo: Sexo | null;
}

export interface AgendaAppointment extends AppointmentWithPatient {
  patients: AgendaPatientInfo | null;
}

const SEXO_LABEL: Record<Sexo, string> = { feminino: "Feminino", masculino: "Masculino", outro: "Outro" };

/** Barra lateral colorida de cada linha do dia, pelo status. */
const BAR_BG: Record<AppointmentStatus, string> = {
  agendado: "bg-muted-foreground/40",
  confirmado: "bg-primary",
  realizado: "bg-success",
  faltou: "bg-destructive",
  cancelado: "bg-accent",
};

const WEEKDAY_LONG = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MONTH_LONG = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function formatDayTitle(dateStr: string, todayStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const weekday = WEEKDAY_LONG[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const label = `${weekday}, ${d} de ${MONTH_LONG[m - 1]}`;
  return dateStr === todayStr ? `Hoje · ${label}` : label;
}

interface AgendaSidePanelProps {
  selectedDate: string;
  todayStr: string;
  nowIso: string;
  timeZone: string;
  appointments: AgendaAppointment[];
  tasks: TaskWithPatient[];
  selectedAppointmentId: string | null;
  onSelectAppointment: (appointment: AgendaAppointment) => void;
  onSelectTask: (task: TaskWithPatient) => void;
  onEdit: (appointment: AgendaAppointment) => void;
  onReschedule: (appointment: AgendaAppointment) => void;
}

/**
 * Painel à direita da Agenda (Fase 19, layout de referência "Agenda de consultas"):
 * em cima a lista do dia selecionado, embaixo os detalhes da consulta escolhida.
 */
export function AgendaSidePanel({
  selectedDate,
  todayStr,
  nowIso,
  timeZone,
  appointments,
  tasks,
  selectedAppointmentId,
  onSelectAppointment,
  onSelectTask,
  onEdit,
  onReschedule,
}: AgendaSidePanelProps) {
  const dayItems = [
    ...appointments
      .map((appointment) => ({ appointment, ...utcInstantToZonedDateTime(appointment.data_hora, timeZone) }))
      .filter(({ dateStr }) => dateStr === selectedDate)
      .map(({ appointment, timeStr }) => ({ kind: "consulta" as const, timeStr: timeStr as string | null, appointment })),
    ...tasks
      .filter((task) => task.data_limite === selectedDate)
      .map((task) => ({ kind: "tarefa" as const, timeStr: taskTimeLabel(task.horario), task })),
  ].sort((a, b) => agendaItemSortKey(a).localeCompare(agendaItemSortKey(b)));

  const dayAppointments = dayItems.flatMap((item) => (item.kind === "consulta" ? [item.appointment] : []));
  // Sem escolha explícita: a próxima consulta do dia (ou a primeira não cancelada).
  const selected =
    dayAppointments.find((a) => a.id === selectedAppointmentId) ??
    (selectedAppointmentId ? appointments.find((a) => a.id === selectedAppointmentId) : undefined) ??
    dayAppointments.find((a) => a.data_hora >= nowIso && a.status !== "cancelado") ??
    dayAppointments.find((a) => a.status !== "cancelado") ??
    null;

  return (
    <div className="flex flex-col gap-4">
      {selected && (
        <AppointmentDetails
          key={selected.id}
          appointment={selected}
          timeZone={timeZone}
          onEdit={() => onEdit(selected)}
          onReschedule={() => onReschedule(selected)}
        />
      )}

      <Card className="flex flex-col">
        <div className="flex items-start justify-between gap-2 px-5 pb-2 pt-4">
          <div className="min-w-0">
            <h2 className="truncate text-h3 font-semibold text-foreground">{formatDayTitle(selectedDate, todayStr)}</h2>
            <p className="text-xs text-muted-foreground">
              {dayAppointments.length} {dayAppointments.length === 1 ? "consulta" : "consultas"}
              {dayItems.length > dayAppointments.length &&
                ` · ${dayItems.length - dayAppointments.length} ${dayItems.length - dayAppointments.length === 1 ? "tarefa" : "tarefas"}`}
            </p>
          </div>
        </div>

        {dayItems.length > 0 ? (
          <ul className="divide-y divide-border border-t border-border">
            {dayItems.map((item) => {
              if (item.kind === "tarefa") {
                const { task } = item;
                return (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => onSelectTask(task)}
                      className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-muted/50"
                    >
                      <span className="w-11 shrink-0 text-sm font-semibold tabular-nums text-foreground">{item.timeStr ?? "—"}</span>
                      <span className="h-8 w-0.5 shrink-0 rounded-full border-l border-dashed border-foreground/40" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate text-sm font-medium text-foreground", task.concluida && "line-through")}>
                          {task.titulo}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          Tarefa{task.patients?.nome ? ` · ${task.patients.nome}` : ""}
                        </span>
                      </span>
                      <CheckSquare className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    </button>
                  </li>
                );
              }
              const { appointment } = item;
              const meta = APPOINTMENT_STATUS_META[appointment.status];
              const isSelected = selected?.id === appointment.id;
              return (
                <li key={appointment.id}>
                  <button
                    type="button"
                    onClick={() => onSelectAppointment(appointment)}
                    aria-current={isSelected ? "true" : undefined}
                    className={cn(
                      "flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors",
                      isSelected ? "bg-secondary/70" : "hover:bg-muted/50"
                    )}
                  >
                    <span className="w-11 shrink-0 text-sm font-semibold tabular-nums text-foreground">{item.timeStr}</span>
                    <span className={cn("h-8 w-0.5 shrink-0 rounded-full", BAR_BG[appointment.status])} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-sm font-medium text-foreground", meta.strikethrough && "line-through")}>
                        {appointment.patients?.nome ?? "Paciente"}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">{APPOINTMENT_TIPO_LABELS[appointment.tipo]}</span>
                    </span>
                    <Badge variant={meta.badgeVariant} className="shrink-0">
                      {meta.label}
                    </Badge>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="border-t border-border px-5 py-6 text-center text-sm text-muted-foreground">Nada marcado neste dia.</p>
        )}

      </Card>
    </div>
  );
}

function AppointmentDetails({
  appointment,
  timeZone,
  onEdit,
  onReschedule,
}: {
  appointment: AgendaAppointment;
  timeZone: string;
  onEdit: () => void;
  onReschedule: () => void;
}) {
  const meta = APPOINTMENT_STATUS_META[appointment.status];
  const [isPending, startTransition] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);
  // Confirmar só faz sentido para quem está "agendado"; cancelar, enquanto a consulta
  // ainda vai acontecer. Mesma ação da janela de edição (não mexe no financeiro).
  const podeConfirmar = appointment.status === "agendado";
  const podeCancelar = appointment.status === "agendado" || appointment.status === "confirmado";

  function mudarStatus(status: "confirmado" | "cancelado") {
    startTransition(async () => {
      const result = await updateAppointmentStatus(appointment.id, status);
      if (!result.success) {
        toast.error(status === "confirmado" ? "Não foi possível confirmar" : "Não foi possível cancelar", {
          description: result.message,
        });
        return;
      }
      toast.success(status === "confirmado" ? "Consulta confirmada." : "Consulta cancelada.");
      setCancelOpen(false);
    });
  }
  const inicio = utcInstantToZonedDateTime(appointment.data_hora, timeZone);
  const fim = utcInstantToZonedDateTime(appointment.data_fim, timeZone);
  const paciente = appointment.patients;
  const nome = paciente?.nome ?? "Paciente";
  const idade = calculateAge(paciente?.data_nascimento);
  const perfil = [idade !== null ? `${idade} ${idade === 1 ? "ano" : "anos"}` : null, paciente?.sexo ? SEXO_LABEL[paciente.sexo] : null]
    .filter(Boolean)
    .join(" • ");

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <span className="text-base font-semibold tabular-nums text-foreground">
          {inicio.timeStr} – {fim.timeStr}
        </span>
        <Badge variant={meta.badgeVariant}>{meta.label}</Badge>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Avatar className="h-12 w-12">
          <AvatarFallback className="text-sm">{getInitials(nome)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-foreground">{nome}</p>
          {perfil && <p className="text-sm text-muted-foreground">{perfil}</p>}
        </div>
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        {paciente?.telefone && (
          <div className="flex items-center gap-2.5 text-muted-foreground">
            <dt><Phone className="h-4 w-4" aria-label="Telefone" /></dt>
            <dd className="tabular-nums text-foreground">{paciente.telefone}</dd>
          </div>
        )}
        {paciente?.email && (
          <div className="flex items-center gap-2.5 text-muted-foreground">
            <dt><Mail className="h-4 w-4" aria-label="E-mail" /></dt>
            <dd className="truncate text-foreground">{paciente.email}</dd>
          </div>
        )}
        <div className="flex items-center gap-2.5 text-muted-foreground">
          <dt><Tag className="h-4 w-4" aria-label="Tipo" /></dt>
          <dd>
            <Badge variant="secondary">{APPOINTMENT_TIPO_LABELS[appointment.tipo]}</Badge>
          </dd>
        </div>
      </dl>

      {appointment.observacoes && (
        <div className="mt-4 rounded-md border border-border bg-muted/40 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <MessageSquareText className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            Observações
          </p>
          <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{appointment.observacoes}</p>
        </div>
      )}

      {(podeConfirmar || podeCancelar) && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {podeConfirmar && (
            <Button size="sm" variant="secondary" disabled={isPending} onClick={() => mudarStatus("confirmado")}>
              <CalendarCheck className="h-4 w-4" />
              Confirmar
            </Button>
          )}
          {podeCancelar && (
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => setCancelOpen(true)}
              className={cn("text-destructive hover:text-destructive", !podeConfirmar && "col-span-2")}
            >
              <Ban className="h-4 w-4" />
              Cancelar consulta
            </Button>
          )}
        </div>
      )}

      <div className="mt-2 grid grid-cols-3 gap-2">
        <Button size="sm" asChild>
          <Link href={`/pacientes/${appointment.patient_id}`}>
            <FileText className="h-4 w-4" />
            Ficha
          </Link>
        </Button>
        <Button size="sm" variant="outline" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
          Editar
        </Button>
        <Button size="sm" variant="outline" onClick={onReschedule}>
          <CalendarClock className="h-4 w-4" />
          Remarcar
        </Button>
      </div>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar esta consulta?</AlertDialogTitle>
            <AlertDialogDescription>
              {nome}, {inicio.timeStr}. A consulta continua na agenda marcada como cancelada e o horário fica livre.
              Pagamentos já registrados não são alterados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Voltar</AlertDialogCancel>
            <Button variant="destructive" disabled={isPending} onClick={() => mudarStatus("cancelado")}>
              Cancelar consulta
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

