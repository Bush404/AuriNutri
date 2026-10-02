"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_GROUPS } from "@/components/layout/nav-items";

/** Lista de navegação compartilhada pelo menu lateral (computador) e pela gaveta (celular). */
export function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-5">
      {NAV_GROUPS.map((group, i) => (
        <div key={group.label ?? i}>
          {group.label && (
            <p className="mb-1.5 px-3 text-overline uppercase text-muted-foreground">{group.label}</p>
          )}
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;

              if (item.disabled) {
                return (
                  <li key={item.href}>
                    <div
                      className="flex cursor-not-allowed items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-muted-foreground/60"
                      title="Funcionalidade em desenvolvimento"
                    >
                      <span className="flex items-center gap-3">
                        <Icon className="h-[18px] w-[18px]" />
                        {item.title}
                      </span>
                      {item.badge && (
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </li>
                );
              }

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isActive
                        ? "bg-secondary text-primary-800"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className={cn("h-[18px] w-[18px] shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                    {item.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
