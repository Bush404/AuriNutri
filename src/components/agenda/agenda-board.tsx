"use client";

import { useState } from "react";
import { CheckSquare, Package, Plus } from "lucide-react";

import type { TaskWithPatient } from "@/lib/types/database.types";
import { utcInstantToZonedDateTime } from "@/lib/timezone";
import type { PatientPickerResult } from "@/lib/actions/patients";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { MonthView } from "@/components/agenda/month-view";
import { WeekView } from "@/components/agenda/week-view";
import { AppointmentFormDialog } from "@/components/agenda/appointment-form-dialog";
import { PackageFormDialog } from "@/components/agenda/package-form-dialog";
import { RescheduleDialog } from "@/components/agenda/reschedule-dialog";
import { TaskFormDialog } from "@/components/agenda/task-form-dialog";
import { AgendaSidePanel, type AgendaAppointment } from "@/components/agenda/agenda-side-panel";
import { AddChoiceDialog } from "@/components/agenda/add-choice-dialog";

interface AgendaBoardProps {
  view: "mes" | "semana";
  weeks: string[][];
  days: string[];
  monthAnchor: string;
  todayStr: string;
  nowIso: string;
  timeZone: string;
  /** Dia que o painel lateral mostra ao abrir (hoje, se estiver no período). */
  initialSelectedDate: string;
  appointments: AgendaAppointment[];
  tasks: TaskWithPatient[];
  patientFilter: PatientPickerResult | null;
  /** Números do topo (renderizados no servidor). */
  stats: React.ReactNode;
  /** Navegação, Mês/Semana e filtros (renderizados no servidor). */
  toolbar: React.ReactNode;
  footnote?: React.ReactNode;
}

type FormDialogState =
  | { open: false }
  | { open: true; appointment?: AgendaAppointment; defaultDateStr?: string; defaultTimeStr?: string };

type TaskDialogState =
  | { open: false }
  | { open: true; task?: TaskWithPatient; defaultDateStr?: string; defaultTimeStr?: string };

/**
 * Tela da Agenda (Fase 19): números no topo, calendário à esquerda e, à direita, o
 * dia selecionado + os detalhes da consulta. As janelas de consulta, pacote, tarefa e
 * remarcação são as mesmas de antes.
 */
export function AgendaBoard({
  view,
  weeks,
  days,
  monthAnchor,
  todayStr,
  nowIso,
  timeZone,
  initialSelectedDate,
  appointments,
  tasks,
  patientFilter,
  stats,
  toolbar,
  footnote,
}: AgendaBoardProps) {
  const [formDialog, setFormDialog] = useState<FormDialogState>({ open: false });
  const [packageDialog, setPackageDialog] = useState<{ open: boolean; dateStr: string }>({ open: false, dateStr: todayStr });
  const [addChoice, setAddChoice] = useState<{ dateStr: string; timeStr?: string } | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<AgendaAppointment | null>(null);
  const [taskDialog, setTaskDialog] = useState<TaskDialogState>({ open: false });
  const [selectedDate, setSelectedDate] = useState(initialSelectedDate);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);

  function openCreateTask(dateStr: string, timeStr?: string) {
    setTaskDialog({ open: true, defaultDateStr: dateStr, defaultTimeStr: timeStr });
  }

  function openEditTask(task: TaskWithPatient) {
    setTaskDialog({ open: true, task });
  }

  function openCreate(dateStr: string, timeStr?: string) {
    setFormDialog({ open: true, defaultDateStr: dateStr, defaultTimeStr: timeStr });
  }

  function openEdit(appointment: AgendaAppointment) {
    setFormDialog({ open: true, appointment });
  }

  function selectDay(dateStr: string) {
    setSelectedDate(dateStr);
    setSelectedAppointmentId(null);
  }

  /** Espaço vazio do calendário: seleciona o dia e pergunta o que adicionar. */
  function askWhatToAdd(dateStr: string, timeStr?: string) {
    selectDay(dateStr);
    setAddChoice({ dateStr, timeStr });
  }

  // Os calendários tipam a consulta como AppointmentWithPatient; aqui ela é sempre
  // uma AgendaAppointment (a página busca os dados do paciente junto).
  function selectAppointment(appointment: { id: string }) {
    const found = appointments.find((a) => a.id === appointment.id);
    if (!found) return;
    setSelectedDate(utcInstantToZonedDateTime(found.data_hora, timeZone).dateStr);
    setSelectedAppointmentId(found.id);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Agenda"
        description="Gerencie seus atendimentos e compromissos."
        actions={
          <>
            <Button variant="outline" onClick={() => setPackageDialog({ open: true, dateStr: selectedDate })}>
              <Package className="h-4 w-4" />
              Novo pacote
            </Button>
            <Button variant="outline" onClick={() => openCreateTask(selectedDate)}>
              <CheckSquare className="h-4 w-4" />
              Nova tarefa
            </Button>
            <Button onClick={() => openCreate(selectedDate)}>
              <Plus className="h-4 w-4" />
              Nova consulta
            </Button>
          </>
        }
      />

      {stats}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="min-w-0">
          <CardContent className="space-y-4 p-4 sm:p-5">
            {toolbar}

            {view === "mes" ? (
              <MonthView
                weeks={weeks}
                monthAnchor={monthAnchor}
                todayStr={todayStr}
                appointments={appointments}
                tasks={tasks}
                timeZone={timeZone}
                selectedDate={selectedDate}
                selectedAppointmentId={selectedAppointmentId}
                onSelectDay={selectDay}
                onEmptyClick={(dateStr) => askWhatToAdd(dateStr)}
                onSelect={selectAppointment}
                onSelectTask={openEditTask}
              />
            ) : (
              <WeekView
                days={days}
                todayStr={todayStr}
                appointments={appointments}
                tasks={tasks}
                timeZone={timeZone}
                onCreate={(dateStr, timeStr) => askWhatToAdd(dateStr, timeStr)}
                onSelect={selectAppointment}
                onSelectTask={openEditTask}
                onReschedule={(appointment) => {
                  const found = appointments.find((a) => a.id === appointment.id);
                  if (found) setRescheduleTarget(found);
                }}
              />
            )}

            {footnote}
          </CardContent>
        </Card>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <AgendaSidePanel
            selectedDate={selectedDate}
            todayStr={todayStr}
            nowIso={nowIso}
            timeZone={timeZone}
            appointments={appointments}
            tasks={tasks}
            selectedAppointmentId={selectedAppointmentId}
            onSelectAppointment={(a) => setSelectedAppointmentId(a.id)}
            onSelectTask={openEditTask}
            onEdit={openEdit}
            onReschedule={setRescheduleTarget}
          />
        </div>
      </div>

      <AppointmentFormDialog
        open={formDialog.open}
        onOpenChange={(open) => setFormDialog(open ? formDialog : { open: false })}
        timeZone={timeZone}
        appointment={formDialog.open ? formDialog.appointment : undefined}
        defaultDateStr={formDialog.open ? formDialog.defaultDateStr : undefined}
        defaultTimeStr={formDialog.open ? formDialog.defaultTimeStr : undefined}
        defaultPatient={patientFilter}
      />

      <AddChoiceDialog
        open={addChoice !== null}
        onOpenChange={(open) => !open && setAddChoice(null)}
        dateStr={addChoice?.dateStr ?? null}
        timeStr={addChoice?.timeStr}
        onConsulta={() => addChoice && openCreate(addChoice.dateStr, addChoice.timeStr)}
        onPacote={() => addChoice && setPackageDialog({ open: true, dateStr: addChoice.dateStr })}
        onTarefa={() => addChoice && openCreateTask(addChoice.dateStr, addChoice.timeStr)}
      />

      <PackageFormDialog
        // Remonta a cada abertura para pegar a data escolhida.
        key={packageDialog.open ? packageDialog.dateStr : "fechado"}
        open={packageDialog.open}
        onOpenChange={(open) => setPackageDialog((s) => ({ ...s, open }))}
        timeZone={timeZone}
        defaultDateStr={packageDialog.dateStr}
        defaultPatient={patientFilter}
      />

      <RescheduleDialog
        open={rescheduleTarget !== null}
        onOpenChange={(open) => !open && setRescheduleTarget(null)}
        appointment={rescheduleTarget}
        timeZone={timeZone}
      />

      <TaskFormDialog
        open={taskDialog.open}
        onOpenChange={(open) => setTaskDialog(open ? taskDialog : { open: false })}
        timeZone={timeZone}
        task={taskDialog.open ? taskDialog.task : undefined}
        defaultDateStr={taskDialog.open ? taskDialog.defaultDateStr : undefined}
        defaultTimeStr={taskDialog.open ? taskDialog.defaultTimeStr : undefined}
        defaultPatient={patientFilter}
      />
    </div>
  );
}
