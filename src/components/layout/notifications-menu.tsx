"use client";

import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Sino de notificações — ainda sem notificações (Fase 19 só reserva o lugar).
 * Mesmo padrão "Em breve" do menu de suporte: mostra que vai existir sem
 * prometer uma função que não roda, e sem bolinha de "não lida".
 */
export function NotificationsMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" title="Notificações">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <span className="sr-only">Notificações</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Notificações</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled title="Funcionalidade em desenvolvimento">
          <span className="text-muted-foreground">Avisos de tarefas e pagamentos</span>
          <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
            Em breve
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
