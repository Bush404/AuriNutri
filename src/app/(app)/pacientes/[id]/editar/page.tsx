import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import type { Patient } from "@/lib/types/database.types";
import { Button } from "@/components/ui/button";
import { PatientForm } from "@/components/patients/patient-form";

export default async function EditarPacientePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const { data: patient } = await supabase.from("patients").select("*").eq("id", params.id).single<Patient>();

  if (!patient) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-3 mb-2">
          <Link href={`/pacientes/${patient.id}`}>
            <ArrowLeft className="h-4 w-4" />
            Voltar para o perfil
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Editar paciente</h1>
        <p className="mt-1 text-sm text-muted-foreground">Atualize os dados de {patient.nome}.</p>
      </div>

      <PatientForm patient={patient} />
    </div>
  );
}
