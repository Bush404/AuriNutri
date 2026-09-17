"use client";

import { ClipboardList, LineChart as LineChartIcon } from "lucide-react";

import type { Anamnesis, AnthropometricAssessment, MealPlan, Patient } from "@/lib/types/database.types";
import { calculateAge, formatDate } from "@/lib/utils";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { AnamnesisTimeline } from "@/components/patients/anamnesis-timeline";
import { NewAssessmentDialog } from "@/components/patients/new-assessment-dialog";
import { AssessmentsTable } from "@/components/patients/assessments-table";
import { EvolutionChart } from "@/components/patients/evolution-chart";
import { MealPlanList } from "@/components/meal-plans/meal-plan-list";

interface PatientTabsProps {
  patient: Patient;
  anamneses: Anamnesis[];
  assessments: AnthropometricAssessment[];
  mealPlans: MealPlan[];
}

export function PatientTabs({ patient, anamneses, assessments, mealPlans }: PatientTabsProps) {
  const age = calculateAge(patient.data_nascimento);

  return (
    <Tabs defaultValue="informacoes">
      <TabsList className="flex-wrap">
        <TabsTrigger value="informacoes">Informações gerais</TabsTrigger>
        <TabsTrigger value="anamnese">Anamnese</TabsTrigger>
        <TabsTrigger value="avaliacoes">Avaliações</TabsTrigger>
        <TabsTrigger value="evolucao">Evolução</TabsTrigger>
        <TabsTrigger value="planos">Planos alimentares</TabsTrigger>
      </TabsList>

      <TabsContent value="informacoes">
        <Card>
          <CardHeader>
            <CardTitle>Informações gerais</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <InfoRow label="Nome completo" value={patient.nome} />
            <InfoRow label="E-mail" value={patient.email ?? "—"} />
            <InfoRow label="Telefone" value={patient.telefone ?? "—"} />
            <InfoRow
              label="Data de nascimento"
              value={patient.data_nascimento ? `${formatDate(patient.data_nascimento)} (${age} anos)` : "—"}
            />
            <InfoRow label="Sexo" value={patient.sexo ? capitalize(patient.sexo) : "—"} />
            <InfoRow label="Endereço" value={patient.endereco ?? "—"} />
            <InfoRow label="Objetivo" value={patient.objetivo ?? "—"} full />
            <InfoRow label="Observações" value={patient.observacoes ?? "—"} full />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="anamnese">
        <AnamnesisTimeline patientId={patient.id} anamneses={anamneses} />
      </TabsContent>

      <TabsContent value="avaliacoes">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Avaliações antropométricas</CardTitle>
            <NewAssessmentDialog patientId={patient.id} />
          </CardHeader>
          <CardContent>
            {assessments.length > 0 ? (
              <AssessmentsTable patientId={patient.id} assessments={assessments} />
            ) : (
              <EmptyState
                icon={ClipboardList}
                title="Nenhuma avaliação registrada"
                description="Registre a primeira avaliação antropométrica deste paciente."
              />
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="evolucao">
        <Card>
          <CardHeader>
            <CardTitle>Evolução</CardTitle>
          </CardHeader>
          <CardContent>
            {assessments.length >= 2 ? (
              <EvolutionChart assessments={assessments} />
            ) : (
              <EmptyState
                icon={LineChartIcon}
                title="Dados insuficientes para exibir evolução"
                description="Registre ao menos duas avaliações antropométricas para visualizar a evolução do paciente."
              />
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="planos">
        <Card>
          <CardHeader>
            <CardTitle>Planos alimentares</CardTitle>
          </CardHeader>
          <CardContent>
            <MealPlanList patientId={patient.id} mealPlans={mealPlans} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function InfoRow({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value}</p>
    </div>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
