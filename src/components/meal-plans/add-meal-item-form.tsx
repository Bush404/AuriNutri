"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import type { Food } from "@/lib/types/database.types";
import { addMealItem } from "@/lib/actions/meal-items";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FoodCombobox } from "@/components/meal-plans/food-combobox";

interface AddMealItemFormProps {
  planId: string;
  mealId: string;
  nextOrdem: number;
}

export function AddMealItemForm({ planId, mealId, nextOrdem }: AddMealItemFormProps) {
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [quantidade, setQuantidade] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedFood) {
      setError("Selecione um alimento.");
      return;
    }
    const parsedQuantidade = Number(quantidade);
    if (!parsedQuantidade || parsedQuantidade <= 0) {
      setError("Informe uma quantidade maior que zero.");
      return;
    }

    startTransition(async () => {
      const result = await addMealItem(
        planId,
        mealId,
        { food_id: selectedFood.id, quantidade_g: parsedQuantidade },
        nextOrdem
      );
      if (!result.success) {
        toast.error("Não foi possível adicionar", { description: result.message });
        return;
      }
      setSelectedFood(null);
      setQuantidade("");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
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
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}
