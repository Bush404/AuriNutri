"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { Food, RecipeIngredient } from "@/lib/types/database.types";
import { addRecipeIngredient, removeRecipeIngredient, reorderRecipeIngredients } from "@/lib/actions/recipes";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FoodCombobox } from "@/components/meal-plans/food-combobox";

interface RecipeStepIngredientsProps {
  recipeId: string;
  ingredients: RecipeIngredient[];
  onNext: () => void;
  onBack: () => void;
}

export function RecipeStepIngredients({ recipeId, ingredients, onNext, onBack }: RecipeStepIngredientsProps) {
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [quantidade, setQuantidade] = useState("");
  const [isPending, startTransition] = useTransition();

  const ordenados = [...ingredients].sort((a, b) => a.ordem - b.ordem);
  const pesoTotalCru = ordenados.reduce((total, ing) => total + Number(ing.quantidade_g), 0);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFood) {
      toast.error("Selecione um alimento.");
      return;
    }
    const quantidadeNumero = Number(quantidade);
    if (!quantidadeNumero || quantidadeNumero <= 0) {
      toast.error("Informe uma quantidade maior que zero.");
      return;
    }

    startTransition(async () => {
      const result = await addRecipeIngredient(
        recipeId,
        { food_id: selectedFood.id, quantidade_g: quantidadeNumero },
        ordenados.length
      );
      if (!result.success) {
        toast.error("Não foi possível adicionar o ingrediente", { description: result.message });
        return;
      }
      setSelectedFood(null);
      setQuantidade("");
    });
  }

  function handleRemove(ingredientId: string) {
    startTransition(async () => {
      const result = await removeRecipeIngredient(recipeId, ingredientId);
      if (!result.success) {
        toast.error("Não foi possível remover o ingrediente", { description: result.message });
      }
    });
  }

  function handleMove(index: number, direction: -1 | 1) {
    const alvo = index + direction;
    if (alvo < 0 || alvo >= ordenados.length) return;

    const reordenados = [...ordenados];
    [reordenados[index], reordenados[alvo]] = [reordenados[alvo], reordenados[index]];

    startTransition(async () => {
      const result = await reorderRecipeIngredients(
        recipeId,
        reordenados.map((i) => i.id)
      );
      if (!result.success) {
        toast.error("Não foi possível reordenar", { description: result.message });
      }
    });
  }

  function handleNext() {
    if (ordenados.length === 0) {
      toast.error("Adicione pelo menos um ingrediente antes de avançar.");
      return;
    }
    onNext();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="flex-1">
          <FoodCombobox value={selectedFood} onChange={setSelectedFood} disabled={isPending} />
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
        <Button type="submit" disabled={isPending} className="shrink-0">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Adicionar
        </Button>
      </form>

      {ordenados.length === 0 ? (
        <p className="rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          Nenhum ingrediente adicionado ainda.
        </p>
      ) : (
        <div className="divide-y divide-border rounded-md border border-border">
          {ordenados.map((ingrediente, index) => (
            <div key={ingrediente.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-medium text-foreground">{ingrediente.nome_alimento}</span>
                <Badge variant={ingrediente.fonte_alimento === "taco" ? "secondary" : "outline"} className="shrink-0">
                  {ingrediente.fonte_alimento === "taco" ? "TACO" : "Personalizado"}
                </Badge>
                <span className="shrink-0 text-xs text-muted-foreground">{ingrediente.quantidade_g}g</span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={isPending || index === 0}
                  onClick={() => handleMove(index, -1)}
                  aria-label="Mover para cima"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={isPending || index === ordenados.length - 1}
                  onClick={() => handleMove(index, 1)}
                  aria-label="Mover para baixo"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={isPending}
                  onClick={() => handleRemove(ingrediente.id)}
                  aria-label="Remover ingrediente"
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </div>
          ))}
          <div className="flex justify-end px-3 py-2 text-sm">
            <span className="text-muted-foreground">Peso total dos ingredientes crus:&nbsp;</span>
            <span className="font-medium text-foreground">{pesoTotalCru.toLocaleString("pt-BR")}g</span>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Button type="button" onClick={handleNext}>
          Avançar
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
