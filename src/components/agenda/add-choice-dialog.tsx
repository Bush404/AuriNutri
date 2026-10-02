"use client";

import { CheckSquare, ChevronRight, Package, Plus } from "lucide-react";

import { formatDayShort } from "@/lib/agenda";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface AddChoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateStr: string | null;
  /** Horário clicado na visão Semana (vai para consulta e tarefa; pacote não usa). */
  timeStr?: string;
  onConsulta: () => void;
  onPacote: () => void;
  onTarefa: () => void;
}

/**
 * Clicar num espaço vazio do calendário abre esta escolha (Fase 19): cada opção leva
 * à janela de agendamento que já existe, com a data (e o horário) preenchidos.
 */
export function AddChoiceDialog({ open, onOpenChange, dateStr, timeStr, onConsulta, onPacote, onTarefa }: AddChoiceDialogProps) {
  if (!dateStr) return null;

  const opcoes = [
    { label: "Nova consulta", descricao: "Agendar um atendimento", icon: Plus, onClick: onConsulta },
    { label: "Novo pacote", descricao: "Várias consultas com uma cobrança só", icon: Package, onClick: onPacote },
    { label: "Nova tarefa", descricao: "Um lembrete ou compromisso seu", icon: CheckSquare, onClick: onTarefa },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>O que deseja adicionar?</DialogTitle>
          <DialogDescription>
            Dia {formatDayShort(dateStr)}
            {timeStr ? ` às ${timeStr}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {opcoes.map((opcao) => (
            <button
              key={opcao.label}
              type="button"
              onClick={() => {
                onOpenChange(false);
                opcao.onClick();
              }}
              className="group flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary-200 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary group-hover:bg-card">
                <opcao.icon className="h-4 w-4 text-primary" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">{opcao.label}</span>
                <span className="block text-xs text-muted-foreground">{opcao.descricao}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
