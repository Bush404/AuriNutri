import Link from "next/link";
import { CheckSquare } from "lucide-react";

import { WEEKDAY_LABELS, formatDayShort, weekdayOf } from "@/lib/agenda";
import { cn } from "@/lib/utils";

export interface WeekPreviewItem {
  key: string;
  dateStr: string;
  /** null = tarefa sem horário (vale para o dia todo). */
  timeStr: string | null;
  label: string;
  kind: "consulta" | "tarefa";
  /** Classes do chip (mesmas cores/estilos da agenda). */
  chipClassName: string;
}

const MAX_ITEMS_PER_DAY = 3;

/**
 * Calendário só de visualização dos próximos 7 dias, no dashboard. Clicar num
 * dia abre a semana daquele dia na agenda. No celular vira uma lista por dia.
 */
export function WeekPreview({ days, todayStr, items }: { days: string[]; todayStr: string; items: WeekPreviewItem[] }) {
  const byDay = new Map<string, WeekPreviewItem[]>();
  for (const item of items) {
    const list = byDay.get(item.dateStr) ?? [];
    list.push(item);
    byDay.set(item.dateStr, list);
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-7 sm:gap-1.5">
      {days.map((dateStr) => {
        const dayItems = byDay.get(dateStr) ?? [];
        const visible = dayItems.slice(0, MAX_ITEMS_PER_DAY);
        const overflow = dayItems.length - visible.length;
        const isToday = dateStr === todayStr;

        return (
          <Link
            key={dateStr}
            href={`/agenda?visao=semana&data=${dateStr}`}
            className={cn(
              "flex gap-2 rounded-md border border-border p-2 transition-colors hover:bg-muted/40 sm:min-h-[132px] sm:flex-col sm:gap-1",
              isToday && "border-primary-300 bg-primary-50/50"
            )}
            aria-label={`${WEEKDAY_LABELS[weekdayOf(dateStr)]} ${formatDayShort(dateStr)}: ${
              dayItems.length === 0 ? "nada agendado" : `${dayItems.length} ${dayItems.length === 1 ? "item" : "itens"}`
            }`}
          >
            <div className="w-16 shrink-0 sm:w-auto sm:text-center">
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                {WEEKDAY_LABELS[weekdayOf(dateStr)]}
              </p>
              <p className={cn("text-sm font-semibold", isToday ? "text-primary-800" : "text-foreground")}>
                {formatDayShort(dateStr)}
              </p>
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-1">
              {dayItems.length === 0 && <span className="text-xs text-muted-foreground sm:hidden">—</span>}
              {visible.map((item) => (
                <span
                  key={item.key}
                  className={cn(
                    "flex items-center gap-1 truncate rounded border px-1 py-0.5 text-[11px] font-medium",
                    item.chipClassName
                  )}
                  title={`${item.kind === "tarefa" ? "Tarefa: " : ""}${item.timeStr ?? "Dia todo"} — ${item.label}`}
                >
                  {item.kind === "tarefa" && <CheckSquare className="h-3 w-3 shrink-0" aria-hidden />}
                  <span className="truncate">
                    {item.timeStr && <span className="font-semibold">{item.timeStr} </span>}
                    <span className="sm:hidden xl:inline">{item.label}</span>
                  </span>
                </span>
              ))}
              {overflow > 0 && <span className="text-[11px] text-muted-foreground">+{overflow} mais</span>}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
