"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BookmarkPlus, Clock, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { Meal } from "@/lib/types/database.types";
import { calculateMealTotals, formatMacro } from "@/lib/nutrition";
import { deleteMeal, updateMeal } from "@/lib/actions/meals";
import { saveMealAsTemplate } from "@/lib/actions/meal-templates";
import { mealSchema, mealTemplateNameSchema, type MealInput, type MealTemplateNameInput } from "@/lib/validations/meal-plan";
import { MealItemRow } from "@/components/meal-plans/meal-item-row";
import { MealItemCard } from "@/components/meal-plans/meal-item-card";
import type { MealItemWithSubstitutions } from "@/components/meal-plans/use-meal-item-editor";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AddMealItemForm } from "@/components/meal-plans/add-meal-item-form";

export interface MealWithItemsAndSubstitutions extends Meal {
  items: MealItemWithSubstitutions[];
}

export function MealCard({ planId, meal }: { planId: string; meal: MealWithItemsAndSubstitutions }) {
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const totals = calculateMealTotals(meal.items);
  const nextOrdem = meal.items.length;

  const editForm = useForm<MealInput>({
    resolver: zodResolver(mealSchema),
    defaultValues: { nome: meal.nome, horario: meal.horario ?? "", observacoes: meal.observacoes ?? "" },
  });

  const templateForm = useForm<MealTemplateNameInput>({
    resolver: zodResolver(mealTemplateNameSchema),
    defaultValues: { nome: meal.nome },
  });

  function handleDeleteMeal() {
    startTransition(async () => {
      const result = await deleteMeal(planId, meal.id);
      if (!result.success) {
        toast.error("Não foi possível excluir a refeição", { description: result.message });
      }
    });
  }

  function onEditSubmit(values: MealInput) {
    startTransition(async () => {
      const result = await updateMeal(planId, meal.id, values);
      if (!result.success) {
        toast.error("Não foi possível salvar", { description: result.message });
        return;
      }
      toast.success("Refeição atualizada.");
      setEditOpen(false);
    });
  }

  function onTemplateSubmit(values: MealTemplateNameInput) {
    startTransition(async () => {
      const result = await saveMealAsTemplate(meal.id, values);
      if (!result.success) {
        toast.error("Não foi possível salvar o template", { description: result.message });
        return;
      }
      toast.success(result.message ?? "Template salvo.");
      setTemplateOpen(false);
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
          {meal.observacoes && <p className="mt-1 text-sm text-muted-foreground">{meal.observacoes}</p>}
        </div>

        <div className="flex items-center gap-1">
          <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" title="Salvar como template" disabled={meal.items.length === 0}>
                <BookmarkPlus className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Salvar como template</DialogTitle>
              </DialogHeader>
              <form onSubmit={templateForm.handleSubmit(onTemplateSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="template_nome">Nome do template</Label>
                  <Input id="template_nome" {...templateForm.register("nome")} />
                  {templateForm.formState.errors.nome && (
                    <p className="text-xs text-destructive" role="alert">{templateForm.formState.errors.nome.message}</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Salva os {meal.items.length} alimento(s) e quantidades desta refeição para reutilizar em
                  outros planos. Os valores nutricionais são recalculados a partir do alimento atual sempre
                  que o template for usado.
                </p>
                <DialogFooter>
                  <Button type="submit" disabled={isPending}>
                    {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Salvar template
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" title="Editar refeição">
                <Pencil className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar refeição</DialogTitle>
              </DialogHeader>
              <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_nome">Nome</Label>
                  <Input id="edit_nome" {...editForm.register("nome")} />
                  {editForm.formState.errors.nome && (
                    <p className="text-xs text-destructive" role="alert">{editForm.formState.errors.nome.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_horario">Horário</Label>
                  <Input id="edit_horario" type="time" {...editForm.register("horario")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_observacoes">Observações</Label>
                  <Textarea
                    id="edit_observacoes"
                    rows={3}
                    placeholder="Ex: pode substituir por opções equivalentes, comer com 30min de intervalo do treino..."
                    {...editForm.register("observacoes")}
                  />
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
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {meal.items.length > 0 && (
          <>
            {/* Celular (< sm): cartões empilhados, sem esconder nenhum macro — ver MealItemCard. */}
            <div className="space-y-2 sm:hidden">
              {meal.items.map((item) => (
                <MealItemCard key={item.id} planId={planId} item={item} />
              ))}
            </div>

            {/* sm e acima: tabela, igual sempre foi. */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Alimento</TableHead>
                    <TableHead>Qtd.</TableHead>
                    <TableHead>Kcal</TableHead>
                    <TableHead>Prot.</TableHead>
                    <TableHead>Carb.</TableHead>
                    <TableHead>Gord.</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {meal.items.map((item) => (
                    <MealItemRow key={item.id} planId={planId} item={item} />
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
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
