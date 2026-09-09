"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, LogOut, User as UserIcon } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { getInitials } from "@/lib/utils";

interface TopbarProps {
  userName: string;
  userEmail: string;
}

export function Topbar({ userName, userEmail }: TopbarProps) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-white px-4 md:px-8">
      <div className="flex items-center gap-2">
        <MobileSidebar />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-3 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="hidden text-right sm:block">
            <span className="block text-sm font-medium leading-tight text-foreground">{userName}</span>
            <span className="block text-xs leading-tight text-muted-foreground">{userEmail}</span>
          </span>
          <Avatar>
            <AvatarFallback>{getInitials(userName)}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Minha conta</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>
            <UserIcon className="h-4 w-4" />
            Editar perfil
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/fontes">
              <BookOpen className="h-4 w-4" />
              Fontes de dados
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
            <LogOut className="h-4 w-4" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
