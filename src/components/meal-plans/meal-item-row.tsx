"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { MealItem } from "@/lib/types/database.types";
import { calculateMealItemMacros, formatMacro, FONTE_LABELS } from "@/lib/nutrition";
import { updateMealItemQuantity, deleteMealItem } from "@/lib/actions/meal-items";

import { TableCell, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function MealItemRow({ planId, item }: { planId: string; item: MealItem }) {
  const [quantidade, setQuantidade] = useState(String(item.quantidade_g));
  const [isPending, startTransition] = useTransition();

  // O cálculo usa exclusivamente o snapshot gravado no item — nunca o
  // alimento "ao vivo" — para não alterar planos já montados.
  const macros = calculateMealItemMacros({ ...item, quantidade_g: Number(quantidade) || 0 });

  function handleBlur() {
    const parsed = Number(quantidade);
    if (!parsed || parsed <= 0 || parsed === Number(item.quantidade_g)) {
      setQuantidade(String(item.quantidade_g));
      return;
    }
    startTransition(async () => {
      const result = await updateMealItemQuantity(planId, item.id, parsed);
      if (!result.success) {
        toast.error("Não foi possível atualizar", { description: result.message });
        setQuantidade(String(item.quantidade_g));
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
            step="0.1"
            className="h-8 w-20"
            disabled={isPending}
          />
          <span className="text-xs text-muted-foreground">g</span>
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
        <Button variant="ghost" size="icon" onClick={handleDelete} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </TableCell>
    </TableRow>
  );
}
