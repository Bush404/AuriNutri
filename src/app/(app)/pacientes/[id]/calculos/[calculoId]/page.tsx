import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { massaLivreDaAvaliacao } from "@/lib/evolution";
import type { AnthropometricAssessment, EnergyCalculation, Patient } from "@/lib/types/database.types";
import { getSendCenterContext } from "@/lib/actions/patient-send";
import { PatientProfileHeader } from "@/components/patients/patient-profile-header";
import { PatientHeaderActions } from "@/components/patients/patient-header-actions";
import { PatientTabLinks } from "@/components/patients/patient-tab-links";
import { EnergyCalculationForm, type AvaliacaoParaImportar } from "@/components/patients/energy-calculation-form";

export default async function CalculoEnergeticoPage(props: { params: Promise<{ id: string; calculoId: string }> }) {
  const params = await props.params;
  const supabase = await createClient();

  const [{ data: patient }, { data: calculo }, { data: avaliacoes }, sendCenterContext] = await Promise.all([
    supabase
      .from("patients")
      .select("id, nome, sexo, data_nascimento, telefone, ativo, objetivo")
      .eq("id", params.id)
      .single<Pick<Patient, "id" | "nome" | "sexo" | "data_nascimento" | "telefone" | "ativo" | "objetivo">>(),
    supabase
      .from("energy_calculations")
      .select("*")
      .eq("id", params.calculoId)
      .eq("patient_id", params.id)
      .maybeSingle<EnergyCalculation>(),
    supabase
      .from("anthropometric_assessments")
      .select("*")
      .eq("patient_id", params.id)
      .not("peso_kg", "is", null)
      .order("data_avaliacao", { ascending: false })
      .returns<AnthropometricAssessment[]>(),
    getSendCenterContext(params.id),
  ]);

  if (!patient || !calculo) notFound();

  // "Importar de antropometria": peso, altura e a mesma massa livre de gordura da evolução.
  const paraImportar: AvaliacaoParaImportar[] = (avaliacoes ?? []).map((a) => ({
    id: a.id,
    data: a.data_avaliacao,
    tipo: a.tipo,
    pesoKg: a.peso_kg,
    alturaCm: a.altura_cm,
    mlgKg: massaLivreDaAvaliacao(a, patient.sexo, patient.data_nascimento),
    sexoReferencia: a.sexo_referencia,
  }));

  return (
    <div className="space-y-6">
      <PatientProfileHeader
        patient={patient}
        voltar={{ href: `/pacientes/${patient.id}?aba=calculo-energetico`, rotulo: "Voltar para os cálculos" }}
        acoes={<PatientHeaderActions patient={patient} sendCenterContext={sendCenterContext} />}
      />
      <PatientTabLinks patientId={patient.id} ativa="calculo-energetico" />
      <EnergyCalculationForm key={calculo.id} patient={patient} calculo={calculo} avaliacoes={paraImportar} />
    </div>
  );
}
