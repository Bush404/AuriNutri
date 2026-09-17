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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CONFIRM_WORD = "excluir";

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
  const [confirmText, setConfirmText] = useState("");
  const isConfirmed = confirmText.trim().toLowerCase() === CONFIRM_WORD;

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

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) setConfirmText("");
    onOpenChange(nextOpen);
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir paciente</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir <strong>{patientName}</strong>? Essa ação também
            remove permanentemente anamnese, avaliações e planos alimentares associados. Não há
            como desfazer nem recuperar pela aplicação depois disso.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="confirm-delete">
            Digite <strong>{CONFIRM_WORD}</strong> para confirmar
          </Label>
          <Input
            id="confirm-delete"
            autoComplete="off"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_WORD}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isPending || !isConfirmed}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Excluir definitivamente
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
