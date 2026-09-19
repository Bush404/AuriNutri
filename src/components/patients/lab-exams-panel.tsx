import { FlaskConical } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { NewLabExamDialog } from "@/components/patients/new-lab-exam-dialog";
import { NewCatalogMarkerDialog } from "@/components/patients/new-catalog-marker-dialog";
import { LabExamCard, type LabExamWithMarkers } from "@/components/patients/lab-exam-card";
import { LabMarkerEvolutionSection, type MarkerHistoryPoint } from "@/components/patients/lab-marker-evolution-section";

interface LabExamsPanelProps {
  patientId: string;
  exams: LabExamWithMarkers[];
  consentimentoAtivoExames: boolean;
}

export function LabExamsPanel({ patientId, exams, consentimentoAtivoExames }: LabExamsPanelProps) {
  const examsOrdenados = exams
    .slice()
    .sort((a, b) => new Date(b.data_coleta).getTime() - new Date(a.data_coleta).getTime());

  const historico: MarkerHistoryPoint[] = exams.flatMap((exam) =>
    exam.lab_markers.map((marker) => ({ examDataColeta: exam.data_coleta, marker }))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            O sistema mostra o valor e a faixa de referência — a interpretação clínica é sempre sua.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NewCatalogMarkerDialog />
          <NewLabExamDialog patientId={patientId} />
        </div>
      </div>

      <LabMarkerEvolutionSection historico={historico} />

      {examsOrdenados.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="Nenhum exame registrado"
          description="Registre o primeiro exame laboratorial deste paciente."
        />
      ) : (
        <div className="space-y-4">
          {examsOrdenados.map((exam) => (
            <LabExamCard key={exam.id} patientId={patientId} exam={exam} consentimentoAtivoExames={consentimentoAtivoExames} />
          ))}
        </div>
      )}
    </div>
  );
}
