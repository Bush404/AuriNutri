"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/shared/logo";
import { NAV_ITEMS } from "@/components/layout/nav-items";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-white md:flex">
      <div className="flex h-16 items-center border-b border-border px-6">
        <Logo />
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-4">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          if (item.disabled) {
            return (
              <div
                key={item.href}
                className="flex cursor-not-allowed items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground/60"
                title="Funcionalidade em desenvolvimento"
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-[18px] w-[18px]" />
                  {item.title}
                </span>
                {item.badge && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                    {item.badge}
                  </span>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary-50 text-primary-800"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              {item.title}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-4">
        <p className="text-xs text-muted-foreground">
          AuriNutri &copy; {new Date().getFullYear()}
        </p>
      </div>
    </aside>
  );
}
