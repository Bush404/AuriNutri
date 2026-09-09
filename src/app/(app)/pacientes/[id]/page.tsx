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
} from "@/lib/types/database.types";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PatientTabs } from "@/components/patients/patient-tabs";

export default async function PacienteDetalhePage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [{ data: patient }, { data: anamnesis }, { data: assessments }, { data: mealPlans }] =
    await Promise.all([
      supabase.from("patients").select("*").eq("id", params.id).single<Patient>(),
      supabase.from("anamnesis").select("*").eq("patient_id", params.id).maybeSingle<Anamnesis>(),
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

        <Button variant="outline" asChild>
          <Link href={`/pacientes/${patient.id}/editar`}>
            <Pencil className="h-4 w-4" />
            Editar dados
          </Link>
        </Button>
      </div>

      <PatientTabs
        patient={patient}
        anamnesis={anamnesis ?? null}
        assessments={assessments ?? []}
        mealPlans={mealPlans ?? []}
      />
    </div>
  );
}
