"use client";

import { useTransition } from "react";
import { Clock, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { MealWithItems } from "@/lib/nutrition";
import { calculateMealTotals, formatMacro } from "@/lib/nutrition";
import { deleteMeal } from "@/lib/actions/meals";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
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
import { MealItemRow } from "@/components/meal-plans/meal-item-row";
import { AddMealItemForm } from "@/components/meal-plans/add-meal-item-form";

export function MealCard({ planId, meal }: { planId: string; meal: MealWithItems }) {
  const [isPending, startTransition] = useTransition();
  const totals = calculateMealTotals(meal.items);
  const nextOrdem = meal.items.length;

  function handleDeleteMeal() {
    startTransition(async () => {
      const result = await deleteMeal(planId, meal.id);
      if (!result.success) {
        toast.error("Não foi possível excluir a refeição", { description: result.message });
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            {meal.nome}
            {meal.horario && (
              <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {meal.horario.slice(0, 5)}
              </span>
            )}
          </CardTitle>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir refeição</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir <strong>{meal.nome}</strong> e todos os alimentos
                adicionados a ela?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteMeal} disabled={isPending}>
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardHeader>

      <CardContent className="space-y-4">
        {meal.items.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Alimento</TableHead>
                <TableHead>Qtd.</TableHead>
                <TableHead>Kcal</TableHead>
                <TableHead className="hidden sm:table-cell">Prot.</TableHead>
                <TableHead className="hidden sm:table-cell">Carb.</TableHead>
                <TableHead className="hidden sm:table-cell">Gord.</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {meal.items.map((item) => (
                <MealItemRow key={item.id} planId={planId} item={item} />
              ))}
            </TableBody>
          </Table>
        )}

        <AddMealItemForm planId={planId} mealId={meal.id} nextOrdem={nextOrdem} />

        {meal.items.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg bg-muted/50 px-4 py-3 text-sm">
            <span className="font-medium text-foreground">Total da refeição:</span>
            <span>{formatMacro(totals.calorias, " kcal")}</span>
            <span className="text-muted-foreground">Prot. {formatMacro(totals.proteinas)}</span>
            <span className="text-muted-foreground">Carb. {formatMacro(totals.carboidratos)}</span>
            <span className="text-muted-foreground">Gord. {formatMacro(totals.gorduras)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
