"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import type { Food, Recipe } from "@/lib/types/database.types";
import { addMealItem, addMealItemRecipe } from "@/lib/actions/meal-items";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FoodCombobox } from "@/components/meal-plans/food-combobox";
import { RecipeCombobox } from "@/components/meal-plans/recipe-combobox";

interface AddMealItemFormProps {
  planId: string;
  mealId: string;
  nextOrdem: number;
}

export function AddMealItemForm({ planId, mealId, nextOrdem }: AddMealItemFormProps) {
  return (
    <Tabs defaultValue="alimento">
      <TabsList>
        <TabsTrigger value="alimento">Alimento</TabsTrigger>
        <TabsTrigger value="receita">Receita</TabsTrigger>
      </TabsList>
      <TabsContent value="alimento">
        <AddFoodItemForm planId={planId} mealId={mealId} nextOrdem={nextOrdem} />
      </TabsContent>
      <TabsContent value="receita">
        <AddRecipeItemForm planId={planId} mealId={mealId} nextOrdem={nextOrdem} />
      </TabsContent>
    </Tabs>
  );
}

function AddFoodItemForm({ planId, mealId, nextOrdem }: AddMealItemFormProps) {
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
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
    </form>
  );
}

function AddRecipeItemForm({ planId, mealId, nextOrdem }: AddMealItemFormProps) {
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [porcoes, setPorcoes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedRecipe) {
      setError("Selecione uma receita.");
      return;
    }
    const parsedPorcoes = Number(porcoes);
    if (!parsedPorcoes || parsedPorcoes <= 0) {
      setError("Informe uma quantidade de porções maior que zero.");
      return;
    }

    startTransition(async () => {
      const result = await addMealItemRecipe(
        planId,
        mealId,
        { recipe_id: selectedRecipe.id, quantidade_porcoes: parsedPorcoes },
        nextOrdem
      );
      if (!result.success) {
        toast.error("Não foi possível adicionar", { description: result.message });
        return;
      }
      setSelectedRecipe(null);
      setPorcoes("");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="flex-1">
          <RecipeCombobox value={selectedRecipe} onChange={setSelectedRecipe} disabled={isPending} />
        </div>

        <div className="w-full sm:w-32">
          <Input
            type="number"
            step="0.5"
            placeholder="Qtd. (porções)"
            value={porcoes}
            onChange={(e) => setPorcoes(e.target.value)}
            disabled={isPending}
          />
        </div>

        <Button type="submit" disabled={isPending} className="shrink-0">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Adicionar
        </Button>
      </div>
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
    </form>
  );
}
