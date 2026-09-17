"use client";

import Link from "next/link";
import { ExternalLink, Loader2, Minus, Plus, TrendingDown, TrendingUp } from "lucide-react";

import type { PatientAgendaContext } from "@/lib/patient-context";
import { PENDENCIA_META, PENDENCIA_ORDEM, formatDiasAtras } from "@/lib/patient-context";
import { APPOINTMENT_STATUS_META } from "@/lib/agenda";
import { formatDate } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NewAssessmentDialog } from "@/components/patients/new-assessment-dialog";
import { NewMealPlanDialog } from "@/components/meal-plans/new-meal-plan-dialog";

interface PatientContextPanelProps {
  patientId: string;
  context: PatientAgendaContext | null;
  loading: boolean;
}

/** Contexto clínico do paciente exibido dentro do diálogo de agendamento (Fase 5, Bloco C). */
export function PatientContextPanel({ patientId, context, loading }: PatientContextPanelProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando contexto do paciente...
      </div>
    );
  }

  if (!context) return null;

  const pendencias = PENDENCIA_ORDEM.filter((tipo) => context.pendencias.includes(tipo));

  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
      {pendencias.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {pendencias.map((tipo) => {
            const meta = PENDENCIA_META[tipo];
            const Icon = meta.icon;
            return (
              <Badge key={tipo} variant="warning" className="gap-1">
                <Icon className="h-3 w-3" />
                {meta.label}
              </Badge>
            );
          })}
        </div>
      )}

      <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Última consulta</dt>
          <dd className="font-medium text-foreground">
            {context.ultimaConsulta ? (
              <span className="inline-flex items-center gap-1.5">
                {formatDate(context.ultimaConsulta.dataHora.slice(0, 10))}
                <Badge variant={APPOINTMENT_STATUS_META[context.ultimaConsulta.status].badgeVariant} className="text-[10px]">
                  {APPOINTMENT_STATUS_META[context.ultimaConsulta.status].label}
                </Badge>
              </span>
            ) : (
              "Nenhuma consulta anterior"
            )}
          </dd>
        </div>

        <div>
          <dt className="text-muted-foreground">Última avaliação</dt>
          <dd className="font-medium text-foreground">
            {context.ultimaAvaliacao ? (
              <span className="inline-flex items-center gap-1">
                {formatDiasAtras(context.ultimaAvaliacao.diasAtras)} — {context.ultimaAvaliacao.pesoKg}kg
                <WeightEvolutionIcon
                  evolucao={context.ultimaAvaliacao.evolucaoPeso}
                  diffKg={
                    context.ultimaAvaliacao.pesoAnteriorKg !== null
                      ? Math.abs(context.ultimaAvaliacao.pesoKg - context.ultimaAvaliacao.pesoAnteriorKg)
                      : null
                  }
                />
              </span>
            ) : (
              "Nunca avaliado"
            )}
          </dd>
        </div>

        <div>
          <dt className="text-muted-foreground">Plano alimentar</dt>
          <dd className="font-medium text-foreground">
            {context.planoAtivo ? (
              <>
                Ativo desde {formatDate(context.planoAtivo.dataInicio)} ({formatDiasAtras(context.planoAtivo.diasAtras)})
              </>
            ) : (
              "Sem plano ativo"
            )}
          </dd>
        </div>

        <div>
          <dt className="text-muted-foreground">Anamnese</dt>
          <dd className="font-medium text-foreground">{context.temAnamnese ? "Registrada" : "Não registrada"}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/pacientes/${patientId}`} target="_blank">
            <ExternalLink className="h-3.5 w-3.5" />
            Ver perfil
          </Link>
        </Button>
        <NewAssessmentDialog patientId={patientId} />
        <NewMealPlanDialog
          patientId={patientId}
          trigger={
            <Button variant="outline" size="sm">
              <Plus className="h-3.5 w-3.5" />
              Criar plano
            </Button>
          }
        />
      </div>
    </div>
  );
}

// Sem cor de "bom/ruim": subir ou descer de peso pode ser o objetivo do
// paciente (ganho de massa vs. emagrecimento) — só indicamos a direção,
// quem julga se é uma evolução boa é o profissional.
function WeightEvolutionIcon({ evolucao, diffKg }: { evolucao: string; diffKg: number | null }) {
  if (evolucao === "subiu") {
    return (
      <span className="inline-flex items-center text-muted-foreground" title={`Subiu ${diffKg?.toFixed(1)}kg`}>
        <TrendingUp className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (evolucao === "desceu") {
    return (
      <span className="inline-flex items-center text-muted-foreground" title={`Desceu ${diffKg?.toFixed(1)}kg`}>
        <TrendingDown className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (evolucao === "estavel") {
    return (
      <span className="inline-flex items-center text-muted-foreground" title="Peso estável">
        <Minus className="h-3.5 w-3.5" />
      </span>
    );
  }
  return null;
}
