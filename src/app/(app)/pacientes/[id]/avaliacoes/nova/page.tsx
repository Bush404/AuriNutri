import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import type { AnthropometricAssessment, Patient } from "@/lib/types/database.types";
import { calculateAge, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AssessmentForm } from "@/components/patients/assessment-form";
import { ChildAssessmentForm, type AvaliacaoInfantilResumo } from "@/components/patients/child-assessment-form";

/**
 * Nova avaliação. `?tipo=crianca` = crianças e adolescentes (curvas da OMS);
 * sem tipo = adultos e idosos. Com `?de=<id>`, a de adulto começa com as
 * medidas de outra avaliação ("Duplicar").
 */
export default async function NovaAvaliacaoPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ de?: string; tipo?: string }>;
}) {
  const [params, searchParams] = await Promise.all([props.params, props.searchParams]);
  const supabase = await createClient();

  const infantil = searchParams.tipo === "crianca";
  const [{ data: patient }, { data: origem }, { data: historico }] = await Promise.all([
    supabase
      .from("patients")
      .select("id, nome, sexo, data_nascimento")
      .eq("id", params.id)
      .single<Pick<Patient, "id" | "nome" | "sexo" | "data_nascimento">>(),
    searchParams.de
      ? supabase
          .from("anthropometric_assessments")
          .select("*")
          .eq("id", searchParams.de)
          .eq("patient_id", params.id)
          .maybeSingle<AnthropometricAssessment>()
      : Promise.resolve({ data: null }),
    infantil
      ? supabase
          .from("anthropometric_assessments")
          .select("id, data_avaliacao, peso_kg, altura_cm")
          .eq("patient_id", params.id)
          .eq("tipo", "crianca")
          .returns<AvaliacaoInfantilResumo[]>()
      : Promise.resolve({ data: [] as AvaliacaoInfantilResumo[] }),
  ]);

  if (!patient) notFound();
  const idade = calculateAge(patient.data_nascimento);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-3 mb-2">
          <Link href={`/pacientes/${patient.id}?aba=avaliacoes`}>
            <ArrowLeft className="h-4 w-4" />
            Voltar para o paciente
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Nova avaliação antropométrica</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {patient.nome}
          {idade !== null && ` · ${idade} anos`} · {infantil ? "criança e adolescente" : "adulto e idoso"}
          {origem && !infantil && ` · a partir da avaliação de ${formatDate(origem.data_avaliacao)}`}
        </p>
      </div>

      {infantil ? (
        <ChildAssessmentForm patient={patient} historico={historico ?? []} />
      ) : (
        <AssessmentForm patient={patient} assessment={origem ?? undefined} duplicar={Boolean(origem)} />
      )}
    </div>
  );
}
