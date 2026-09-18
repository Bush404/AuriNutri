"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { recipeResultadoSchema, type RecipeResultadoInput } from "@/lib/validations/recipe";
import { updateRecipeResultado } from "@/lib/actions/recipes";
import type { Recipe, RecipeIngredient } from "@/lib/types/database.types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RecipeNutritionPanel } from "@/components/recipes/recipe-nutrition-panel";

interface RecipeStepResultadoProps {
  recipeId: string;
  recipe: Recipe | null;
  ingredients: RecipeIngredient[];
  onBack: () => void;
}

export function RecipeStepResultado({ recipeId, recipe, ingredients, onBack }: RecipeStepResultadoProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RecipeResultadoInput>({
    resolver: zodResolver(recipeResultadoSchema),
    defaultValues: {
      rendimento_g: recipe?.rendimento_g ?? undefined,
      numero_porcoes: recipe?.numero_porcoes ?? undefined,
    },
  });

  const rendimentoAtual = Number(watch("rendimento_g")) || null;
  const porcoesAtual = Number(watch("numero_porcoes")) || null;

  async function onSubmit(values: RecipeResultadoInput) {
    setLoading(true);
    const result = await updateRecipeResultado(recipeId, values);
    setLoading(false);

    if (!result.success) {
      toast.error("Não foi possível concluir a receita", { description: result.message });
      return;
    }

    toast.success(result.message ?? "Receita salva.");
    router.push("/receitas");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="rendimento_g">Peso da preparação pronta (g) *</Label>
          <Input id="rendimento_g" type="number" step="0.1" {...register("rendimento_g")} />
          <p className="text-xs text-muted-foreground">
            Pese a preparação já pronta — o cozimento altera o peso (perda de água ou absorção),
            então não é a soma dos ingredientes crus.
          </p>
          {errors.rendimento_g && <p className="text-xs text-destructive">{errors.rendimento_g.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="numero_porcoes">Número de porções *</Label>
          <Input id="numero_porcoes" type="number" step="1" {...register("numero_porcoes")} />
          {errors.numero_porcoes && <p className="text-xs text-destructive">{errors.numero_porcoes.message}</p>}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-foreground">Valores nutricionais calculados</p>
        <RecipeNutritionPanel
          recipeId={recipeId}
          ingredients={ingredients}
          rendimentoG={rendimentoAtual}
          numeroPorcoes={porcoesAtual}
          valoresSobrescritos={recipe?.valores_sobrescritos ?? {}}
        />
      </div>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack} disabled={loading}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Concluir receita
        </Button>
      </div>
    </form>
  );
}
