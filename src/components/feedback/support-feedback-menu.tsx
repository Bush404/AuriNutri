"use client";

import { HelpCircle, LifeBuoy, MessageSquare } from "lucide-react";

import { FeedbackDialog } from "@/components/feedback/feedback-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Ícone próprio na topbar, à esquerda do bloco de conta — pedido do usuário
 * por visibilidade: feedback é algo que queremos incentivar a usar, não uma
 * configuração de conta pra esconder atrás de "Editar perfil". "Suporte"
 * ainda não existe (fase futura) — fica visível e desabilitado, mesmo
 * padrão já usado nos itens "em desenvolvimento" da barra lateral
 * (sidebar.tsx), pra comunicar que vai existir sem prometer uma função que
 * ainda não roda.
 */
export function SupportFeedbackMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" title="Suporte e feedback">
          <HelpCircle className="h-5 w-5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem disabled title="Funcionalidade em desenvolvimento">
          <LifeBuoy className="h-4 w-4" />
          Suporte
          <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
            Em breve
          </span>
        </DropdownMenuItem>
        <FeedbackDialog
          trigger={
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <MessageSquare className="h-4 w-4" />
              Feedback
            </DropdownMenuItem>
          }
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
