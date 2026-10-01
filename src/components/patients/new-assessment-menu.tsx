"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { idadeEmMeses, MESES_MAXIMO_INFANTIL } from "@/lib/growth/growth";
import { cn } from "@/lib/utils";

import { AttachmentDialog } from "@/components/patients/attachment-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * "Nova avaliação antropométrica": escolhe o tipo numa janela com botões
 * grandes (Fase 15) — adultos e idosos, crianças e adolescentes (até 19 anos,
 * OMS) ou anexar relatório externo.
 */
export function NewAssessmentMenu({
  patientId,
  dataNascimento,
  consentimentoAtivoExames,
  larguraTotal = false,
  variant = "default",
}: {
  patientId: string;
  /** undefined = não se sabe aqui (a página da avaliação confere); null = sem data cadastrada. */
  dataNascimento?: string | null;
  consentimentoAtivoExames?: boolean;
  larguraTotal?: boolean;
  variant?: "default" | "outline";
}) {
  const [aberto, setAberto] = useState(false);
  const [anexando, setAnexando] = useState(false);
  const hoje = new Date().toISOString().slice(0, 10);
  const meses = dataNascimento ? idadeEmMeses(dataNascimento, hoje) : null;
  const infantilBloqueado =
    dataNascimento === null
      ? "Cadastre a data de nascimento do paciente."
      : meses !== null && meses > MESES_MAXIMO_INFANTIL
        ? "Pela OMS, o protocolo infantil vai até 19 anos."
        : null;
  const anexoBloqueado = consentimentoAtivoExames === false ? "Registre o consentimento de exames do paciente." : null;

  const opcao = "h-auto w-full whitespace-normal py-3 text-base";

  return (
    <>
      <Button
        size={larguraTotal ? "default" : "sm"}
        variant={variant}
        className={cn(larguraTotal && "w-full")}
        onClick={() => setAberto(true)}
      >
        <Plus className="h-4 w-4" />
        {larguraTotal ? "Nova avaliação antropométrica" : "Nova avaliação"}
      </Button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova avaliação antropométrica</DialogTitle>
            <DialogDescription>Escolha o tipo de avaliação.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Button asChild className={opcao}>
              <Link href={`/pacientes/${patientId}/avaliacoes/nova`}>Antropometria de adultos e idosos</Link>
            </Button>
            {infantilBloqueado ? (
              <div className="space-y-1">
                <Button disabled className={opcao}>
                  Antropometria de crianças e adolescentes
                </Button>
                <p className="text-center text-xs text-muted-foreground">{infantilBloqueado}</p>
              </div>
            ) : (
              <Button asChild className={opcao}>
                <Link href={`/pacientes/${patientId}/avaliacoes/nova?tipo=crianca`}>Antropometria de crianças e adolescentes</Link>
              </Button>
            )}
            <div className="space-y-1">
              <Button
                className={opcao}
                disabled={Boolean(anexoBloqueado)}
                onClick={() => {
                  setAberto(false);
                  setAnexando(true);
                }}
              >
                Anexar relatório externo (PDF, JPG, etc.)
              </Button>
              {anexoBloqueado && <p className="text-center text-xs text-muted-foreground">{anexoBloqueado}</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AttachmentDialog patientId={patientId} open={anexando} onOpenChange={setAnexando} />
    </>
  );
}
