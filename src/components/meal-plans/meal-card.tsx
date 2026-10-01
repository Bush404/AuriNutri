"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, Copy, Loader2, Pencil, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { Meal } from "@/lib/types/database.types";
import { calculateMealTotals } from "@/lib/nutrition";
import { COR_MACRO } from "@/lib/macro-colors";
import { deleteMeal, duplicateMeal, updateMeal } from "@/lib/actions/meals";
import { saveMealAsTemplate } from "@/lib/actions/meal-templates";
import {
  mealSchema,
  mealTemplateNameSchema,
  type MealInput,
  type MealTemplateNameInput,
} from "@/lib/validations/meal-plan";
import { cn } from "@/lib/utils";
import { MealItemRow } from "@/components/meal-plans/meal-item-row";
import { MealItemCard } from "@/components/meal-plans/meal-item-card";
import type { MealItemWithSubstitutions } from "@/components/meal-plans/use-meal-item-editor";

import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MealFoodSearch } from "@/components/meal-plans/meal-food-search";
import { MealAnalysis, MealObservations } from "@/components/meal-plans/meal-analysis";

export interface MealWithItemsAndSubstitutions extends Meal {
  items: MealItemWithSubstitutions[];
}

const fmt = (v: number, casas = 1) =>
  v.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });

/**
 * Refeição como uma linha compacta, igual ao WebDiet (Fase 17): horário,
 * nome, proteínas, lipídios, carboidratos e kcal, e os botões abrir, editar,
 * duplicar, favoritar (salvar como refeição favorita) e excluir. Fechada ao
 * abrir o plano; "abrir" mostra os alimentos logo abaixo.
 */
export function MealCard({
  planId,
  meal,
  aberta,
  onAlternar,
  alca,
}: {
  planId: string;
  meal: MealWithItemsAndSubstitutions;
  /** Controlado pela lista (para "expandir tudo"). */
  aberta: boolean;
  onAlternar: () => void;
  /** Alça de arrastar, desenhada no começo da linha. */
  alca?: ReactNode;
}) {
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const totals = calculateMealTotals(meal.items);
  const nextOrdem = meal.items.length;
  const idConteudo = `refeicao-${meal.id}`;

  const editForm = useForm<MealInput>({
    resolver: zodResolver(mealSchema),
    defaultValues: { nome: meal.nome, horario: meal.horario ?? "" },
  });

  const templateForm = useForm<MealTemplateNameInput>({
    resolver: zodResolver(mealTemplateNameSchema),
    defaultValues: { nome: meal.nome },
  });

  function handleDeleteMeal() {
    startTransition(async () => {
      const result = await deleteMeal(planId, meal.id);
      if (!result.success) {
        toast.error("Não foi possível excluir a refeição", {
          description: result.message,
        });
      }
    });
  }

  function handleDuplicate() {
    startTransition(async () => {
      const result = await duplicateMeal(planId, meal.id);
      if (!result.success) {
        toast.error("Não foi possível duplicar a refeição", {
          description: result.message,
        });
        return;
      }
      toast.success("Refeição duplicada.");
    });
  }

  function onEditSubmit(values: MealInput) {
    startTransition(async () => {
      const result = await updateMeal(planId, meal.id, {
        nome: values.nome,
        horario: values.horario,
      });
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
        toast.error("Não foi possível favoritar a refeição", {
          description: result.message,
        });
        return;
      }
      toast.success(result.message ?? "Refeição favoritada.");
      setTemplateOpen(false);
    });
  }

  return (
    <div className="rounded-lg border border-border bg-muted/40">
      <div className="flex flex-wrap items-center gap-2 p-2">
        {alca}
        <span
          className={cn(
            "flex h-8 w-14 items-center justify-center rounded-md border border-border bg-background text-sm tabular-nums",
            !meal.horario && "text-muted-foreground",
          )}
        >
          {meal.horario ? meal.horario.slice(0, 5) : "00:00"}
        </span>
        <span className="flex h-8 min-w-0 flex-1 basis-40 items-center truncate rounded-md border border-border bg-background px-3 text-sm font-medium">
          {meal.nome}
        </span>

        <Chip cor={COR_MACRO.proteinas} rotulo="Proteínas">
          {fmt(totals.proteinas)} g
        </Chip>
        <Chip cor={COR_MACRO.lipidios} rotulo="Lipídios">
          {fmt(totals.gorduras)} g
        </Chip>
        <Chip cor={COR_MACRO.carboidratos} rotulo="Carboidratos">
          {fmt(totals.carboidratos)} g
        </Chip>
        <Chip rotulo="Calorias">{fmt(Math.round(totals.calorias), 0)} kcal</Chip>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            className="h-8"
            aria-expanded={aberta}
            aria-controls={idConteudo}
            onClick={onAlternar}
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", aberta && "rotate-180")} />
            {aberta ? "Fechar" : `Abrir${meal.items.length ? ` (${meal.items.length})` : ""}`}
          </Button>

          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <IconeBotao rotulo="Editar refeição">
                <Pencil className="h-4 w-4" />
              </IconeBotao>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar refeição</DialogTitle>
              </DialogHeader>
              <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`edit_nome_${meal.id}`}>Nome</Label>
                  <Input id={`edit_nome_${meal.id}`} aria-required="true" {...editForm.register("nome")} />
                  {editForm.formState.errors.nome && (
                    <p className="text-xs text-destructive" role="alert">
                      {editForm.formState.errors.nome.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`edit_horario_${meal.id}`}>Horário</Label>
                  <Input id={`edit_horario_${meal.id}`} type="time" {...editForm.register("horario")} />
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

          <IconeBotao rotulo="Duplicar refeição" onClick={handleDuplicate} disabled={isPending}>
            <Copy className="h-4 w-4" />
          </IconeBotao>

          <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
            <DialogTrigger asChild>
              <IconeBotao rotulo="Favoritar refeição" disabled={meal.items.length === 0}>
                <Star className="h-4 w-4" />
              </IconeBotao>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Favoritar refeição</DialogTitle>
              </DialogHeader>
              <form onSubmit={templateForm.handleSubmit(onTemplateSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`template_nome_${meal.id}`}>Nome da refeição favorita</Label>
                  <Input id={`template_nome_${meal.id}`} aria-required="true" {...templateForm.register("nome")} />
                  {templateForm.formState.errors.nome && (
                    <p className="text-xs text-destructive" role="alert">
                      {templateForm.formState.errors.nome.message}
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Salva os {meal.items.length} alimento(s) e quantidades desta refeição para usar em outros planos, em
                  &quot;Refeições favoritas&quot;.
                </p>
                <DialogFooter>
                  <Button type="submit" disabled={isPending}>
                    {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Favoritar
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <IconeBotao rotulo="Excluir refeição" perigo>
                <Trash2 className="h-4 w-4" />
              </IconeBotao>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir refeição</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir <strong>{meal.nome}</strong> e todos os alimentos adicionados a ela?
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
      </div>

      {/* Só monta aberta: cada refeição aberta faz a própria busca de alimentos. */}
      {aberta && (
        <div id={idConteudo} className="space-y-4 border-t border-border bg-background px-3 pb-3 pt-3">
          <MealFoodSearch planId={planId} mealId={meal.id} nextOrdem={nextOrdem} />

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Alimentos prescritos</p>
            {meal.items.length === 0 ? (
              <p className="rounded-md border border-dashed border-border px-3 py-3 text-center text-sm text-muted-foreground">
                Nenhum alimento ainda. Use a busca acima para prescrever.
              </p>
            ) : (
              <>
                {/* Celular (< sm): cartões empilhados, sem esconder nenhum macro — ver MealItemCard. */}
                <div className="space-y-2 sm:hidden">
                  {meal.items.map((item) => (
                    <MealItemCard key={item.id} planId={planId} item={item} />
                  ))}
                </div>

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
          </div>

          <MealAnalysis totais={totals} pesoG={meal.items.reduce((s, i) => s + Number(i.quantidade_g), 0)} />
          <MealObservations planId={planId} mealId={meal.id} inicial={meal.observacoes} />
        </div>
      )}
    </div>
  );
}

function Chip({ cor, rotulo, children }: { cor?: string; rotulo: string; children: ReactNode }) {
  return (
    <span
      className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-sm tabular-nums"
      title={rotulo}
    >
      {cor && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cor }} aria-hidden="true" />}
      <span className="sr-only">{rotulo}: </span>
      {children}
    </span>
  );
}

function IconeBotao({
  rotulo,
  perigo = false,
  className,
  ...props
}: { rotulo: string; perigo?: boolean } & React.ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      aria-label={rotulo}
      title={rotulo}
      className={cn("h-8 w-8", perigo && "hover:bg-destructive hover:text-destructive-foreground", className)}
      {...props}
    />
  );
}
