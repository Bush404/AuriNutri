"use client";

import { Loader2, Trash2 } from "lucide-react";

import { formatMacro, FONTE_LABELS } from "@/lib/nutrition";
import { useMealItemEditor, type MealItemWithSubstitutions } from "@/components/meal-plans/use-meal-item-editor";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MealItemSubstitutionsDialog } from "@/components/meal-plans/meal-item-substitutions-dialog";

/**
 * Versão em cartão de um item de refeição, usada só no celular (< sm) — ver
 * MealItemRow para a versão em tabela usada em telas maiores. Fase 11,
 * Bloco B: a tabela escondia Proteína/Carboidrato/Gordura no celular
 * exatamente onde o profissional mais precisa de agilidade; o cartão
 * empilha tudo em vez de esconder, sem precisar rolar de lado.
 */
export function MealItemCard({ planId, item }: { planId: string; item: MealItemWithSubstitutions }) {
  const { isReceita, quantidade, setQuantidade, isPending, macros, handleBlur, handleDelete } = useMealItemEditor(
    planId,
    item
  );

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
        <div className="flex items-center gap-1">
          <Input
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            onBlur={handleBlur}
            type="number"
            step={isReceita ? "0.5" : "0.1"}
            className="h-8 w-20"
            disabled={isPending}
          />
          <span className="text-xs text-muted-foreground">{isReceita ? "porção(ões)" : "g"}</span>
        </div>
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
