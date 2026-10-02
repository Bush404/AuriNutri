"use client";

import { Loader2, Trash2 } from "lucide-react";

import { formatMacro, FONTE_LABELS } from "@/lib/nutrition";
import { useMealItemEditor, type MealItemWithSubstitutions } from "@/components/meal-plans/use-meal-item-editor";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MealItemSubstitutionsDialog } from "@/components/meal-plans/meal-item-substitutions-dialog";
import { MealItemQuantity } from "@/components/meal-plans/meal-item-quantity";

/**
 * Versão em cartão de um item de refeição, usada só no celular (< sm) — ver
 * MealItemRow para a versão em tabela usada em telas maiores. Fase 11,
 * Bloco B: a tabela escondia Proteína/Carboidrato/Gordura no celular
 * exatamente onde o profissional mais precisa de agilidade; o cartão
 * empilha tudo em vez de esconder, sem precisar rolar de lado.
 */
export function MealItemCard({ planId, item }: { planId: string; item: MealItemWithSubstitutions }) {
  const editor = useMealItemEditor(planId, item);
  const { isPending, macros, handleDelete } = editor;

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-foreground">{item.nome_alimento}</p>
          <Badge variant={item.fonte_alimento === "taco" ? "secondary" : "outline"} className="shrink-0">
            {FONTE_LABELS[item.fonte_alimento]}
          </Badge>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <MealItemQuantity planId={planId} item={item} editor={editor} />
        <span className="text-sm font-medium text-foreground">{formatMacro(macros.calorias, " kcal")}</span>
      </div>

      <p className="text-xs text-muted-foreground">
        Prot {formatMacro(macros.proteinas)} · Carb {formatMacro(macros.carboidratos)} · Gord{" "}
        {formatMacro(macros.gorduras)}
      </p>

      <div className="flex items-center justify-end gap-1">
        <MealItemSubstitutionsDialog planId={planId} item={item} substitutions={item.meal_item_substitutions} />
        <Button variant="ghost" size="icon" onClick={handleDelete} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
