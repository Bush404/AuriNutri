"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { MealItem, MealItemSubstitution } from "@/lib/types/database.types";
import { calculateMealItemMacros, formatMacro, FONTE_LABELS } from "@/lib/nutrition";
import { updateMealItemQuantity, updateMealItemPortions, deleteMealItem } from "@/lib/actions/meal-items";

import { TableCell, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MealItemSubstitutionsDialog } from "@/components/meal-plans/meal-item-substitutions-dialog";

export interface MealItemWithSubstitutions extends MealItem {
  meal_item_substitutions: MealItemSubstitution[];
}

export function MealItemRow({ planId, item }: { planId: string; item: MealItemWithSubstitutions }) {
  const isReceita = item.recipe_id !== null;
  // Item de receita: o profissional edita em PORÇÕES, não em gramas —
  // quantidade_g continua sendo o que o cálculo usa por baixo, mas quem
  // digita nunca vê gramas para esse tipo de item.
  const [quantidade, setQuantidade] = useState(String(isReceita ? (item.quantidade_porcoes ?? 0) : item.quantidade_g));
  const [isPending, startTransition] = useTransition();

  // O cálculo usa exclusivamente o snapshot gravado no item — nunca o
  // alimento/receita "ao vivo" — para não alterar planos já montados.
  const quantidadeGramasParaCalculo = isReceita
    ? (Number(quantidade) || 0) * item.porcao_referencia_g
    : Number(quantidade) || 0;
  const macros = calculateMealItemMacros({ ...item, quantidade_g: quantidadeGramasParaCalculo });

  function handleBlur() {
    const parsed = Number(quantidade);
    const valorAtual = isReceita ? (item.quantidade_porcoes ?? 0) : item.quantidade_g;
    if (!parsed || parsed <= 0 || parsed === Number(valorAtual)) {
      setQuantidade(String(valorAtual));
      return;
    }
    startTransition(async () => {
      const result = isReceita
        ? await updateMealItemPortions(planId, item.id, parsed, item.porcao_referencia_g)
        : await updateMealItemQuantity(planId, item.id, parsed);
      if (!result.success) {
        toast.error("Não foi possível atualizar", { description: result.message });
        setQuantidade(String(valorAtual));
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteMealItem(planId, item.id);
      if (!result.success) {
        toast.error("Não foi possível remover", { description: result.message });
      }
    });
  }

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground">{item.nome_alimento}</p>
          <Badge variant={item.fonte_alimento === "taco" ? "secondary" : "outline"} className="shrink-0">
            {FONTE_LABELS[item.fonte_alimento]}
          </Badge>
        </div>
      </TableCell>
      <TableCell className="w-24">
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
      </TableCell>
      <TableCell className="text-sm">{formatMacro(macros.calorias, " kcal")}</TableCell>
      <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
        {formatMacro(macros.proteinas)}
      </TableCell>
      <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
        {formatMacro(macros.carboidratos)}
      </TableCell>
      <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
        {formatMacro(macros.gorduras)}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <MealItemSubstitutionsDialog planId={planId} item={item} substitutions={item.meal_item_substitutions} />
          <Button variant="ghost" size="icon" onClick={handleDelete} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
