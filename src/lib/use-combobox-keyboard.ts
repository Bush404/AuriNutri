"use client";

import { useEffect, useState, type KeyboardEvent } from "react";

/**
 * Navegação por teclado (setas + Enter + Escape) para os campos de busca
 * "combobox" customizados do projeto (FoodCombobox, RecipeCombobox,
 * PatientCombobox) — nenhum deles usa um primitivo do Radix por baixo (são
 * um <Input> + <div> de resultados feitos à mão), então não ganham de graça
 * o que os Dialogs/Dropdowns do Radix já resolvem. Fase 11, Bloco B.
 *
 * `options` deve ser a lista já achatada (sem agrupamento) — quem agrupa
 * visualmente (ex.: FoodCombobox separa "Meus alimentos"/"Base TACO") só
 * precisa comparar o item atual contra `options[highlightedIndex]` pra saber
 * se deve destacá-lo, sem se preocupar com offset de índice entre grupos.
 */
export function useComboboxKeyboardNav<T>(options: T[], open: boolean, onSelect: (option: T) => void, onClose: () => void) {
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Reabrir ou uma nova busca sempre volta o destaque pro primeiro resultado.
  useEffect(() => {
    setHighlightedIndex(0);
  }, [options, open]);

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open || options.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const highlighted = options[highlightedIndex];
      if (highlighted) {
        e.preventDefault();
        onSelect(highlighted);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  return { highlightedIndex, setHighlightedIndex, onKeyDown };
}
