"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { MealItem, MealItemSubstitution } from "@/lib/types/database.types";
import { calculateMealItemMacros } from "@/lib/nutrition";
import { updateMealItemQuantity, updateMealItemPortions, deleteMealItem } from "@/lib/actions/meal-items";

export interface MealItemWithSubstitutions extends MealItem {
  meal_item_substitutions: MealItemSubstitution[];
}

/**
 * Estado e ações de um item de refeição (quantidade editável, exclusão,
 * cálculo de macros) — extraído de MealItemRow (Fase 11, Bloco B) pra ser
 * reaproveitado também por MealItemCard, a versão em cartão usada no
 * celular. As duas são só apresentações diferentes do mesmo item; a lógica
 * de negócio mora só aqui, uma vez.
 */
export function useMealItemEditor(planId: string, item: MealItemWithSubstitutions) {
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

  return { isReceita, quantidade, setQuantidade, isPending, macros, handleBlur, handleDelete };
}
