"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, LogOut, User as UserIcon } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { Logo } from "@/components/shared/logo";
import { SupportFeedbackMenu } from "@/components/feedback/support-feedback-menu";
import { NotificationsMenu } from "@/components/layout/notifications-menu";
import { getInitials } from "@/lib/utils";

interface TopbarProps {
  userName: string;
  userEmail: string;
  logoUrl: string | null;
  crn: string | null;
  crnUf: string | null;
}

export function Topbar({ userName, userEmail, logoUrl, crn, crnUf }: TopbarProps) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/70 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/40 md:px-8 lg:px-10">
      <div className="flex items-center gap-2">
        <MobileSidebar />
        <Link href="/dashboard" aria-label="AuriNutri — ir para o Dashboard" className="md:hidden">
          <Logo iconOnly />
        </Link>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <NotificationsMenu />
        <SupportFeedbackMenu />

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-3 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="hidden text-right sm:block">
              <span className="block text-sm font-medium leading-tight text-foreground">{userName}</span>
              <span className="block text-xs leading-tight text-muted-foreground">
                {crn ? `CRN ${crn}${crnUf ? `/${crnUf}` : ""}` : userEmail}
              </span>
            </span>
            <Avatar className="h-9 w-9">
              {logoUrl && <AvatarImage src={logoUrl} alt={userName} />}
              <AvatarFallback>{getInitials(userName)}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Minha conta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/perfil">
                <UserIcon className="h-4 w-4" />
                Editar perfil
              </Link>
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
      </div>
    </header>
  );
}
