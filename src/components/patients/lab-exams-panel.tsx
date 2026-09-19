"use client";

import { useState } from "react";
import { ArrowLeft, FlaskConical, Paperclip } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { NewLabExamDialog } from "@/components/patients/new-lab-exam-dialog";
import { NewLabExamWithFileDialog } from "@/components/patients/new-lab-exam-with-file-dialog";
import { NewCatalogMarkerDialog } from "@/components/patients/new-catalog-marker-dialog";
import { LabExamRow, type LabExamWithMarkers } from "@/components/patients/lab-exam-card";
import { LabMarkerEvolutionSection, type MarkerHistoryPoint } from "@/components/patients/lab-marker-evolution-section";

interface LabExamsPanelProps {
  patientId: string;
  exams: LabExamWithMarkers[];
  consentimentoAtivoExames: boolean;
}

type Modo = "menu" | "arquivos" | "marcadores";

/**
 * Ponto de entrada da aba Exames — duas opções distintas, cada uma leva a
 * uma tela só daquilo (nunca as duas juntas): anexar o PDF/imagem que o
 * paciente trouxe, ou lançar os marcadores estruturados à mão. As duas
 * telas continuam lendo/escrevendo os mesmos registros de `lab_exams`
 * (um exame pode acabar tendo arquivo e marcadores, só que cada tela só
 * mostra e edita o que é dela).
 */
export function LabExamsPanel({ patientId, exams, consentimentoAtivoExames }: LabExamsPanelProps) {
  const [modo, setModo] = useState<Modo>("menu");

  const examsOrdenados = exams
    .slice()
    .sort((a, b) => new Date(b.data_coleta).getTime() - new Date(a.data_coleta).getTime());

  // As duas telas são independentes: um exame criado do lado "Anexar PDF"
  // sempre nasce com arquivo_path preenchido (ver NewLabExamWithFileDialog)
  // e um exame criado do lado "Marcadores" nunca tem arquivo — então filtrar
  // por arquivo_path separa as duas listas sem precisar de uma coluna nova.
  const examsComArquivo = examsOrdenados.filter((e) => e.arquivo_path !== null);
  const examsParaMarcadores = examsOrdenados.filter((e) => e.arquivo_path === null);
  const totalMarcadores = examsParaMarcadores.reduce((acc, e) => acc + e.lab_markers.length, 0);

  if (modo === "arquivos") {
    return (
      <ArquivosView
        patientId={patientId}
        exams={examsComArquivo}
        consentimentoAtivoExames={consentimentoAtivoExames}
        onVoltar={() => setModo("menu")}
      />
    );
  }

  if (modo === "marcadores") {
    return <MarcadoresView patientId={patientId} exams={examsParaMarcadores} onVoltar={() => setModo("menu")} />;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        O sistema mostra o valor e a faixa de referência — a interpretação clínica é sempre sua.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <OpcaoCard
          icon={Paperclip}
          titulo="Anexar PDF"
          descricao="Suba o PDF/imagem do exame que o paciente trouxe do laboratório, sem precisar digitar nada."
          contagem={`${examsComArquivo.length} exame(s) com arquivo`}
          onClick={() => setModo("arquivos")}
        />
        <OpcaoCard
          icon={FlaskConical}
          titulo="Preencher marcadores"
          descricao="Lance os resultados manualmente, com faixa de referência e evolução ao longo do tempo."
          contagem={`${totalMarcadores} marcador(es) registrado(s)`}
          onClick={() => setModo("marcadores")}
        />
      </div>
    </div>
  );
}

function OpcaoCard({
  icon: Icon,
  titulo,
  descricao,
  contagem,
  onClick,
}: {
  icon: typeof Paperclip;
  titulo: string;
  descricao: string;
  contagem: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-6 text-left transition-colors hover:border-primary hover:bg-muted/40"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="font-medium text-foreground">{titulo}</p>
        <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>
      </div>
      <p className="text-xs text-muted-foreground">{contagem}</p>
    </button>
  );
}

function VoltarButton({ onVoltar }: { onVoltar: () => void }) {
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onVoltar} className="-ml-3">
      <ArrowLeft className="h-4 w-4" />
      Voltar
    </Button>
  );
}

function ArquivosView({
  patientId,
  exams,
  consentimentoAtivoExames,
  onVoltar,
}: {
  patientId: string;
  exams: LabExamWithMarkers[];
  consentimentoAtivoExames: boolean;
  onVoltar: () => void;
}) {
  return (
    <div className="space-y-4">
      <VoltarButton onVoltar={onVoltar} />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Arquivos de exames</h2>
        <NewLabExamWithFileDialog patientId={patientId} consentimentoAtivoExames={consentimentoAtivoExames} />
      </div>

      {!consentimentoAtivoExames && (
        <p className="rounded-md border border-accent/40 bg-accent/10 p-3 text-sm text-foreground">
          Não há consentimento ativo de exames para este paciente — registre na aba Consentimentos para poder
          anexar arquivos.
        </p>
      )}

      {exams.length === 0 ? (
        <EmptyState
          icon={Paperclip}
          title="Nenhum exame registrado"
          description="Registre o primeiro exame para poder anexar o arquivo."
        />
      ) : (
        <div className="space-y-4">
          {exams.map((exam) => (
            <LabExamRow
              key={exam.id}
              patientId={patientId}
              exam={exam}
              foco="arquivo"
              consentimentoAtivoExames={consentimentoAtivoExames}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MarcadoresView({
  patientId,
  exams,
  onVoltar,
}: {
  patientId: string;
  exams: LabExamWithMarkers[];
  onVoltar: () => void;
}) {
  const historico: MarkerHistoryPoint[] = exams.flatMap((exam) =>
    exam.lab_markers.map((marker) => ({ examDataColeta: exam.data_coleta, marker }))
  );

  return (
    <div className="space-y-4">
      <VoltarButton onVoltar={onVoltar} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">Marcadores de exames</h2>
        <div className="flex items-center gap-2">
          <NewCatalogMarkerDialog />
          <NewLabExamDialog patientId={patientId} />
        </div>
      </div>

      <LabMarkerEvolutionSection historico={historico} />

      {exams.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="Nenhum exame registrado"
          description="Registre o primeiro exame para poder lançar os marcadores."
        />
      ) : (
        <div className="space-y-4">
          {exams.map((exam) => (
            <LabExamRow key={exam.id} patientId={patientId} exam={exam} foco="marcadores" />
          ))}
        </div>
      )}
    </div>
  );
}
