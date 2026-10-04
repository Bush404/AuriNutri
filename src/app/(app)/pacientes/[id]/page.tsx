import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { kcalDoPlano, ordenarPlanos } from "@/lib/meal-planning";
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
import { hasActiveConsent } from "@/lib/actions/patient-consents";
import { getSendCenterContext } from "@/lib/actions/patient-send";
import type { LabExamWithMarkers } from "@/components/patients/lab-exam-card";
import type { PatientBillingWithPayments } from "@/components/patients/patient-finance-panel";

import { Button } from "@/components/ui/button";
import { PatientTabs } from "@/components/patients/patient-tabs";
import { ExportPatientButton } from "@/components/patients/export-patient-button";
import { PatientSendDialog } from "@/components/patients/patient-send-dialog";
import { PatientProfileHeader } from "@/components/patients/patient-profile-header";

type PlanoComItens = MealPlan & {
  meals: { meal_items: { quantidade_g: number; porcao_referencia_g: number; calorias_kcal: number }[] }[];
};

export default async function PacienteDetalhePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();

  const [
    { data: patient },
    { data: anamneses },
    { data: assessments },
    { data: mealPlans },
    { data: consents },
    { data: labExams },
    consentimentoAtivoExames,
    { data: photos },
    consentimentoAtivoFotos,
    sendCenterContext,
    { data: billings },
    { data: anamnesisTemplates },
    { data: attachments },
    { data: calculos },
  ] = await Promise.all([
    supabase.from("patients").select("*").eq("id", params.id).single<Patient>(),
    supabase
      .from("anamnesis")
      .select("*")
      .eq("patient_id", params.id)
      .order("data_registro", { ascending: false })
      .order("created_at", { ascending: false })
      .returns<Anamnesis[]>(),
    supabase
      .from("anthropometric_assessments")
      .select("*")
      .eq("patient_id", params.id)
      .order("data_avaliacao", { ascending: false })
      .returns<AnthropometricAssessment[]>(),
    // Com os itens só para as calorias de cada plano na lista (Fase 17, Bloco G).
    supabase
      .from("meal_plans")
      .select("*, meals(meal_items(quantidade_g, porcao_referencia_g, calorias_kcal))")
      .eq("patient_id", params.id)
      .order("created_at", { ascending: false })
      .returns<PlanoComItens[]>(),
    supabase
      .from("patient_consents")
      .select("*")
      .eq("patient_id", params.id)
      .order("data_consentimento", { ascending: false })
      .returns<PatientConsent[]>(),
    supabase
      .from("lab_exams")
      .select("*, lab_markers(*)")
      .eq("patient_id", params.id)
      .order("data_coleta", { ascending: false })
      .returns<LabExamWithMarkers[]>(),
    hasActiveConsent(params.id, "exames"),
    supabase
      .from("patient_photos")
      .select("*")
      .eq("patient_id", params.id)
      .order("data_registro", { ascending: false })
      .returns<PatientPhoto[]>(),
    hasActiveConsent(params.id, "fotos"),
    getSendCenterContext(params.id),
    supabase
      .from("patient_billings")
      .select(
        "*, payments(*), appointments!patient_billings_appointment_id_fkey(id, status, data_hora), pacote_consultas:appointments!appointments_patient_billing_id_fkey(id, status, data_hora, duracao_min)",
      )
      .eq("patient_id", params.id)
      .order("created_at", { ascending: false })
      .order("data_vencimento", { foreignTable: "payments", ascending: true })
      .returns<PatientBillingWithPayments[]>(),
    supabase.from("anamnesis_templates").select("*").order("nome").returns<AnamnesisTemplate[]>(),
    supabase
      .from("anthropometric_attachments")
      .select("*")
      .eq("patient_id", params.id)
      .order("data_avaliacao", { ascending: false })
      .returns<AnthropometricAttachment[]>(),
    supabase
      .from("energy_calculations")
      .select("*")
      .eq("patient_id", params.id)
      .order("data_calculo", { ascending: false })
      .order("created_at", { ascending: false })
      .returns<EnergyCalculation[]>(),
  ]);

  if (!patient) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PatientProfileHeader
        patient={patient}
        voltar={{ href: "/pacientes", rotulo: "Voltar para pacientes" }}
        acoes={
          <>
            <PatientSendDialog
              patientId={patient.id}
              patientNome={patient.nome}
              patientTelefone={patient.telefone}
              context={
                sendCenterContext ?? {
                  profissionalNome: "",
                  planoAtivo: null,
                  planoShareLinks: [],
                  avaliacoes: [],
                  proximaConsulta: null,
                  pagamentosRecebidos: [],
                }
              }
            />
            <ExportPatientButton patientId={patient.id} patientName={patient.nome} />
            <Button asChild>
              <Link href={`/pacientes/${patient.id}/editar`}>
                <Pencil className="h-4 w-4" />
                Editar dados
              </Link>
            </Button>
          </>
        }
      />

      <PatientTabs
        patient={patient}
        anamneses={anamneses ?? []}
        assessments={assessments ?? []}
        attachments={attachments ?? []}
        calculos={calculos ?? []}
        mealPlans={ordenarPlanos(
          (mealPlans ?? []).map(({ meals, ...plano }) => ({
            ...plano,
            kcal: kcalDoPlano((meals ?? []).flatMap((m) => m.meal_items ?? [])),
          })),
        )}
        consents={consents ?? []}
        labExams={labExams ?? []}
        consentimentoAtivoExames={consentimentoAtivoExames}
        photos={photos ?? []}
        consentimentoAtivoFotos={consentimentoAtivoFotos}
        billings={billings ?? []}
        anamnesisTemplates={anamnesisTemplates ?? []}
      />
    </div>
  );
}
