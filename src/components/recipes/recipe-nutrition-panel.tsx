"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, X } from "lucide-react";
import { toast } from "sonner";

import type { RecipeIngredient } from "@/lib/types/database.types";
import {
  calculateRecipePer100g,
  calculateRecipePerPortion,
  calculateRecipeTotals,
  type MacroTotals,
  type RecipeTotals,
} from "@/lib/nutrition";
import { MICRONUTRIENTE_GRUPOS, MICRONUTRIENTE_LABELS } from "@/lib/validations/food";
import { setRecipeValorSobrescrito, clearRecipeValorSobrescrito } from "@/lib/actions/recipes";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

type View = "total" | "porcao" | "100g";

const VIEW_LABELS: Record<View, string> = {
  total: "Total da receita",
  porcao: "Por porção",
  "100g": "Por 100g",
};

const MACRO_FIELDS: { key: keyof MacroTotals; label: string; unit: string }[] = [
  { key: "calorias", label: "Calorias", unit: " kcal" },
  { key: "proteinas", label: "Proteínas", unit: "g" },
  { key: "carboidratos", label: "Carboidratos", unit: "g" },
  { key: "gorduras", label: "Gorduras", unit: "g" },
  { key: "fibras", label: "Fibras", unit: "g" },
];

interface RecipeNutritionPanelProps {
  recipeId: string;
  ingredients: RecipeIngredient[];
  rendimentoG: number | null;
  numeroPorcoes: number | null;
  valoresSobrescritos: Partial<Record<string, number>>;
}

export function RecipeNutritionPanel({
  recipeId,
  ingredients,
  rendimentoG,
  numeroPorcoes,
  valoresSobrescritos,
}: RecipeNutritionPanelProps) {
  const totals: Record<View, RecipeTotals> = {
    total: calculateRecipeTotals(ingredients),
    porcao: calculateRecipePerPortion(ingredients, numeroPorcoes ?? 0),
    "100g": calculateRecipePer100g(ingredients, rendimentoG ?? 0),
  };

  return (
    <Tabs defaultValue="total">
      <TabsList>
        {(Object.keys(VIEW_LABELS) as View[]).map((view) => (
          <TabsTrigger key={view} value={view}>
            {VIEW_LABELS[view]}
          </TabsTrigger>
        ))}
      </TabsList>

      {(Object.keys(VIEW_LABELS) as View[]).map((view) => (
        <TabsContent key={view} value={view} className="space-y-4">
          <div className="rounded-md border border-border p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Macronutrientes
            </p>
            <div className="divide-y divide-border">
              {MACRO_FIELDS.map((campo) => (
                <OverridableValue
                  key={campo.key}
                  recipeId={recipeId}
                  campoKey={`${view}.${campo.key}`}
                  label={campo.label}
                  unidade={campo.unit}
                  valorCalculado={totals[view].macros[campo.key]}
                  valorSobrescrito={valoresSobrescritos[`${view}.${campo.key}`]}
                />
              ))}
            </div>
          </div>

          <Accordion type="multiple" className="rounded-md border border-border px-3">
            {Object.entries(MICRONUTRIENTE_GRUPOS).map(([grupo, chaves]) => (
              <AccordionItem key={grupo} value={grupo}>
                <AccordionTrigger>{grupo}</AccordionTrigger>
                <AccordionContent>
                  <div className="divide-y divide-border">
                    {chaves.map((chave) => {
                      const meta = MICRONUTRIENTE_LABELS[chave];
                      const agregado = totals[view].micros[chave];
                      return (
                        <OverridableValue
                          key={chave}
                          recipeId={recipeId}
                          campoKey={`${view}.${chave}`}
                          label={meta.label}
                          unidade={meta.unit}
                          valorCalculado={agregado.valor}
                          valorSobrescrito={valoresSobrescritos[`${view}.${chave}`]}
                          parcial={agregado.parcial}
                          ingredientesSemDado={agregado.ingredientesSemDado}
                        />
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </TabsContent>
      ))}
    </Tabs>
  );
}

interface OverridableValueProps {
  recipeId: string;
  campoKey: string;
  label: string;
  unidade: string;
  valorCalculado: number;
  valorSobrescrito: number | undefined;
  parcial?: boolean;
  ingredientesSemDado?: number;
}

/**
 * Uma linha de valor (macro ou micro) que pode ser sobrescrita manualmente.
 * O calculado nunca é perdido — sobrescrever só grava em
 * `valores_sobrescritos`; "limpar" volta a aceitar o calculado.
 */
function OverridableValue({
  recipeId,
  campoKey,
  label,
  unidade,
  valorCalculado,
  valorSobrescrito,
  parcial,
  ingredientesSemDado,
}: OverridableValueProps) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(String(valorSobrescrito ?? valorCalculado.toFixed(2)));
  const [isPending, startTransition] = useTransition();

  const temOverride = valorSobrescrito !== undefined;
  const valorExibido = temOverride ? valorSobrescrito : valorCalculado;

  function handleSave() {
    const numero = Number(inputValue.replace(",", "."));
    if (Number.isNaN(numero)) {
      toast.error("Valor inválido.");
      return;
    }
    startTransition(async () => {
      const result = await setRecipeValorSobrescrito(recipeId, { [campoKey]: numero });
      if (!result.success) {
        toast.error("Não foi possível salvar o valor", { description: result.message });
        return;
      }
      setEditing(false);
    });
  }

  function handleClear() {
    startTransition(async () => {
      const result = await clearRecipeValorSobrescrito(recipeId, campoKey);
      if (!result.success) {
        toast.error("Não foi possível remover o valor manual", { description: result.message });
      }
    });
  }

  if (editing) {
    return (
      <div className="flex items-center justify-between gap-2 py-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="flex items-center gap-1">
          <Input
            className="h-7 w-24 text-right"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isPending}
            autoFocus
          />
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={handleSave} disabled={isPending}>
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setEditing(false)}
            disabled={isPending}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium text-foreground">
          {parcial && !temOverride && "≥ "}
          {valorExibido.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
          {unidade}
        </span>
        {parcial && !temOverride && (
          <Badge
            variant="warning"
            className="text-[10px]"
            title={`${ingredientesSemDado} ingrediente(s) sem esse dado — total incompleto`}
          >
            parcial
          </Badge>
        )}
        {temOverride && (
          <Badge variant="outline" className="text-[10px]" title="Valor informado manualmente pelo profissional">
            manual
          </Badge>
        )}
        <button
          type="button"
          onClick={() => {
            setInputValue(String(valorSobrescrito ?? valorCalculado.toFixed(2)));
            setEditing(true);
          }}
          className="text-muted-foreground hover:text-foreground"
          aria-label={`Editar ${label}`}
        >
          <Pencil className="h-3 w-3" />
        </button>
        {temOverride && (
          <button
            type="button"
            onClick={handleClear}
            className="text-muted-foreground hover:text-foreground"
            aria-label={`Remover valor manual de ${label}`}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}
