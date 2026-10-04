import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Target } from "lucide-react";

import type { Patient } from "@/lib/types/database.types";
import { calculateAge, cn, getInitials } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ProfileLeaves } from "@/components/shared/leaf-decoration";

const SEXO_ROTULO: Record<string, string> = { masculino: "Masculino", feminino: "Feminino", outro: "Outro" };

/**
 * Cabeçalho do paciente (Fase 19): voltar, avatar com bolinha de ativo/inativo,
 * nome, idade, sexo e objetivo, com as ações da página à direita. O mesmo na
 * ficha do paciente e dentro de um plano alimentar.
 */
export function PatientProfileHeader({
  patient,
  voltar,
  acoes,
}: {
  patient: Pick<Patient, "nome" | "ativo" | "data_nascimento" | "sexo" | "objetivo">;
  voltar: { href: string; rotulo: string };
  acoes: ReactNode;
}) {
  const age = calculateAge(patient.data_nascimento);
  const sexo = patient.sexo ? SEXO_ROTULO[patient.sexo] : null;
  const detalhes = [
    age !== null && (
      <span key="idade" className="inline-flex items-center gap-1.5">
        <CalendarDays className="h-4 w-4" />
        {age} anos
      </span>
    ),
    sexo && <span key="sexo">{sexo}</span>,
    patient.objetivo && (
      <span key="objetivo" className="inline-flex min-w-0 items-center gap-1.5">
        <Target className="h-4 w-4 shrink-0" />
        <span className="break-words">{patient.objetivo}</span>
      </span>
    ),
  ].filter(Boolean);

  return (
    <div className="relative">
      {/* Raminho apagado entre o nome e os botões, como no layout de referência. */}
      <ProfileLeaves className="absolute -top-8 right-[27rem] hidden h-[190px] w-[180px] xl:block" />

      <div className="relative space-y-4">
        <Button variant="ghost" size="sm" asChild className="-ml-3">
          <Link href={voltar.href}>
            <ArrowLeft className="h-4 w-4" />
            {voltar.rotulo}
          </Link>
        </Button>

        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              <Avatar className="h-20 w-20 sm:h-24 sm:w-24">
                <AvatarFallback className="bg-success-soft text-2xl font-semibold text-primary sm:text-3xl">
                  {getInitials(patient.nome)}
                </AvatarFallback>
              </Avatar>
              <span
                title={patient.ativo ? "Ativo" : "Inativo"}
                className={cn(
                  "absolute bottom-1 right-1 h-4 w-4 rounded-full border-[3px] border-background",
                  patient.ativo ? "bg-success" : "bg-muted-foreground/50",
                )}
              >
                <span className="sr-only">{patient.ativo ? "Paciente ativo" : "Paciente inativo"}</span>
              </span>
            </div>
            <div className="min-w-0">
              <h1 className="break-words text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {patient.nome}
              </h1>
              {detalhes.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                  {detalhes.flatMap((d, i) => (i === 0 ? [d] : [<span key={`sep-${i}`} aria-hidden>•</span>, d]))}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">{acoes}</div>
        </div>
      </div>
    </div>
  );
}
