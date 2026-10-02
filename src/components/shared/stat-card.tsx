import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatTrend {
  /** Texto já formatado, ex.: "+3 este mês" ou "+12% em relação ao mês anterior". */
  text: string;
  direction: "up" | "down" | "flat";
}

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  /** "accent" (laranja) só para o card de dinheiro — destaque pontual. */
  iconTone?: "primary" | "accent";
  href?: string;
  trend?: StatTrend;
  /** Minilinha à direita do rodapé do card. */
  chart?: React.ReactNode;
  valueClassName?: string;
  title?: string;
}

const TREND_STYLE = {
  up: { icon: ArrowUpRight, className: "text-success" },
  down: { icon: ArrowDownRight, className: "text-destructive" },
  flat: { icon: null, className: "text-muted-foreground" },
} as const;

/** Card de estatística: o número é o protagonista, o rótulo fica discreto. */
export function StatCard({
  label,
  value,
  icon: Icon,
  iconTone = "primary",
  href,
  trend,
  chart,
  valueClassName,
  title,
}: StatCardProps) {
  const trendStyle = trend ? TREND_STYLE[trend.direction] : null;
  const TrendIcon = trendStyle?.icon;

  const content = (
    <>
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            iconTone === "accent" ? "bg-warning-soft" : "bg-secondary"
          )}
        >
          <Icon className={cn("h-5 w-5", iconTone === "accent" ? "text-warning" : "text-primary")} aria-hidden />
        </span>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      </div>
      <p className={cn("mt-3 text-[2rem] font-semibold leading-none tracking-tight text-foreground tabular-nums", valueClassName)}>
        {value}
      </p>
      <div className="mt-2 flex min-h-8 items-end justify-between gap-2">
        {trend && trendStyle ? (
          <p className={cn("flex items-center gap-1 text-xs font-medium", trendStyle.className)}>
            {TrendIcon && <TrendIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />}
            {trend.text}
          </p>
        ) : (
          <span />
        )}
        {chart}
      </div>
    </>
  );

  const className = "block rounded-lg border border-border bg-card p-5 shadow-card transition-colors";

  if (href) {
    return (
      <Link
        href={href}
        title={title}
        className={cn(className, "hover:border-primary-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}
      >
        {content}
      </Link>
    );
  }
  return (
    <div className={className} title={title}>
      {content}
    </div>
  );
}
