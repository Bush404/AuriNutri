"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { anamnesisSchema, type AnamnesisInput } from "@/lib/validations/patient";
import { upsertAnamnesis } from "@/lib/actions/clinical";
import type { Anamnesis } from "@/lib/types/database.types";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const FIELDS: { name: keyof AnamnesisInput; label: string; placeholder?: string }[] = [
  { name: "queixa_principal", label: "Queixa principal" },
  { name: "historico_saude", label: "Histórico de saúde" },
  { name: "historico_familiar", label: "Histórico familiar" },
  { name: "habitos_alimentares", label: "Hábitos alimentares" },
  { name: "atividade_fisica", label: "Atividade física" },
  { name: "qualidade_sono", label: "Qualidade do sono" },
  { name: "alergias", label: "Alergias" },
  { name: "intolerancias", label: "Intolerâncias" },
  { name: "medicamentos", label: "Medicamentos em uso" },
  { name: "suplementos", label: "Suplementos em uso" },
  { name: "observacoes", label: "Observações gerais" },
];

export function AnamnesisForm({ patientId, anamnesis }: { patientId: string; anamnesis: Anamnesis | null }) {
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit } = useForm<AnamnesisInput>({
    resolver: zodResolver(anamnesisSchema),
    defaultValues: {
      queixa_principal: anamnesis?.queixa_principal ?? "",
      historico_saude: anamnesis?.historico_saude ?? "",
      historico_familiar: anamnesis?.historico_familiar ?? "",
      habitos_alimentares: anamnesis?.habitos_alimentares ?? "",
      atividade_fisica: anamnesis?.atividade_fisica ?? "",
      qualidade_sono: anamnesis?.qualidade_sono ?? "",
      alergias: anamnesis?.alergias ?? "",
      intolerancias: anamnesis?.intolerancias ?? "",
      medicamentos: anamnesis?.medicamentos ?? "",
      suplementos: anamnesis?.suplementos ?? "",
      observacoes: anamnesis?.observacoes ?? "",
    },
  });

  async function onSubmit(values: AnamnesisInput) {
    setLoading(true);
    const result = await upsertAnamnesis(patientId, values);
    setLoading(false);

    if (!result.success) {
      toast.error("Não foi possível salvar a anamnese", { description: result.message });
      return;
    }
    toast.success(result.message ?? "Anamnese salva.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Anamnese</CardTitle>
        <CardDescription>
          Registre o histórico clínico e comportamental do paciente. Esses dados podem ser
          atualizados a qualquer momento.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {FIELDS.map((field) => (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={field.name}>{field.label}</Label>
                <Textarea id={field.name} rows={3} {...register(field.name)} />
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar anamnese
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
