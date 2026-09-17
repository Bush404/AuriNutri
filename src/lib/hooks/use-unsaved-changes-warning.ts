"use client";

import { useEffect, useRef } from "react";

const DEFAULT_MESSAGE = "Você tem alterações não salvas nesse formulário. Deseja sair mesmo assim?";

/**
 * Avisa antes de sair de um formulário com alterações não salvas.
 * Cobre dois casos:
 *   - beforeunload: fechar a aba, atualizar a página, digitar outra URL.
 *   - clique em qualquer link interno (Sidebar, Topbar, "Voltar", etc.):
 *     intercepta na fase de captura do clique, antes do <Link> do Next.js
 *     processar a navegação, e mostra um confirm().
 *
 * NÃO cobre o botão voltar/avançar do navegador (popstate) — o Next.js App
 * Router não expõe um evento de "vou navegar" para isso sem hacks de
 * histórico mais frágeis; fora de escopo por ora.
 */
export function useUnsavedChangesWarning(isDirty: boolean, message: string = DEFAULT_MESSAGE) {
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!isDirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    }

    function handleClick(event: MouseEvent) {
      if (!isDirtyRef.current) return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor) return;

      // Não intercepta links externos, downloads ou âncoras na mesma página.
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      const confirmed = window.confirm(message);
      if (!confirmed) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleClick, true);
    };
  }, [message]);
}
