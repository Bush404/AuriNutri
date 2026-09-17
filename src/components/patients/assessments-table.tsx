"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { AnthropometricAssessment } from "@/lib/types/database.types";
import { classifyBMI, formatDate } from "@/lib/utils";
import { deleteAssessment } from "@/lib/actions/clinical";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NewAssessmentDialog } from "@/components/patients/new-assessment-dialog";

export function AssessmentsTable({
  patientId,
  assessments,
}: {
  patientId: string;
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
          <TableHead>Altura</TableHead>
          <TableHead>IMC</TableHead>
          <TableHead className="hidden md:table-cell">Cintura</TableHead>
          <TableHead className="hidden md:table-cell">Quadril</TableHead>
          <TableHead className="w-[90px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {assessments.map((assessment) => {
          const classification = classifyBMI(assessment.imc);
          return (
            <TableRow key={assessment.id}>
              <TableCell className="text-sm">{formatDate(assessment.data_avaliacao)}</TableCell>
              <TableCell className="text-sm">{assessment.peso_kg} kg</TableCell>
              <TableCell className="text-sm">{assessment.altura_cm} cm</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{assessment.imc}</span>
                  <Badge
                    variant={
                      classification.tone === "success"
                        ? "success"
                        : classification.tone === "warning"
                        ? "warning"
                        : "destructive"
                    }
                  >
                    {classification.label}
                  </Badge>
                </div>
              </TableCell>
              <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                {assessment.circunferencia_cintura_cm ? `${assessment.circunferencia_cintura_cm} cm` : "—"}
              </TableCell>
              <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                {assessment.circunferencia_quadril_cm ? `${assessment.circunferencia_quadril_cm} cm` : "—"}
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  <NewAssessmentDialog patientId={patientId} assessment={assessment} />
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={isPending}
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
