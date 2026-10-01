"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Copy, LineChart, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { AnthropometricAssessment, Sexo } from "@/lib/types/database.types";
import { classificarImc, idadeNaData, type Classificacao } from "@/lib/anthropometry";
import { sexoDasFormulas } from "@/lib/anthropometry-results";
import { classificarCrescimento, escoreZ, idadeEmMeses } from "@/lib/growth/growth";
import { formatDate } from "@/lib/utils";
import { deleteAssessment } from "@/lib/actions/clinical";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function AssessmentsTable({
  patientId,
  dataNascimento,
  sexo,
  assessments,
}: {
  patientId: string;
  dataNascimento: string | null;
  sexo: Sexo | null;
  assessments: AnthropometricAssessment[];
}) {
  const [isPending, startTransition] = useTransition();

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteAssessment(patientId, id);
      if (!result.success) {
        toast.error("Não foi possível excluir a avaliação", { description: result.message });
        return;
      }
      toast.success("Avaliação excluída.");
    });
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data</TableHead>
          <TableHead>Peso</TableHead>
          <TableHead className="hidden sm:table-cell">Altura</TableHead>
          <TableHead>IMC</TableHead>
          <TableHead className="hidden md:table-cell">Cintura</TableHead>
          <TableHead className="hidden md:table-cell">% Gordura</TableHead>
          <TableHead className="w-[160px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {assessments.map((assessment) => {
          const infantil = assessment.tipo === "crianca";
          const classification = classificacaoImc(assessment, dataNascimento, sexo);
          return (
            <TableRow key={assessment.id}>
              <TableCell className="text-sm">
                <Link
                  href={`/pacientes/${patientId}/avaliacoes/${assessment.id}`}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {formatDate(assessment.data_avaliacao)}
                </Link>
                {infantil && <span className="ml-2 text-xs text-muted-foreground">criança</span>}
              </TableCell>
              <TableCell className="text-sm">{assessment.peso_kg} kg</TableCell>
              <TableCell className="hidden text-sm sm:table-cell">{assessment.altura_cm} cm</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{assessment.imc}</span>
                  {classification && (
                    <Badge variant={classification.tom} className="hidden lg:inline-flex">
                      {classification.label}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                {assessment.circunferencia_cintura_cm ? `${assessment.circunferencia_cintura_cm} cm` : "—"}
              </TableCell>
              <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                {assessment.percentual_gordura !== null ? `${assessment.percentual_gordura}%` : "—"}
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="icon" asChild>
                    <Link
                      href={`/pacientes/${patientId}/avaliacoes/${assessment.id}#evolucao`}
                      aria-label="Evolução até esta avaliação"
                      title="Evolução até esta avaliação"
                    >
                      <LineChart className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/pacientes/${patientId}/avaliacoes/${assessment.id}`} aria-label="Abrir e editar avaliação">
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </Button>
                  {infantil ? (
                    <span className="w-9" aria-hidden="true" />
                  ) : (
                    <Button variant="ghost" size="icon" asChild>
                      <Link
                        href={`/pacientes/${patientId}/avaliacoes/nova?de=${assessment.id}`}
                        aria-label="Duplicar: nova avaliação a partir desta"
                        title="Duplicar: nova avaliação a partir desta"
                      >
                        <Copy className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={isPending}
                    aria-label="Excluir avaliação"
                    onClick={() => handleDelete(assessment.id)}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/** Adulto: OMS/Lipschitz pelo IMC. Criança: IMC por idade pelas curvas da OMS (SISVAN). */
function classificacaoImc(a: AnthropometricAssessment, dataNascimento: string | null, sexoPaciente: Sexo | null): Classificacao | null {
  if (a.tipo !== "crianca") return classificarImc(a.imc, idadeNaData(dataNascimento, a.data_avaliacao));
  const meses = idadeEmMeses(dataNascimento, a.data_avaliacao);
  const sexo = sexoDasFormulas(sexoPaciente, a.sexo_referencia);
  if (meses === null || !sexo) return null;
  const z = escoreZ("imc_idade", sexo, meses, a.imc);
  return z === null ? null : classificarCrescimento("imc_idade", z, meses);
}
