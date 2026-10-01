import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { massaLivreDaAvaliacao } from "@/lib/evolution";
import type { AnthropometricAssessment, EnergyCalculation, Patient } from "@/lib/types/database.types";
import { calculateAge } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EnergyCalculationForm, type AvaliacaoParaImportar } from "@/components/patients/energy-calculation-form";

export default async function CalculoEnergeticoPage(props: { params: Promise<{ id: string; calculoId: string }> }) {
  const params = await props.params;
  const supabase = await createClient();

  const [{ data: patient }, { data: calculo }, { data: avaliacoes }] = await Promise.all([
    supabase
      .from("patients")
      .select("id, nome, sexo, data_nascimento")
      .eq("id", params.id)
      .single<Pick<Patient, "id" | "nome" | "sexo" | "data_nascimento">>(),
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
  ]);

  if (!patient || !calculo) notFound();
  const idade = calculateAge(patient.data_nascimento);

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
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-3 mb-2">
          <Link href={`/pacientes/${patient.id}?aba=calculo-energetico`}>
            <ArrowLeft className="h-4 w-4" />
            Voltar para o paciente
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Cálculo energético</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {patient.nome}
          {idade !== null && ` · ${idade} anos`}
        </p>
      </div>

      <EnergyCalculationForm key={calculo.id} patient={patient} calculo={calculo} avaliacoes={paraImportar} />
    </div>
  );
}
