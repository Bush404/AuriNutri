"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Plus } from "lucide-react";

import { idadeEmMeses, MESES_MAXIMO_INFANTIL } from "@/lib/growth/growth";

import { AttachmentDialog } from "@/components/patients/attachment-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * "Nova avaliação" com os três tipos (Fase 15): adultos e idosos, crianças e
 * adolescentes (até 19 anos, OMS) e anexar relatório externo.
 */
export function NewAssessmentMenu({
  patientId,
  dataNascimento,
  consentimentoAtivoExames,
  size = "sm",
  variant = "default",
}: {
  patientId: string;
  /** undefined = não se sabe aqui (a página da avaliação confere); null = sem data cadastrada. */
  dataNascimento?: string | null;
  consentimentoAtivoExames?: boolean;
  size?: "sm" | "default";
  variant?: "default" | "outline";
}) {
  const [anexando, setAnexando] = useState(false);
  const hoje = new Date().toISOString().slice(0, 10);
  const meses = dataNascimento ? idadeEmMeses(dataNascimento, hoje) : null;
  const infantilBloqueado =
    dataNascimento === null
      ? "Cadastre a data de nascimento"
      : meses !== null && meses > MESES_MAXIMO_INFANTIL
        ? "Protocolo infantil: até 19 anos"
        : null;
  const anexoBloqueado = consentimentoAtivoExames === false ? "Registre o consentimento de exames" : null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size={size} variant={variant}>
            <Plus className="h-4 w-4" />
            Nova avaliação
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>Tipo de avaliação</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={`/pacientes/${patientId}/avaliacoes/nova`}>Adultos e idosos</Link>
          </DropdownMenuItem>
          {infantilBloqueado ? (
            <DropdownMenuItem disabled className="flex-col items-start">
              Crianças e adolescentes
              <span className="text-xs text-muted-foreground">{infantilBloqueado}</span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem asChild>
              <Link href={`/pacientes/${patientId}/avaliacoes/nova?tipo=crianca`}>Crianças e adolescentes (0 a 19 anos)</Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            disabled={Boolean(anexoBloqueado)}
            className="flex-col items-start"
            onSelect={() => setAnexando(true)}
          >
            Anexar relatório externo (PDF, JPG...)
            {anexoBloqueado && <span className="text-xs text-muted-foreground">{anexoBloqueado}</span>}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AttachmentDialog patientId={patientId} open={anexando} onOpenChange={setAnexando} />
    </>
  );
}
