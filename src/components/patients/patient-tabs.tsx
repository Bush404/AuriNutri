"use client";

import { useSearchParams } from "next/navigation";
import { ClipboardList } from "lucide-react";

import type {
  Anamnesis,
  AnamnesisTemplate,
  AnthropometricAssessment,
  MealPlan,
  Patient,
  PatientConsent,
  PatientPhoto,
} from "@/lib/types/database.types";
import { calculateAge, formatDate } from "@/lib/utils";
import { updateSearchParams } from "@/lib/url-state";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { AnamnesisTimeline } from "@/components/patients/anamnesis-timeline";
import { NewAssessmentDialog } from "@/components/patients/new-assessment-dialog";
import { AssessmentsTable } from "@/components/patients/assessments-table";
import { EvolutionChart } from "@/components/patients/evolution-chart";
import { MealPlanList } from "@/components/meal-plans/meal-plan-list";
import { PatientConsentsPanel } from "@/components/patients/patient-consents-panel";
import { LabExamsPanel } from "@/components/patients/lab-exams-panel";
import type { LabExamWithMarkers } from "@/components/patients/lab-exam-card";
import { PatientPhotosPanel } from "@/components/patients/patient-photos-panel";
import { PatientFinancePanel, type PatientBillingWithPayments } from "@/components/patients/patient-finance-panel";

const ABAS = [
  "informacoes",
  "anamnese",
  "avaliacoes",
  "evolucao-fotografica",
  "planos",
  "exames",
  "financeiro",
  "consentimentos",
] as const;

interface PatientTabsProps {
  patient: Patient;
  anamneses: Anamnesis[];
  assessments: AnthropometricAssessment[];
  mealPlans: MealPlan[];
  consents: PatientConsent[];
  labExams: LabExamWithMarkers[];
  consentimentoAtivoExames: boolean;
  photos: PatientPhoto[];
  consentimentoAtivoFotos: boolean;
  billings: PatientBillingWithPayments[];
  anamnesisTemplates: AnamnesisTemplate[];
}

export function PatientTabs({
  patient,
  anamneses,
  assessments,
  mealPlans,
  consents,
  labExams,
  consentimentoAtivoExames,
  photos,
  consentimentoAtivoFotos,
  billings,
  anamnesisTemplates,
}: PatientTabsProps) {
  const age = calculateAge(patient.data_nascimento);
  // A aba aberta fica na URL (?aba=planos): voltar de um plano, ou pelo
  // navegador, cai na mesma aba em vez de "Informações gerais".
  const abaNaUrl = useSearchParams().get("aba");
  const aba = ABAS.find((a) => a === abaNaUrl) ?? "informacoes";

  return (
    <Tabs value={aba} onValueChange={(value) => updateSearchParams({ aba: value, anamnese: null })}>
      <TabsList className="h-auto flex-wrap">
        <TabsTrigger value="informacoes">Informações gerais</TabsTrigger>
        <TabsTrigger value="anamnese">Anamnese</TabsTrigger>
        <TabsTrigger value="avaliacoes">Antropometria Geral</TabsTrigger>
        <TabsTrigger value="evolucao-fotografica">Evolução Fotográfica</TabsTrigger>
        <TabsTrigger value="planos">Planos alimentares</TabsTrigger>
        <TabsTrigger value="exames">Exames</TabsTrigger>
        <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
        <TabsTrigger value="consentimentos">Consentimentos</TabsTrigger>
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
        <AnamnesisTimeline patientId={patient.id} anamneses={anamneses} templates={anamnesisTemplates} />
      </TabsContent>

      <TabsContent value="avaliacoes" className="space-y-6">
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

        {/* Evolução (peso/IMC) unificada aqui — deixou de ser uma aba própria, pedido do usuário: TODO reestruturar a antropometria de verdade mais pra frente, isto aqui ainda é bem simples. */}
        <Card>
          <CardHeader>
            <CardTitle>Evolução</CardTitle>
          </CardHeader>
          <CardContent>
            {assessments.length >= 2 ? (
              <EvolutionChart assessments={assessments} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Registre ao menos duas avaliações para visualizar a evolução do paciente.
              </p>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="evolucao-fotografica">
        <PatientPhotosPanel patientId={patient.id} photos={photos} consentimentoAtivoFotos={consentimentoAtivoFotos} />
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

      <TabsContent value="exames">
        <LabExamsPanel patientId={patient.id} exams={labExams} consentimentoAtivoExames={consentimentoAtivoExames} />
      </TabsContent>

      <TabsContent value="financeiro">
        <PatientFinancePanel patientId={patient.id} billings={billings} />
      </TabsContent>

      <TabsContent value="consentimentos">
        <PatientConsentsPanel patientId={patient.id} consents={consents} />
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
