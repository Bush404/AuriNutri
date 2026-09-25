import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getInitials, calculateAge } from "@/lib/utils";
import type {
  Anamnesis,
  AnthropometricAssessment,
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PatientTabs } from "@/components/patients/patient-tabs";
import { ExportPatientButton } from "@/components/patients/export-patient-button";
import { PatientSendDialog } from "@/components/patients/patient-send-dialog";

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
    supabase
      .from("meal_plans")
      .select("*")
      .eq("patient_id", params.id)
      .order("created_at", { ascending: false })
      .returns<MealPlan[]>(),
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
        "*, payments(*), appointments!patient_billings_appointment_id_fkey(id, status, data_hora), pacote_consultas:appointments!appointments_patient_billing_id_fkey(id, status, data_hora, duracao_min)"
      )
      .eq("patient_id", params.id)
      .order("created_at", { ascending: false })
      .order("data_vencimento", { foreignTable: "payments", ascending: true })
      .returns<PatientBillingWithPayments[]>(),
  ]);

  if (!patient) {
    notFound();
  }

  const age = calculateAge(patient.data_nascimento);

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-3">
        <Link href="/pacientes">
          <ArrowLeft className="h-4 w-4" />
          Voltar para pacientes
        </Link>
      </Button>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="text-lg">{getInitials(patient.nome)}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{patient.nome}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {age !== null && <span>{age} anos</span>}
              {patient.objetivo && (
                <>
                  <span aria-hidden>•</span>
                  <Badge variant="secondary">{patient.objetivo}</Badge>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
          <Button variant="outline" asChild>
            <Link href={`/pacientes/${patient.id}/editar`}>
              <Pencil className="h-4 w-4" />
              Editar dados
            </Link>
          </Button>
        </div>
      </div>

      <PatientTabs
        patient={patient}
        anamneses={anamneses ?? []}
        assessments={assessments ?? []}
        mealPlans={mealPlans ?? []}
        consents={consents ?? []}
        labExams={labExams ?? []}
        consentimentoAtivoExames={consentimentoAtivoExames}
        photos={photos ?? []}
        consentimentoAtivoFotos={consentimentoAtivoFotos}
        billings={billings ?? []}
      />
    </div>
  );
}
