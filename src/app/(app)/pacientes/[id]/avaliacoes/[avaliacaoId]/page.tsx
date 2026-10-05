import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import type { AnthropometricAssessment, Patient } from "@/lib/types/database.types";
import { idadeNaData } from "@/lib/anthropometry";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AssessmentForm } from "@/components/patients/assessment-form";
import { ChildAssessmentForm, type AvaliacaoInfantilResumo } from "@/components/patients/child-assessment-form";

export default async function AvaliacaoPage(props: { params: Promise<{ id: string; avaliacaoId: string }> }) {
  const params = await props.params;
  const supabase = await createClient();

  const [{ data: patient }, { data: assessment }, { data: historico }] = await Promise.all([
    supabase
      .from("patients")
      .select("id, nome, sexo, data_nascimento")
      .eq("id", params.id)
      .single<Pick<Patient, "id" | "nome" | "sexo" | "data_nascimento">>(),
    supabase
      .from("anthropometric_assessments")
      .select("*")
      .eq("id", params.avaliacaoId)
      .eq("patient_id", params.id)
      .maybeSingle<AnthropometricAssessment>(),
    supabase
      .from("anthropometric_assessments")
      .select("id, data_avaliacao, peso_kg, altura_cm")
      .eq("patient_id", params.id)
      .eq("tipo", "crianca")
      .returns<AvaliacaoInfantilResumo[]>(),
  ]);

  if (!patient || !assessment) notFound();
  const idade = idadeNaData(patient.data_nascimento, assessment.data_avaliacao);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-3 mb-2">
          <Link href={`/pacientes/${patient.id}?aba=avaliacoes`}>
            <ArrowLeft className="h-4 w-4" />
            Voltar para o paciente
          </Link>
        </Button>
        <h1 className="text-h1 text-foreground">
          Avaliação de {formatDate(assessment.data_avaliacao)}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {patient.nome}
          {idade !== null && ` · ${idade} anos na data da avaliação`}
        </p>
      </div>

      {assessment.tipo === "crianca" ? (
        <ChildAssessmentForm key={assessment.id} patient={patient} assessment={assessment} historico={historico ?? []} />
      ) : (
        <AssessmentForm key={assessment.id} patient={patient} assessment={assessment} />
      )}
    </div>
  );
}
