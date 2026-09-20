"use client";

import { useState } from "react";
import { Send } from "lucide-react";

import type { SendCenterContext } from "@/lib/actions/patient-send";
import { PatientSendPanel } from "@/components/patients/patient-send-panel";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface PatientSendDialogProps {
  patientId: string;
  patientNome: string;
  patientTelefone: string | null;
  context: SendCenterContext;
}

/** Botão "Enviar" ao lado de Exportar dados/Editar dados — abre a Central de Envio num diálogo, em vez de ser uma aba própria. */
export function PatientSendDialog({ patientId, patientNome, patientTelefone, context }: PatientSendDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Send className="h-4 w-4" />
          Enviar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar para {patientNome}</DialogTitle>
        </DialogHeader>

        <PatientSendPanel
          patientId={patientId}
          patientNome={patientNome}
          patientTelefone={patientTelefone}
          context={context}
        />
      </DialogContent>
    </Dialog>
  );
}
