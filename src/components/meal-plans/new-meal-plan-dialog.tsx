"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { mealPlanSchema, type MealPlanInput } from "@/lib/validations/meal-plan";
import { createMealPlan } from "@/lib/actions/meal-plans";

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

export function NewMealPlanDialog({ patientId, trigger }: { patientId: string; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MealPlanInput>({
    resolver: zodResolver(mealPlanSchema),
    defaultValues: {
      nome: "Plano Alimentar",
      data_inicio: new Date().toISOString().slice(0, 10),
    },
  });

  function onSubmit(values: MealPlanInput) {
    startTransition(async () => {
      const result = await createMealPlan(patientId, values);
      // Em caso de sucesso, a Server Action já faz o redirect() para /planos/[id],
      // então só chegamos aqui se houver erro de validação/permissão.
      if (result && !result.success) {
        toast.error("Não foi possível criar o plano", { description: result.message });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo plano alimentar</DialogTitle>
          <DialogDescription>
            Você poderá adicionar as refeições e os alimentos na tela seguinte.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome do plano</Label>
            <Input id="nome" placeholder="Ex: Plano de emagrecimento" {...register("nome")} />
            {errors.nome && <p className="text-xs text-destructive" role="alert">{errors.nome.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="data_inicio">Data de início</Label>
            <Input id="data_inicio" type="date" {...register("data_inicio")} />
            {errors.data_inicio && <p className="text-xs text-destructive" role="alert">{errors.data_inicio.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações (opcional)</Label>
            <Textarea id="observacoes" rows={3} {...register("observacoes")} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Criar e montar refeições
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
