"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { AnthropometricAssessment } from "@/lib/types/database.types";
import { classificarImc, idadeNaData } from "@/lib/anthropometry";
import { formatDate } from "@/lib/utils";
import { deleteAssessment } from "@/lib/actions/clinical";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function AssessmentsTable({
  patientId,
  dataNascimento,
  assessments,
}: {
  patientId: string;
  dataNascimento: string | null;
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
          <TableHead className="w-[120px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {assessments.map((assessment) => {
          const classification = classificarImc(assessment.imc, idadeNaData(dataNascimento, assessment.data_avaliacao));
          return (
            <TableRow key={assessment.id}>
              <TableCell className="text-sm">
                <Link
                  href={`/pacientes/${patientId}/avaliacoes/${assessment.id}`}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {formatDate(assessment.data_avaliacao)}
                </Link>
              </TableCell>
              <TableCell className="text-sm">{assessment.peso_kg} kg</TableCell>
              <TableCell className="hidden text-sm sm:table-cell">{assessment.altura_cm} cm</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{assessment.imc}</span>
                  <Badge variant={classification.tom} className="hidden lg:inline-flex">
                    {classification.label}
                  </Badge>
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
                    <Link href={`/pacientes/${patientId}/avaliacoes/${assessment.id}`} aria-label="Abrir e editar avaliação">
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" asChild>
                    <Link
                      href={`/pacientes/${patientId}/avaliacoes/nova?de=${assessment.id}`}
                      aria-label="Duplicar: nova avaliação a partir desta"
                      title="Duplicar: nova avaliação a partir desta"
                    >
                      <Copy className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </Button>
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
