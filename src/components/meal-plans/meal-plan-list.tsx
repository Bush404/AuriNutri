"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, Loader2, MoreHorizontal, Pencil, Plus, Power, PowerOff, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { MealPlan } from "@/lib/types/database.types";
import { deleteMealPlan, toggleMealPlanStatus } from "@/lib/actions/meal-plans";
import { formatDate } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/empty-state";
import { NewMealPlanDialog } from "@/components/meal-plans/new-meal-plan-dialog";

export function MealPlanList({ patientId, mealPlans }: { patientId: string; mealPlans: MealPlan[] }) {
  if (mealPlans.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Nenhum plano alimentar criado ainda"
        description="Monte o primeiro plano alimentar deste paciente, com refeições e cálculo automático de macros."
        action={
          <NewMealPlanDialog
            patientId={patientId}
            trigger={
              <Button size="sm">
                <Plus className="h-4 w-4" />
                Criar plano alimentar
              </Button>
            }
          />
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <NewMealPlanDialog
          patientId={patientId}
          trigger={
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Novo plano
            </Button>
          }
        />
      </div>

      <ul className="space-y-3" aria-label="Planos alimentares">
        {mealPlans.map((plan) => (
          <li key={plan.id}>
            <MealPlanRow patientId={patientId} plan={plan} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function MealPlanRow({ patientId, plan }: { patientId: string; plan: MealPlan }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const href = `/planos/${plan.id}`;

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleMealPlanStatus(plan.id, !plan.ativo, patientId);
      if (!result.success) {
        toast.error("Não foi possível alterar o plano", { description: result.message });
        return;
      }
      toast.success(plan.ativo ? "Plano desativado." : "Plano ativado.");
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteMealPlan(plan.id, patientId);
      if (!result.success) {
        toast.error("Não foi possível excluir o plano", { description: result.message });
        return;
      }
      setConfirmOpen(false);
      toast.success("Plano excluído.");
    });
  }

  return (
    // O card todo abre o plano com o mouse; o link do nome é o caminho pelo teclado.
    <Card className="cursor-pointer transition-shadow hover:shadow-card" onClick={() => router.push(href)}>
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <Link
          href={href}
          onClick={(e) => e.stopPropagation()}
          className="min-w-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex items-center gap-2">
            <p className="truncate font-medium text-foreground">{plan.nome}</p>
            <Badge variant={plan.ativo ? "success" : "outline"}>{plan.ativo ? "Ativo" : "Inativo"}</Badge>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">Início em {formatDate(plan.data_inicio)}</p>
        </Link>

        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" disabled={isPending} aria-label={`Ações de ${plan.nome}`}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => router.push(href)}>
                <Pencil className="h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleToggle}>
                {plan.ativo ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                {plan.ativo ? "Desativar" : "Ativar"}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirmOpen(true)}>
                <Trash2 className="h-4 w-4" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
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
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    handleDelete();
                  }}
                  disabled={isPending}
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
