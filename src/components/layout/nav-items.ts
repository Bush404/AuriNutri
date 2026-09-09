import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Users, Apple, ClipboardList } from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
  badge?: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Pacientes",
    href: "/pacientes",
    icon: Users,
  },
  {
    title: "Meus Alimentos",
    href: "/alimentos",
    icon: Apple,
  },
  {
    title: "Planos Alimentares",
    href: "/planos",
    icon: ClipboardList,
  },
];
