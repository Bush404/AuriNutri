"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { MealItem, MealItemSubstitution } from "@/lib/types/database.types";
import { calculateMealItemMacros } from "@/lib/nutrition";
import {
  updateMealItemQuantity,
  updateMealItemPortions,
  updateMealItemMedida,
  deleteMealItem,
} from "@/lib/actions/meal-items";
import { useMedidasDoAlimento } from "@/components/meal-plans/medidas-context";

export interface MealItemWithSubstitutions extends MealItem {
  meal_item_substitutions: MealItemSubstitution[];
}

/** Valor do seletor de unidade: gramas, a medida já gravada no item, ou o id de uma medida da lista. */
export const UNIDADE_GRAMAS = "g";
export const UNIDADE_ATUAL = "atual";

/**
 * Estado e ações de um item de refeição (quantidade editável, exclusão,
 * cálculo de macros) — extraído de MealItemRow (Fase 11, Bloco B) pra ser
 * reaproveitado também por MealItemCard, a versão em cartão usada no
 * celular. As duas são só apresentações diferentes do mesmo item; a lógica
 * de negócio mora só aqui, uma vez.
 *
 * Fase 17, Bloco D: um alimento pode estar em gramas ou numa medida caseira
 * ("2 × unidade média"); a quantidade digitada é sempre na unidade escolhida.
 */
export function useMealItemEditor(planId: string, item: MealItemWithSubstitutions) {
  const isReceita = item.recipe_id !== null;
  const medidas = useMedidasDoAlimento(isReceita ? null : item.food_id);

  // A medida gravada no item é cópia; se ainda existe igual na lista, o seletor usa a da lista.
  const daLista = item.medida_nome
    ? medidas.find((m) => m.nome === item.medida_nome && Number(m.gramas) === Number(item.medida_gramas))
    : undefined;
  const unidadeGravada = item.medida_nome ? (daLista?.id ?? UNIDADE_ATUAL) : UNIDADE_GRAMAS;
  const valorGravado = isReceita
    ? (item.quantidade_porcoes ?? 0)
    : item.medida_nome
      ? (item.medida_quantidade ?? 1)
      : item.quantidade_g;

  // Item de receita: o profissional edita em PORÇÕES, não em gramas —
  // quantidade_g continua sendo o que o cálculo usa por baixo, mas quem
  // digita nunca vê gramas para esse tipo de item.
  const [quantidade, setQuantidade] = useState(String(valorGravado));
  const [unidade, setUnidadeLocal] = useState(unidadeGravada);
  // Medida recém-criada no diálogo: ainda não está na lista até a página recarregar.
  const [medidaNova, setMedidaNova] = useState<{ id: string; gramas: number } | null>(null);
  const [isPending, startTransition] = useTransition();

  const gramasPorUnidade = isReceita
    ? Number(item.porcao_referencia_g)
    : unidade === UNIDADE_GRAMAS
      ? 1
      : unidade === UNIDADE_ATUAL
        ? Number(item.medida_gramas)
        : Number(
            medidas.find((m) => m.id === unidade)?.gramas ??
              (medidaNova?.id === unidade ? medidaNova.gramas : (item.medida_gramas ?? 1)),
          );

  // O cálculo usa exclusivamente o snapshot gravado no item — nunca o
  // alimento/receita "ao vivo" — para não alterar planos já montados.
  const gramas = (Number(quantidade) || 0) * gramasPorUnidade;
  const macros = calculateMealItemMacros({ ...item, quantidade_g: gramas });

  function salvar(acao: () => Promise<{ success: boolean; message?: string }>, desfazer: () => void) {
    startTransition(async () => {
      const result = await acao();
      if (!result.success) {
        toast.error("Não foi possível atualizar", { description: result.message });
        desfazer();
      }
    });
  }

  function handleBlur() {
    const parsed = Number(quantidade);
    if (!parsed || parsed <= 0 || parsed === Number(valorGravado)) {
      setQuantidade(String(valorGravado));
      return;
    }
    const desfazer = () => setQuantidade(String(valorGravado));
    if (isReceita) salvar(() => updateMealItemPortions(planId, item.id, parsed, item.porcao_referencia_g), desfazer);
    else if (unidade === UNIDADE_GRAMAS) salvar(() => updateMealItemQuantity(planId, item.id, parsed), desfazer);
    else salvar(() => updateMealItemMedida(planId, item.id, parsed), desfazer);
  }

  /** Troca a unidade: para gramas, mantém o peso atual; para uma medida, começa em 1. */
  function setUnidade(nova: string, gramasDaNova?: number) {
    if (nova === unidade) return;
    if (gramasDaNova) setMedidaNova({ id: nova, gramas: gramasDaNova });
    const desfazer = () => {
      setUnidadeLocal(unidadeGravada);
      setQuantidade(String(valorGravado));
    };
    setUnidadeLocal(nova);
    if (nova === UNIDADE_GRAMAS) {
      const g = Math.round(gramas * 10) / 10;
      setQuantidade(String(g));
      if (g > 0) salvar(() => updateMealItemQuantity(planId, item.id, g), desfazer);
    } else {
      setQuantidade("1");
      salvar(() => updateMealItemMedida(planId, item.id, 1, nova), desfazer);
    }
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteMealItem(planId, item.id);
      if (!result.success) {
        toast.error("Não foi possível remover", { description: result.message });
      }
    });
  }

  return {
    isReceita,
    quantidade,
    setQuantidade,
    unidade,
    setUnidade,
    medidas,
    gramas,
    isPending,
    macros,
    handleBlur,
    handleDelete,
  };
}
