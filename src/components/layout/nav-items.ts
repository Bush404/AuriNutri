import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Users, Apple, ClipboardList, CalendarDays, CookingPot, Wallet, BookOpen } from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
  badge?: string;
}

export interface NavGroup {
  /** Sem rótulo no primeiro grupo (Dashboard/Agenda), como no layout de referência. */
  label?: string;
  items: NavItem[];
}

// Menu lateral em grupos (Fase 19). Só a ordem e o agrupamento mudaram: nomes e rotas
// continuam os mesmos.
export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { title: "Agenda", href: "/agenda", icon: CalendarDays },
    ],
  },
  {
    label: "Atendimento",
    items: [
      { title: "Pacientes", href: "/pacientes", icon: Users },
      { title: "Planos Alimentares", href: "/planos", icon: ClipboardList },
      { title: "Receitas", href: "/receitas", icon: CookingPot },
    ],
  },
  {
    label: "Nutrição",
    items: [
      { title: "Meus Alimentos", href: "/alimentos", icon: Apple },
      { title: "Biblioteca", href: "/biblioteca", icon: BookOpen },
    ],
  },
  {
    label: "Gestão",
    items: [{ title: "Financeiro", href: "/financeiro", icon: Wallet }],
  },
];
