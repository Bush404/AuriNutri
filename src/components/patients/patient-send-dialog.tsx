"use client";

import { useState } from "react";
import { Send } from "lucide-react";

import type { SendCenterContext } from "@/lib/actions/patient-send";
import { PatientSendPanel, type SendItemId } from "@/components/patients/patient-send-panel";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface PatientSendDialogProps {
  patientId: string;
  patientNome: string;
  patientTelefone: string | null;
  context: SendCenterContext;
  /**
   * Aberta por outro botão (ex.: "Recibo" da aba Financeiro): sem o botão
   * "Enviar" próprio, controlada por fora e já com os itens marcados.
   */
  controle?: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    inicial: { itens: SendItemId[]; reciboPagamentoId?: string };
  };
}

/** Botão "Enviar" ao lado de Exportar dados/Editar dados — abre a Central de Envio num diálogo, em vez de ser uma aba própria. */
export function PatientSendDialog({ patientId, patientNome, patientTelefone, context, controle }: PatientSendDialogProps) {
  const [openProprio, setOpenProprio] = useState(false);
  const open = controle ? controle.open : openProprio;
  const setOpen = controle ? controle.onOpenChange : setOpenProprio;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!controle && (
        <DialogTrigger asChild>
          <Button variant="outline">
            <Send className="h-4 w-4" />
            Enviar
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar para {patientNome}</DialogTitle>
        </DialogHeader>

        <PatientSendPanel
          patientId={patientId}
          patientNome={patientNome}
          patientTelefone={patientTelefone}
          context={context}
          inicial={controle?.inicial}
        />
      </DialogContent>
    </Dialog>
  );
}
