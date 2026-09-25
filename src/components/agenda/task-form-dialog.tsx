"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { CheckSquare, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { TaskWithPatient } from "@/lib/types/database.types";
import type { PatientPickerResult } from "@/lib/actions/patients";
import { createTask, deleteTask, toggleTaskConcluida, updateTask } from "@/lib/actions/tasks";
import { taskTimeLabel } from "@/lib/agenda";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PatientCombobox } from "@/components/shared/patient-combobox";

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timeZone: string;
  /** Presente = editar esta tarefa. Ausente = criar uma nova. */
  task?: TaskWithPatient;
  defaultDateStr?: string;
  defaultTimeStr?: string;
  defaultPatient?: PatientPickerResult | null;
}

interface FormState {
  titulo: string;
  data: string;
  horario: string;
  descricao: string;
}

export function TaskFormDialog({
  open,
  onOpenChange,
  timeZone,
  task,
  defaultDateStr,
  defaultTimeStr,
  defaultPatient,
}: TaskFormDialogProps) {
  const isEditing = Boolean(task);
  const pacienteLabelId = useId();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>({ titulo: "", data: "", horario: "", descricao: "" });
  const [patient, setPatient] = useState<PatientPickerResult | null>(null);
  const [errors, setErrors] = useState<{ titulo?: string; data?: string }>({});
  // Excluir pede um segundo clique (já estamos dentro de um diálogo).
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Reinicia o formulário a cada abertura (nova tarefa ou outra tarefa).
  useEffect(() => {
    if (!open) return;
    setForm({
      titulo: task?.titulo ?? "",
      data: task?.data_limite ?? defaultDateStr ?? "",
      horario: taskTimeLabel(task?.horario) ?? defaultTimeStr ?? "",
      descricao: task?.descricao ?? "",
    });
    setPatient(
      task ? (task.patient_id ? { id: task.patient_id, nome: task.patients?.nome ?? "Paciente" } : null) : defaultPatient ?? null
    );
    setErrors({});
    setConfirmingDelete(false);
  }, [open, task, defaultDateStr, defaultTimeStr, defaultPatient]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: typeof errors = {};
    if (form.titulo.trim().length < 2) nextErrors.titulo = "Informe o título da tarefa";
    if (!form.data) nextErrors.data = "Informe a data";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const input = {
      titulo: form.titulo.trim(),
      data_limite: form.data,
      horario: form.horario,
      descricao: form.descricao,
      patient_id: patient?.id ?? "",
      appointment_id: task?.appointment_id ?? "",
      concluida: task?.concluida ?? false,
    };

    startTransition(async () => {
      const result = task ? await updateTask(task.id, input) : await createTask(input);
      if (!result.success) {
        toast.error("Não foi possível salvar a tarefa", { description: result.message });
        return;
      }
      toast.success(result.message ?? "Tarefa salva.");
      onOpenChange(false);
    });
  }

  function handleToggle() {
    if (!task) return;
    startTransition(async () => {
      const result = await toggleTaskConcluida(task.id, !task.concluida);
      if (!result.success) {
        toast.error("Não foi possível alterar a tarefa", { description: result.message });
        return;
      }
      toast.success(task.concluida ? "Tarefa reaberta." : "Tarefa concluída.");
      onOpenChange(false);
    });
  }

  function handleDelete() {
    if (!task) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    startTransition(async () => {
      const result = await deleteTask(task.id);
      if (!result.success) {
        toast.error("Não foi possível excluir a tarefa", { description: result.message });
        return;
      }
      toast.success("Tarefa excluída.");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? "Editar tarefa" : "Nova tarefa"}
            {task?.concluida && <Badge variant="secondary">Concluída</Badge>}
          </DialogTitle>
          <DialogDescription>Horário no seu fuso ({timeZone.replace("_", " ")}). O horário é opcional.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tarefa_titulo">Título *</Label>
            <Input
              id="tarefa_titulo"
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              placeholder="Ex.: Enviar plano para a Maria"
              disabled={isPending}
              aria-required
              aria-invalid={Boolean(errors.titulo)}
            />
            {errors.titulo && <p className="text-xs text-destructive" role="alert">{errors.titulo}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="tarefa_data">Data *</Label>
              <Input
                id="tarefa_data"
                type="date"
                value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })}
                disabled={isPending}
                aria-required
                aria-invalid={Boolean(errors.data)}
              />
              {errors.data && <p className="text-xs text-destructive" role="alert">{errors.data}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="tarefa_horario">Horário</Label>
              <Input
                id="tarefa_horario"
                type="time"
                step={900}
                value={form.horario}
                onChange={(e) => setForm({ ...form, horario: e.target.value })}
                disabled={isPending}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label id={pacienteLabelId}>Paciente (opcional)</Label>
            <PatientCombobox value={patient} onChange={setPatient} disabled={isPending} ariaLabelledBy={pacienteLabelId} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tarefa_descricao">Observação</Label>
            <Textarea
              id="tarefa_descricao"
              rows={3}
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              disabled={isPending}
            />
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {task ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleToggle} disabled={isPending}>
                  {task.concluida ? <RotateCcw className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
                  {task.concluida ? "Reabrir" : "Concluir"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={handleDelete}
                  disabled={isPending}
                >
                  <Trash2 className="h-4 w-4" />
                  {confirmingDelete ? "Confirmar exclusão" : "Excluir"}
                </Button>
              </div>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? "Salvar alterações" : "Criar tarefa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
