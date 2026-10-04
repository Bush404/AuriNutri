"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, FileText, Loader2, MoreHorizontal, Pencil, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { MealPlan, PlanShareToken, Sexo } from "@/lib/types/database.types";
import { mealPlanSchema, type MealPlanInput } from "@/lib/validations/meal-plan";
import { updateMealPlan, deleteMealPlan, duplicateMealPlan, toggleMealPlanStatus } from "@/lib/actions/meal-plans";
import { cn, formatDate } from "@/lib/utils";
import { SharePlanDialog } from "@/components/meal-plans/share-plan-dialog";
import { PdfOptionsDialog } from "@/components/meal-plans/pdf-options-dialog";
import { ShoppingListDialog } from "@/components/meal-plans/shopping-list-dialog";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const fmt = (v: number, casas = 0) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

interface MealPlanActionsProps {
  plan: MealPlan;
  patientId: string;
  patientName: string;
  patientTelefone: string | null;
  /** Para a opção gestante/lactante do relatório de nutrientes do PDF. */
  patientSexo: Sexo | null;
  shareLinks: PlanShareToken[];
}

export function MealPlanActions({
  plan,
  patientId,
  patientName,
  patientTelefone,
  patientSexo,
  shareLinks,
}: MealPlanActionsProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
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
    <>
      {/* Consulta rápida da anamnese sem sair do plano (Fase 17, 3.6): abre numa aba nova. */}
      <Button variant="outline" size="sm" asChild>
        <a href={`/pacientes/${patientId}?aba=anamnese`} target="_blank" rel="noopener noreferrer">
          <FileText className="h-4 w-4" />
          Ver anamnese
        </a>
      </Button>

      <PdfOptionsDialog planId={plan.id} sexo={patientSexo} />
      <ShoppingListDialog planId={plan.id} />

      <SharePlanDialog
        planId={plan.id}
        planNome={plan.nome}
        patientNome={patientName}
        patientTelefone={patientTelefone}
        shareLinks={shareLinks}
      />

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
              {errors.nome && (
                <p className="text-xs text-destructive" role="alert">
                  {errors.nome.message}
                </p>
              )}
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

      {/* Ações menos usadas no "...": duplicar, ativar/desativar e excluir. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="w-9 px-0" aria-label="Mais ações do plano" title="Mais ações">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={handleDuplicate} disabled={isPending}>
            <Copy className="h-4 w-4" />
            Duplicar
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleToggleStatus} disabled={isPending}>
            <Power className="h-4 w-4" />
            {plan.ativo ? "Marcar como inativo" : "Marcar como ativo"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setDeleteOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir plano alimentar</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{plan.nome}</strong>? Todas as refeições e itens cadastrados
              neste plano serão excluídos permanentemente.
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
    </>
  );
}

/**
 * Título do plano (Fase 19): nome, kcal em destaque, kcal/kg, início e o
 * status (clicar alterna ativo/inativo, como antes). Observações logo abaixo.
 */
export function MealPlanTitle({
  plan,
  kcal,
  porKg,
}: {
  plan: MealPlan;
  kcal: number;
  porKg: number | null;
}) {
  const [isPending, startTransition] = useTransition();

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

  return (
    <div className="min-w-0">
      <h2 className="break-words text-2xl font-bold tracking-tight text-foreground">{plan.nome}</h2>
      <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-muted-foreground">
        <span className="text-base font-semibold tabular-nums text-primary">{fmt(Math.round(kcal))} kcal</span>
        {porKg !== null && (
          <>
            <span aria-hidden>•</span>
            <span className="tabular-nums">{fmt(porKg, 1)} kcal/kg</span>
          </>
        )}
        <span aria-hidden>•</span>
        <span>Início em {formatDate(plan.data_inicio)}</span>
        <Badge
          variant={plan.ativo ? "success" : "outline"}
          role="switch"
          aria-checked={plan.ativo}
          aria-label={`Plano ${plan.ativo ? "ativo" : "inativo"} (clique para alternar)`}
          tabIndex={0}
          className={cn("ml-1 cursor-pointer select-none gap-1.5 rounded-full px-3 py-1", isPending && "opacity-60")}
          onClick={handleToggleStatus}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleToggleStatus();
            }
          }}
        >
          <span
            aria-hidden
            className={cn("h-2 w-2 rounded-full", plan.ativo ? "bg-success" : "bg-muted-foreground/50")}
          />
          {plan.ativo ? "Ativo" : "Inativo"}
        </Badge>
      </div>
      {plan.observacoes && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{plan.observacoes}</p>}
    </div>
  );
}
