"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { anamnesisSchema, type AnamnesisInput } from "@/lib/validations/patient";
import { createAnamnesis, updateAnamnesis } from "@/lib/actions/clinical";
import type { Anamnesis } from "@/lib/types/database.types";
import { useUnsavedChangesWarning } from "@/lib/hooks/use-unsaved-changes-warning";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const ANAMNESIS_FIELDS: { name: keyof AnamnesisInput; label: string }[] = [
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

interface AnamnesisFormProps {
  patientId: string;
  /** Presente = editar este registro específico. Ausente = criar um novo. */
  anamnesis?: Anamnesis | null;
  onSaved?: () => void;
  onCancel?: () => void;
}

export function AnamnesisForm({ patientId, anamnesis, onSaved, onCancel }: AnamnesisFormProps) {
  const [loading, setLoading] = useState(false);
  const isEditing = Boolean(anamnesis);

  const {
    register,
    handleSubmit,
    formState: { isDirty },
  } = useForm<AnamnesisInput>({
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

  useUnsavedChangesWarning(isDirty && !loading);

  async function onSubmit(values: AnamnesisInput) {
    setLoading(true);
    const result = isEditing
      ? await updateAnamnesis(anamnesis!.id, patientId, values)
      : await createAnamnesis(patientId, values);
    setLoading(false);

    if (!result.success) {
      toast.error("Não foi possível salvar a anamnese", { description: result.message });
      return;
    }
    toast.success(result.message ?? "Anamnese salva.");
    onSaved?.();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Editar registro de anamnese" : "Nova anamnese"}</CardTitle>
        <CardDescription>
          {isEditing
            ? "Corrige o conteúdo deste registro. A data do registro não muda."
            : "Cria um novo registro no histórico do paciente — não sobrescreve os anteriores."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {ANAMNESIS_FIELDS.map((field) => (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={field.name}>{field.label}</Label>
                <Textarea id={field.name} rows={3} {...register(field.name)} />
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            {onCancel && (
              <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
                Cancelar
              </Button>
            )}
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isEditing ? "Salvar alterações" : "Registrar anamnese"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
