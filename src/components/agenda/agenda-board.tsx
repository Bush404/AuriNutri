"use client";

import { useState } from "react";
import { CheckSquare, Plus } from "lucide-react";

import type { AppointmentWithPatient, TaskWithPatient } from "@/lib/types/database.types";
import type { PatientPickerResult } from "@/lib/actions/patients";

import { Button } from "@/components/ui/button";
import { MonthView } from "@/components/agenda/month-view";
import { WeekView } from "@/components/agenda/week-view";
import { AppointmentFormDialog } from "@/components/agenda/appointment-form-dialog";
import { PackageFormDialog } from "@/components/agenda/package-form-dialog";
import { RescheduleDialog } from "@/components/agenda/reschedule-dialog";
import { DayDetailDialog } from "@/components/agenda/day-detail-dialog";
import { TaskFormDialog } from "@/components/agenda/task-form-dialog";

interface AgendaBoardProps {
  view: "mes" | "semana";
  weeks: string[][];
  days: string[];
  monthAnchor: string;
  todayStr: string;
  timeZone: string;
  appointments: AppointmentWithPatient[];
  tasks: TaskWithPatient[];
  patientFilter: PatientPickerResult | null;
}

type FormDialogState =
  | { open: false }
  | { open: true; appointment?: AppointmentWithPatient; defaultDateStr?: string; defaultTimeStr?: string };

type TaskDialogState =
  | { open: false }
  | { open: true; task?: TaskWithPatient; defaultDateStr?: string; defaultTimeStr?: string };

export function AgendaBoard({
  view,
  weeks,
  days,
  monthAnchor,
  todayStr,
  timeZone,
  appointments,
  tasks,
  patientFilter,
}: AgendaBoardProps) {
  const [formDialog, setFormDialog] = useState<FormDialogState>({ open: false });
  const [packageDialogOpen, setPackageDialogOpen] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentWithPatient | null>(null);
  const [dayDetailDate, setDayDetailDate] = useState<string | null>(null);
  const [taskDialog, setTaskDialog] = useState<TaskDialogState>({ open: false });

  function openCreateTask(dateStr: string, timeStr?: string) {
    setTaskDialog({ open: true, defaultDateStr: dateStr, defaultTimeStr: timeStr });
  }

  function openEditTask(task: TaskWithPatient) {
    setTaskDialog({ open: true, task });
  }

  function openCreate(dateStr: string, timeStr?: string) {
    setFormDialog({ open: true, defaultDateStr: dateStr, defaultTimeStr: timeStr });
  }

  function openEdit(appointment: AppointmentWithPatient) {
    setFormDialog({ open: true, appointment });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" onClick={() => openCreate(todayStr)}>
          <Plus className="h-4 w-4" />
          Nova consulta
        </Button>
        <Button size="sm" onClick={() => setPackageDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Novo pacote
        </Button>
        <Button size="sm" variant="outline" onClick={() => openCreateTask(todayStr)}>
          <CheckSquare className="h-4 w-4" />
          Nova tarefa
        </Button>
      </div>

      {view === "mes" ? (
        <MonthView
          weeks={weeks}
          monthAnchor={monthAnchor}
          todayStr={todayStr}
          appointments={appointments}
          tasks={tasks}
          timeZone={timeZone}
          onCreate={openCreate}
          onSelect={openEdit}
          onSelectTask={openEditTask}
          onShowDay={setDayDetailDate}
        />
      ) : (
        <WeekView
          days={days}
          todayStr={todayStr}
          appointments={appointments}
          tasks={tasks}
          timeZone={timeZone}
          onCreate={openCreate}
          onSelect={openEdit}
          onSelectTask={openEditTask}
          onReschedule={setRescheduleTarget}
        />
      )}

      <AppointmentFormDialog
        open={formDialog.open}
        onOpenChange={(open) => setFormDialog(open ? formDialog : { open: false })}
        timeZone={timeZone}
        appointment={formDialog.open ? formDialog.appointment : undefined}
        defaultDateStr={formDialog.open ? formDialog.defaultDateStr : undefined}
        defaultTimeStr={formDialog.open ? formDialog.defaultTimeStr : undefined}
        defaultPatient={patientFilter}
      />

      <PackageFormDialog
        open={packageDialogOpen}
        onOpenChange={setPackageDialogOpen}
        timeZone={timeZone}
        defaultDateStr={todayStr}
        defaultPatient={patientFilter}
      />

      <RescheduleDialog
        open={rescheduleTarget !== null}
        onOpenChange={(open) => !open && setRescheduleTarget(null)}
        appointment={rescheduleTarget}
        timeZone={timeZone}
      />

      <DayDetailDialog
        open={dayDetailDate !== null}
        onOpenChange={(open) => !open && setDayDetailDate(null)}
        dateStr={dayDetailDate}
        appointments={appointments}
        tasks={tasks}
        timeZone={timeZone}
        onCreate={(dateStr) => openCreate(dateStr)}
        onCreateTask={(dateStr) => openCreateTask(dateStr)}
        onSelect={(appointment) => {
          setDayDetailDate(null);
          openEdit(appointment);
        }}
        onSelectTask={(task) => {
          setDayDetailDate(null);
          openEditTask(task);
        }}
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
