"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { updateRecipeModoPreparo } from "@/lib/actions/recipes";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface RecipeStepPreparoProps {
  recipeId: string;
  initialValue: string;
  onNext: () => void;
  onBack: () => void;
}

export function RecipeStepPreparo({ recipeId, initialValue, onNext, onBack }: RecipeStepPreparoProps) {
  const [modoPreparo, setModoPreparo] = useState(initialValue);
  const [loading, setLoading] = useState(false);

  async function handleNext() {
    setLoading(true);
    const result = await updateRecipeModoPreparo(recipeId, { modo_preparo: modoPreparo });
    setLoading(false);
    if (!result.success) {
      toast.error("Não foi possível salvar", { description: result.message });
      return;
    }
    onNext();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="modo_preparo">Modo de preparo</Label>
        <Textarea
          id="modo_preparo"
          rows={12}
          placeholder={"1. Tempere o frango...\n2. Aqueça a frigideira...\n3. ..."}
          value={modoPreparo}
          onChange={(e) => setModoPreparo(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">As quebras de linha são preservadas na exibição.</p>
      </div>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack} disabled={loading}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Button type="button" onClick={handleNext} disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Avançar
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
