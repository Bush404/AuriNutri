"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { MealPlan } from "@/lib/types/database.types";
import { mealPlanSchema, type MealPlanInput } from "@/lib/validations/meal-plan";
import { updateMealPlan, deleteMealPlan, toggleMealPlanStatus } from "@/lib/actions/meal-plans";
import { formatDate } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface MealPlanHeaderProps {
  plan: MealPlan;
  patientId: string;
  patientName: string;
}

export function MealPlanHeader({ plan, patientId, patientName }: MealPlanHeaderProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MealPlanInput>({
    resolver: zodResolver(mealPlanSchema),
    defaultValues: {
      nome: plan.nome,
      data_inicio: plan.data_inicio,
      observacoes: plan.observacoes ?? "",
    },
  });

  function onSubmit(values: MealPlanInput) {
    startTransition(async () => {
      const result = await updateMealPlan(plan.id, values);
      if (!result.success) {
        toast.error("Não foi possível salvar", { description: result.message });
        return;
      }
      toast.success("Plano atualizado.");
      setEditOpen(false);
    });
  }

  function handleToggleStatus() {
    startTransition(async () => {
      const result = await toggleMealPlanStatus(plan.id, !plan.ativo);
      if (!result?.success) {
        toast.error("Não foi possível atualizar o status");
        return;
      }
      toast.success(plan.ativo ? "Plano marcado como inativo." : "Plano marcado como ativo.");
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteMealPlan(plan.id, patientId);
      if (!result.success) {
        toast.error("Não foi possível excluir", { description: result.message });
        return;
      }
      toast.success("Plano excluído.");
      router.push(`/pacientes/${patientId}`);
    });
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild className="-ml-3">
        <Link href={`/pacientes/${patientId}`}>
          <ArrowLeft className="h-4 w-4" />
          Voltar para {patientName}
        </Link>
      </Button>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{plan.nome}</h1>
            <Badge
              variant={plan.ativo ? "success" : "outline"}
              className="cursor-pointer"
              onClick={handleToggleStatus}
            >
              {plan.ativo ? "Ativo" : "Inativo"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Paciente: <span className="font-medium text-foreground">{patientName}</span> · Início em{" "}
            {formatDate(plan.data_inicio)}
          </p>
          {plan.observacoes && <p className="mt-2 max-w-xl text-sm text-muted-foreground">{plan.observacoes}</p>}
        </div>

        <div className="flex shrink-0 gap-2">
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Pencil className="h-4 w-4" />
                Editar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar plano alimentar</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome do plano</Label>
                  <Input id="nome" {...register("nome")} />
                  {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="data_inicio">Data de início</Label>
                  <Input id="data_inicio" type="date" {...register("data_inicio")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea id="observacoes" rows={3} {...register("observacoes")} />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isPending}>
                    {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Salvar
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
                Excluir
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir plano alimentar</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir <strong>{plan.nome}</strong>? Todas as refeições e itens
                  cadastrados neste plano serão excluídos permanentemente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={isPending}>
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
