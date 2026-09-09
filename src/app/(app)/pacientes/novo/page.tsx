import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PatientForm } from "@/components/patients/patient-form";

export default function NovoPacientePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-3 mb-2">
          <Link href="/pacientes">
            <ArrowLeft className="h-4 w-4" />
            Voltar para pacientes
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Novo paciente</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Preencha os dados abaixo para cadastrar um novo paciente.
        </p>
      </div>

      <PatientForm />
    </div>
  );
}
