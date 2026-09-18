"use client";

import { useState } from "react";
import { Check } from "lucide-react";

import type { Recipe, RecipeIngredient } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";

import { Card, CardContent } from "@/components/ui/card";
import { RecipeStepIdentification } from "@/components/recipes/recipe-step-identification";
import { RecipeStepIngredients } from "@/components/recipes/recipe-step-ingredients";
import { RecipeStepPreparo } from "@/components/recipes/recipe-step-preparo";
import { RecipeStepResultado } from "@/components/recipes/recipe-step-resultado";

const STEP_LABELS = ["Identificação", "Ingredientes", "Modo de preparo", "Resultado"];

interface RecipeWizardProps {
  recipeId: string | null;
  recipe: Recipe | null;
  ingredients: RecipeIngredient[];
  imageSignedUrl: string | null;
  initialStep?: number;
}

/** Wizard de 4 etapas, com navegação e "voltar" — cada etapa salva rascunho ao avançar. */
export function RecipeWizard({ recipeId, recipe, ingredients, imageSignedUrl, initialStep = 1 }: RecipeWizardProps) {
  const [step, setStep] = useState(initialStep);

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {STEP_LABELS.map((label, index) => {
          const numero = index + 1;
          const concluida = recipeId !== null && numero < step;
          const ativa = numero === step;
          return (
            <li key={label} className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  ativa && "bg-primary text-primary-foreground",
                  !ativa && concluida && "bg-primary-100 text-primary-800",
                  !ativa && !concluida && "bg-muted text-muted-foreground"
                )}
              >
                {concluida && !ativa ? <Check className="h-3.5 w-3.5" /> : numero}
              </span>
              <span className={cn("text-sm", ativa ? "font-medium text-foreground" : "text-muted-foreground")}>
                {label}
              </span>
            </li>
          );
        })}
      </ol>

      <Card>
        <CardContent className="p-6">
          {step === 1 && (
            <RecipeStepIdentification
              recipeId={recipeId}
              recipe={recipe}
              imageSignedUrl={imageSignedUrl}
              onSaved={() => setStep(2)}
            />
          )}

          {step === 2 && recipeId && (
            <RecipeStepIngredients
              recipeId={recipeId}
              ingredients={ingredients}
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}

          {step === 3 && recipeId && (
            <RecipeStepPreparo
              recipeId={recipeId}
              initialValue={recipe?.modo_preparo ?? ""}
              onNext={() => setStep(4)}
              onBack={() => setStep(2)}
            />
          )}

          {step === 4 && recipeId && (
            <RecipeStepResultado recipeId={recipeId} recipe={recipe} ingredients={ingredients} onBack={() => setStep(3)} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
