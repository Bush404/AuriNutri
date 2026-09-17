"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { Food, MealItem, MealItemSubstitution } from "@/lib/types/database.types";
import { calculateMealItemMacros, calculateQuantityForTargetCalories, formatMacro, FONTE_LABELS } from "@/lib/nutrition";
import { addMealItemSubstitution, deleteMealItemSubstitution } from "@/lib/actions/meal-item-substitutions";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FoodCombobox } from "@/components/meal-plans/food-combobox";

interface MealItemSubstitutionsDialogProps {
  planId: string;
  item: MealItem;
  substitutions: MealItemSubstitution[];
}

export function MealItemSubstitutionsDialog({ planId, item, substitutions }: MealItemSubstitutionsDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [quantidade, setQuantidade] = useState("");
  const [isPending, startTransition] = useTransition();

  const originalMacros = calculateMealItemMacros(item);

  function handleSelectFood(food: Food | null) {
    setSelectedFood(food);
    if (food) {
      const sugestao = calculateQuantityForTargetCalories(food, originalMacros.calorias);
      setQuantidade(sugestao ? sugestao.toFixed(0) : "");
    } else {
      setQuantidade("");
    }
  }

  function handleAdd() {
    if (!selectedFood) return;
    const parsedQuantidade = Number(quantidade);
    if (!parsedQuantidade || parsedQuantidade <= 0) {
      toast.error("Informe uma quantidade maior que zero.");
      return;
    }
    startTransition(async () => {
      const result = await addMealItemSubstitution(planId, item.id, {
        food_id: selectedFood.id,
        quantidade_g: parsedQuantidade,
      });
      if (!result.success) {
        toast.error("Não foi possível adicionar", { description: result.message });
        return;
      }
      setSelectedFood(null);
      setQuantidade("");
    });
  }

  function handleRemove(substitutionId: string) {
    startTransition(async () => {
      const result = await deleteMealItemSubstitution(planId, substitutionId);
      if (!result.success) {
        toast.error("Não foi possível remover", { description: result.message });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Equivalentes/substituições" className="relative">
          <Repeat className="h-4 w-4 text-muted-foreground" />
          {substitutions.length > 0 && (
            <span className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-primary-600 text-[10px] text-white">
              {substitutions.length}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Equivalentes para {item.nome_alimento}</DialogTitle>
          <DialogDescription>
            Alimentos que o paciente pode usar no lugar deste item, com aporte calórico semelhante (
            {formatMacro(originalMacros.calorias, " kcal")} no item original).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {substitutions.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum equivalente cadastrado ainda.</p>
          )}
          {substitutions.map((sub) => {
            const macros = calculateMealItemMacros(sub);
            return (
              <div
                key={sub.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{sub.nome_alimento}</span>
                  <Badge variant={sub.fonte_alimento === "taco" ? "secondary" : "outline"}>
                    {FONTE_LABELS[sub.fonte_alimento]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {sub.quantidade_g}g · {formatMacro(macros.calorias, " kcal")}
                  </span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleRemove(sub.id)} disabled={isPending}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            );
          })}
        </div>

        <div className="space-y-2 border-t border-border pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Adicionar equivalente</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <div className="flex-1">
              <FoodCombobox value={selectedFood} onChange={handleSelectFood} disabled={isPending} />
            </div>
            <div className="w-full sm:w-32">
              <Input
                type="number"
                step="0.1"
                placeholder="Qtd. (g)"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                disabled={isPending}
              />
            </div>
            <Button type="button" onClick={handleAdd} disabled={isPending || !selectedFood} className="shrink-0">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Adicionar
            </Button>
          </div>
          {selectedFood && (
            <p className="text-xs text-muted-foreground">
              Quantidade sugerida para manter um aporte calórico semelhante ao item original — ajuste se
              quiser.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
