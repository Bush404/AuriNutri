"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { PatientPickerResult } from "@/lib/actions/patients";
import { PatientCombobox } from "@/components/shared/patient-combobox";

export function PatientFilter({ selected }: { selected: PatientPickerResult | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(patient: PatientPickerResult | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (patient) {
      params.set("paciente", patient.id);
    } else {
      params.delete("paciente");
    }
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="w-full sm:w-64">
      <PatientCombobox value={selected} onChange={handleChange} placeholder="Todos os pacientes" />
    </div>
  );
}
