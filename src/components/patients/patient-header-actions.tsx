import Link from "next/link";
import { Pencil } from "lucide-react";

import type { Patient } from "@/lib/types/database.types";
import type { SendCenterContext } from "@/lib/actions/patient-send";

import { Button } from "@/components/ui/button";
import { ExportPatientButton } from "@/components/patients/export-patient-button";
import { PatientSendDialog } from "@/components/patients/patient-send-dialog";

const CONTEXTO_VAZIO: SendCenterContext = {
  profissionalNome: "",
  planoAtivo: null,
  planoShareLinks: [],
  avaliacoes: [],
  proximaConsulta: null,
  pagamentosRecebidos: [],
};

/** Ações do cabeçalho do paciente (Enviar, Exportar dados, Editar dados) — ficha e telas dentro dela. */
export function PatientHeaderActions({
  patient,
  sendCenterContext,
}: {
  patient: Pick<Patient, "id" | "nome" | "telefone">;
  sendCenterContext: SendCenterContext | null;
}) {
  return (
    <>
      <PatientSendDialog
        patientId={patient.id}
        patientNome={patient.nome}
        patientTelefone={patient.telefone}
        context={sendCenterContext ?? CONTEXTO_VAZIO}
      />
      <ExportPatientButton patientId={patient.id} patientName={patient.nome} />
      <Button asChild>
        <Link href={`/pacientes/${patient.id}/editar`}>
          <Pencil className="h-4 w-4" />
          Editar dados
        </Link>
      </Button>
    </>
  );
}
