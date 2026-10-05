"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ComponentType } from "react";
import { CalendarDays, FileText, Mail, MapPin, Phone, Target, User } from "lucide-react";

import type {
  Anamnesis,
  AnamnesisTemplate,
  AnthropometricAssessment,
  AnthropometricAttachment,
  EnergyCalculation,
  MealPlan,
  Patient,
  PatientConsent,
  PatientPhoto,
} from "@/lib/types/database.types";
import { calculateAge, cn, formatDate, formatTelefone } from "@/lib/utils";
import { updateSearchParams } from "@/lib/url-state";
import type { SendCenterContext } from "@/lib/actions/patient-send";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { AnamnesisTimeline } from "@/components/patients/anamnesis-timeline";
import { AnthropometryPanel } from "@/components/patients/anthropometry-panel";
import { EnergyCalculationsPanel } from "@/components/patients/energy-calculations-panel";
import { MealPlanList, type PlanoNaLista } from "@/components/meal-plans/meal-plan-list";
import { PatientConsentsPanel } from "@/components/patients/patient-consents-panel";
import { LabExamsPanel } from "@/components/patients/lab-exams-panel";
import type { LabExamWithMarkers } from "@/components/patients/lab-exam-card";
import { PatientPhotosPanel } from "@/components/patients/patient-photos-panel";
import { PatientFinancePanel, type PatientBillingWithPayments } from "@/components/patients/patient-finance-panel";
import { GoalMountain } from "@/components/shared/leaf-decoration";
import { ABA_CLASSE, ABAS_FAIXA_CLASSE, ABAS_PACIENTE } from "@/components/patients/patient-tab-links";


interface PatientTabsProps {
  patient: Patient;
  anamneses: Anamnesis[];
  assessments: AnthropometricAssessment[];
  attachments: AnthropometricAttachment[];
  calculos: EnergyCalculation[];
  mealPlans: PlanoNaLista[];
  consents: PatientConsent[];
  labExams: LabExamWithMarkers[];
  consentimentoAtivoExames: boolean;
  photos: PatientPhoto[];
  consentimentoAtivoFotos: boolean;
  billings: PatientBillingWithPayments[];
  anamnesisTemplates: AnamnesisTemplate[];
  /** "yyyy-mm-dd" no fuso do Brasil (filtro de período da antropometria). */
  hoje: string;
  /** Central de Envio (botão "Recibo" da aba Financeiro). */
  sendCenterContext: SendCenterContext | null;
}

export function PatientTabs({
  patient,
  anamneses,
  assessments,
  attachments,
  calculos,
  mealPlans,
  consents,
  labExams,
  consentimentoAtivoExames,
  photos,
  consentimentoAtivoFotos,
  billings,
  anamnesisTemplates,
  hoje,
  sendCenterContext,
}: PatientTabsProps) {
  const age = calculateAge(patient.data_nascimento);
  // A aba aberta fica na URL (?aba=planos): voltar de um plano, ou pelo
  // navegador, cai na mesma aba em vez de "Informações gerais".
  const abaNaUrl = useSearchParams().get("aba");
  const aba = ABAS_PACIENTE.find((a) => a.valor === abaNaUrl)?.valor ?? "informacoes";

  return (
    <Tabs value={aba} onValueChange={(value) => updateSearchParams({ aba: value, anamnese: null })}>
      <TabsList className={ABAS_FAIXA_CLASSE}>
        {ABAS_PACIENTE.map((a) => (
          <TabsTrigger key={a.valor} value={a.valor} className={ABA_CLASSE}>
            {a.rotulo}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="informacoes">
        <Card>
          <CardContent className="space-y-3 p-4 sm:p-5">
            <SectionTitle
              icon={User}
              title="Informações gerais"
              subtitle="Informações pessoais e de contato do paciente"
            />

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <InfoTile icon={User} label="Nome completo" value={patient.nome} />
              <InfoTile icon={Mail} label="E-mail" value={patient.email ?? "—"} />
              <InfoTile icon={Phone} label="Telefone" value={patient.telefone ? formatTelefone(patient.telefone) : "—"} />
              <InfoTile
                icon={CalendarDays}
                label="Data de nascimento"
                value={patient.data_nascimento ? `${formatDate(patient.data_nascimento)} (${age} anos)` : "—"}
              />
              <InfoTile
                icon={patient.sexo === "masculino" ? MarsIcon : patient.sexo === "feminino" ? VenusIcon : User}
                label="Sexo"
                value={patient.sexo ? capitalize(patient.sexo) : "—"}
              />
              <InfoTile icon={MapPin} label="Endereço" value={patient.endereco ?? "—"} />
            </div>

            <div className="relative overflow-hidden rounded-xl border bg-success-soft/40 px-4 py-3">
              <GoalMountain className="absolute bottom-0 right-0 h-[100px] w-[265px] max-w-full" />
              <div className="relative space-y-2">
                <SectionTitle
                  icon={Target}
                  title="Objetivo do paciente"
                  subtitle="Principal objetivo relacionado ao seu acompanhamento"
                />
                <div className="flex items-center gap-2.5 rounded-lg border bg-card/70 px-3 py-2 text-sm sm:ml-12">
                  <IconTile icon={Target} small />
                  <p
                    className={cn(
                      "min-w-0 whitespace-pre-wrap break-words",
                      patient.objetivo ? "font-semibold text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {patient.objetivo ?? "Nenhum objetivo cadastrado"}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border px-4 py-3">
              <SectionTitle icon={FileText} title="Observações" subtitle="Anotações gerais sobre o paciente" />
              <div className="flex items-start gap-2.5 rounded-lg bg-muted/60 px-3 py-2 text-sm sm:ml-12">
                <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <p
                  className={cn(
                    "min-w-0 whitespace-pre-wrap break-words",
                    patient.observacoes ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {patient.observacoes ?? "Nenhuma observação"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="anamnese">
        <AnamnesisTimeline patientId={patient.id} anamneses={anamneses} templates={anamnesisTemplates} />
      </TabsContent>

      <TabsContent value="avaliacoes">
        <AnthropometryPanel
          patientId={patient.id}
          sexo={patient.sexo}
          dataNascimento={patient.data_nascimento}
          consentimentoAtivoExames={consentimentoAtivoExames}
          assessments={assessments}
          attachments={attachments}
          hoje={hoje}
        />
      </TabsContent>

      <TabsContent value="calculo-energetico">
        <EnergyCalculationsPanel patientId={patient.id} calculos={calculos} />
      </TabsContent>

      <TabsContent value="evolucao-fotografica">
        <PatientPhotosPanel patientId={patient.id} photos={photos} consentimentoAtivoFotos={consentimentoAtivoFotos} />
      </TabsContent>

      <TabsContent value="planos">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <MealPlanList
              patientId={patient.id}
              mealPlans={mealPlans}
              pesoKg={assessments.find((a) => a.peso_kg !== null)?.peso_kg ?? null}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="exames">
        <LabExamsPanel patientId={patient.id} exams={labExams} consentimentoAtivoExames={consentimentoAtivoExames} />
      </TabsContent>

      <TabsContent value="financeiro">
        <PatientFinancePanel
          patientId={patient.id}
          patientNome={patient.nome}
          patientTelefone={patient.telefone}
          billings={billings}
          sendCenterContext={sendCenterContext}
          hoje={hoje}
        />
      </TabsContent>

      <TabsContent value="consentimentos">
        <PatientConsentsPanel patientId={patient.id} consents={consents} />
      </TabsContent>
    </Tabs>
  );
}

type IconComponent = ComponentType<{ className?: string }>;

function IconTile({ icon: Icon, small }: { icon: IconComponent; small?: boolean }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg bg-success-soft text-primary",
        small ? "h-7 w-7" : "h-9 w-9",
      )}
    >
      <Icon className={small ? "h-3.5 w-3.5" : "h-4 w-4"} />
    </span>
  );
}

function SectionTitle({ icon, title, subtitle }: { icon: IconComponent; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <IconTile icon={icon} />
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function InfoTile({ icon, label, value }: { icon: IconComponent; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
      <IconTile icon={icon} />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="break-words text-sm text-foreground">{value}</p>
      </div>
    </div>
  );
}

/** Símbolos de masculino/feminino no traço dos ícones lucide (a versão instalada não os tem). */
function MarsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <circle cx="10" cy="14" r="6" />
      <path d="M14.2 9.8 21 3" />
      <path d="M15 3h6v6" />
    </svg>
  );
}

function VenusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <circle cx="12" cy="9" r="6" />
      <path d="M12 15v7" />
      <path d="M9 19h6" />
    </svg>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
