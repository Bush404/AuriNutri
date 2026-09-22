"use client";

import { useId, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { patientSchema, type PatientInput } from "@/lib/validations/patient";
import { createPatient, updatePatient } from "@/lib/actions/patients";
import type { Patient } from "@/lib/types/database.types";
import { useUnsavedChangesWarning } from "@/lib/hooks/use-unsaved-changes-warning";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PatientFormProps {
  patient?: Patient;
}

export function PatientForm({ patient }: PatientFormProps) {
  const [loading, setLoading] = useState(false);
  const sexoLabelId = useId();
  const isEditing = Boolean(patient);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isDirty },
  } = useForm<PatientInput>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      nome: patient?.nome ?? "",
      email: patient?.email ?? "",
      telefone: patient?.telefone ?? "",
      data_nascimento: patient?.data_nascimento ?? "",
      sexo: patient?.sexo ?? undefined,
      endereco: patient?.endereco ?? "",
      objetivo: patient?.objetivo ?? "",
      observacoes: patient?.observacoes ?? "",
    },
  });

  useUnsavedChangesWarning(isDirty && !loading);

  async function onSubmit(values: PatientInput) {
    setLoading(true);

    const result = isEditing
      ? await updatePatient(patient!.id, values)
      : await createPatient(values);

    // Em caso de sucesso, as actions fazem redirect() (que lança uma exceção
    // interna do Next e nunca chega até aqui). Só tratamos o caminho de erro.
    if (result && !result.success) {
      setLoading(false);
      toast.error("Não foi possível salvar", { description: result.message });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Dados pessoais</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="nome">Nome completo *</Label>
            <Input id="nome" placeholder="Nome do paciente" {...register("nome")} />
            {errors.nome && <p className="text-xs text-destructive" role="alert">{errors.nome.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" placeholder="paciente@exemplo.com" {...register("email")} />
            {errors.email && <p className="text-xs text-destructive" role="alert">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone</Label>
            <Input id="telefone" placeholder="(00) 00000-0000" {...register("telefone")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="data_nascimento">Data de nascimento</Label>
            <Input id="data_nascimento" type="date" {...register("data_nascimento")} />
          </div>

          <div className="space-y-2">
            <Label id={sexoLabelId}>Sexo</Label>
            <Controller
              control={control}
              name="sexo"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger aria-labelledby={sexoLabelId}>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="feminino">Feminino</SelectItem>
                    <SelectItem value="masculino">Masculino</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="endereco">Endereço</Label>
            <Input id="endereco" placeholder="Endereço completo" {...register("endereco")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informações clínicas iniciais</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-5">
          <div className="space-y-2">
            <Label htmlFor="objetivo">Objetivo do paciente</Label>
            <Input id="objetivo" placeholder="Ex: emagrecimento, hipertrofia, reeducação alimentar" {...register("objetivo")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea id="observacoes" placeholder="Anotações gerais sobre o paciente" {...register("observacoes")} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEditing ? "Salvar alterações" : "Cadastrar paciente"}
        </Button>
      </div>
    </form>
  );
}
