"use client";

import { Loader2, Trash2 } from "lucide-react";

import { formatMacro, FONTE_LABELS } from "@/lib/nutrition";
import { useMealItemEditor, type MealItemWithSubstitutions } from "@/components/meal-plans/use-meal-item-editor";

import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MealItemSubstitutionsDialog } from "@/components/meal-plans/meal-item-substitutions-dialog";
import { MealItemQuantity } from "@/components/meal-plans/meal-item-quantity";

export type { MealItemWithSubstitutions };

/** Linha da tabela — usada em telas sm+ (ver MealItemCard para o equivalente em cartão, usado no celular). */
export function MealItemRow({ planId, item }: { planId: string; item: MealItemWithSubstitutions }) {
  const editor = useMealItemEditor(planId, item);
  const { isPending, macros, handleDelete } = editor;

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
      <TableCell>
        <MealItemQuantity planId={planId} item={item} editor={editor} />
      </TableCell>
      <TableCell className="text-sm">{formatMacro(macros.calorias, " kcal")}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{formatMacro(macros.proteinas)}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{formatMacro(macros.carboidratos)}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{formatMacro(macros.gorduras)}</TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <MealItemSubstitutionsDialog planId={planId} item={item} substitutions={item.meal_item_substitutions} />
          <Button variant="ghost" size="icon" onClick={handleDelete} disabled={isPending} aria-label={`Remover ${item.nome_alimento}`}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
