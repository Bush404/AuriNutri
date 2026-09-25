"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Copy, Download, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { MealPlan, PlanShareToken } from "@/lib/types/database.types";
import { mealPlanSchema, type MealPlanInput } from "@/lib/validations/meal-plan";
import { updateMealPlan, deleteMealPlan, duplicateMealPlan, toggleMealPlanStatus } from "@/lib/actions/meal-plans";
import { formatDate } from "@/lib/utils";
import { SharePlanDialog } from "@/components/meal-plans/share-plan-dialog";

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
  patientTelefone: string | null;
  shareLinks: PlanShareToken[];
}

export function MealPlanHeader({ plan, patientId, patientName, patientTelefone, shareLinks }: MealPlanHeaderProps) {
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
      meta_kcal: plan.meta_kcal ?? undefined,
      meta_proteinas_g: plan.meta_proteinas_g ?? undefined,
      meta_carboidratos_g: plan.meta_carboidratos_g ?? undefined,
      meta_gorduras_g: plan.meta_gorduras_g ?? undefined,
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
      router.push(`/pacientes/${patientId}?aba=planos`);
    });
  }

  function handleDuplicate() {
    startTransition(async () => {
      const result = await duplicateMealPlan(plan.id);
      // Em caso de sucesso, a Server Action já faz o redirect() para o novo
      // plano, então só chegamos aqui se houver erro.
      if (result && !result.success) {
        toast.error("Não foi possível duplicar", { description: result.message });
      }
    });
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild className="-ml-3">
        <Link href={`/pacientes/${patientId}?aba=planos`}>
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

        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={`/planos/${plan.id}/pdf`}>
              <Download className="h-4 w-4" />
              Baixar PDF
            </a>
          </Button>

          <SharePlanDialog
            planId={plan.id}
            planNome={plan.nome}
            patientNome={patientName}
            patientTelefone={patientTelefone}
            shareLinks={shareLinks}
          />

          <Button variant="outline" size="sm" onClick={handleDuplicate} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
            Duplicar
          </Button>

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
                  <Input id="nome" aria-required="true" {...register("nome")} />
                  {errors.nome && <p className="text-xs text-destructive" role="alert">{errors.nome.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="data_inicio">Data de início</Label>
                  <Input id="data_inicio" type="date" aria-required="true" {...register("data_inicio")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea id="observacoes" rows={3} {...register("observacoes")} />
                </div>

                <div className="space-y-2 border-t border-border pt-4">
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Metas nutricionais diárias (opcional)
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="meta_kcal" className="text-xs font-normal">
                        Calorias (kcal)
                      </Label>
                      <Input id="meta_kcal" type="number" step="1" {...register("meta_kcal")} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="meta_proteinas_g" className="text-xs font-normal">
                        Proteínas (g)
                      </Label>
                      <Input id="meta_proteinas_g" type="number" step="0.1" {...register("meta_proteinas_g")} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="meta_carboidratos_g" className="text-xs font-normal">
                        Carboidratos (g)
                      </Label>
                      <Input id="meta_carboidratos_g" type="number" step="0.1" {...register("meta_carboidratos_g")} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="meta_gorduras_g" className="text-xs font-normal">
                        Gorduras (g)
                      </Label>
                      <Input id="meta_gorduras_g" type="number" step="0.1" {...register("meta_gorduras_g")} />
                    </div>
                  </div>
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
