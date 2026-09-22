"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { assessmentSchema, type AssessmentInput } from "@/lib/validations/patient";
import { createAssessment, updateAssessment } from "@/lib/actions/clinical";
import type { AnthropometricAssessment } from "@/lib/types/database.types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function buildDefaults(assessment?: AnthropometricAssessment): AssessmentInput {
  if (!assessment) {
    return { data_avaliacao: new Date().toISOString().slice(0, 10) } as AssessmentInput;
  }
  return {
    data_avaliacao: assessment.data_avaliacao,
    peso_kg: assessment.peso_kg,
    altura_cm: assessment.altura_cm,
    circunferencia_cintura_cm: assessment.circunferencia_cintura_cm ?? undefined,
    circunferencia_quadril_cm: assessment.circunferencia_quadril_cm ?? undefined,
    circunferencia_braco_cm: assessment.circunferencia_braco_cm ?? undefined,
    circunferencia_coxa_cm: assessment.circunferencia_coxa_cm ?? undefined,
    circunferencia_pescoco_cm: assessment.circunferencia_pescoco_cm ?? undefined,
    percentual_gordura: assessment.percentual_gordura ?? undefined,
    observacoes: assessment.observacoes ?? undefined,
  } as AssessmentInput;
}

interface NewAssessmentDialogProps {
  patientId: string;
  /** Presente = editar esta avaliação específica. Ausente = criar uma nova. */
  assessment?: AnthropometricAssessment;
}

export function NewAssessmentDialog({ patientId, assessment }: NewAssessmentDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEditing = Boolean(assessment);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AssessmentInput>({
    resolver: zodResolver(assessmentSchema),
    defaultValues: buildDefaults(assessment),
  });

  // Reabre sempre com os valores atuais (relevante em modo edição, já que o
  // dialog não desmonta entre aberturas).
  useEffect(() => {
    if (open) reset(buildDefaults(assessment));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onSubmit(values: AssessmentInput) {
    setLoading(true);
    const result = isEditing
      ? await updateAssessment(assessment!.id, patientId, values)
      : await createAssessment(patientId, values);
    setLoading(false);

    if (!result.success) {
      toast.error(`Não foi possível ${isEditing ? "atualizar" : "registrar"} a avaliação`, {
        description: result.message,
      });
      return;
    }

    toast.success(result.message ?? "Avaliação salva.");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEditing ? (
          <Button variant="ghost" size="icon" aria-label="Editar avaliação">
            <Pencil className="h-4 w-4 text-muted-foreground" />
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="h-4 w-4" />
            Nova avaliação
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar avaliação antropométrica" : "Nova avaliação antropométrica"}</DialogTitle>
          <DialogDescription>
            O IMC é calculado automaticamente a partir do peso e da altura informados.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="data_avaliacao">Data da avaliação *</Label>
              <Input id="data_avaliacao" type="date" {...register("data_avaliacao")} />
              {errors.data_avaliacao && (
                <p className="text-xs text-destructive" role="alert">{errors.data_avaliacao.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="peso_kg">Peso (kg) *</Label>
              <Input id="peso_kg" type="number" step="0.1" placeholder="70.5" {...register("peso_kg")} />
              {errors.peso_kg && <p className="text-xs text-destructive" role="alert">{errors.peso_kg.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="altura_cm">Altura (cm) *</Label>
              <Input id="altura_cm" type="number" step="0.1" placeholder="170" {...register("altura_cm")} />
              {errors.altura_cm && <p className="text-xs text-destructive" role="alert">{errors.altura_cm.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="circunferencia_cintura_cm">Cintura (cm)</Label>
              <Input id="circunferencia_cintura_cm" type="number" step="0.1" {...register("circunferencia_cintura_cm")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="circunferencia_quadril_cm">Quadril (cm)</Label>
              <Input id="circunferencia_quadril_cm" type="number" step="0.1" {...register("circunferencia_quadril_cm")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="circunferencia_braco_cm">Braço (cm)</Label>
              <Input id="circunferencia_braco_cm" type="number" step="0.1" {...register("circunferencia_braco_cm")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="circunferencia_coxa_cm">Coxa (cm)</Label>
              <Input id="circunferencia_coxa_cm" type="number" step="0.1" {...register("circunferencia_coxa_cm")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="circunferencia_pescoco_cm">Pescoço (cm)</Label>
              <Input id="circunferencia_pescoco_cm" type="number" step="0.1" {...register("circunferencia_pescoco_cm")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="percentual_gordura">% Gordura</Label>
              <Input id="percentual_gordura" type="number" step="0.1" {...register("percentual_gordura")} />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea id="observacoes" rows={2} {...register("observacoes")} />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? "Salvar alterações" : "Salvar avaliação"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
