"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { deletePatient } from "@/lib/actions/patients";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeletePatientDialogProps {
  patientId: string;
  patientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeletePatientDialog({
  patientId,
  patientName,
  open,
  onOpenChange,
}: DeletePatientDialogProps) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deletePatient(patientId);
      if (!result.success) {
        toast.error("Não foi possível excluir", { description: result.message });
        return;
      }
      toast.success("Paciente excluído com sucesso.");
      onOpenChange(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir paciente</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir <strong>{patientName}</strong>? Essa ação também
            removerá anamnese, avaliações e planos alimentares associados, e não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
