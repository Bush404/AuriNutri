import { compareToGoal, type MacroTotals, type PlanMetas } from "@/lib/nutrition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type { PlanMetas };

export function DailyTotalsCard({ totals, metas }: { totals: MacroTotals; metas?: PlanMetas }) {
  const items = [
    {
      label: "Calorias",
      value: totals.calorias,
      unit: "kcal",
      decimals: 0,
      tone: "text-primary-700",
      meta: metas?.meta_kcal ?? null,
    },
    {
      label: "Proteínas",
      value: totals.proteinas,
      unit: "g",
      decimals: 1,
      tone: "text-foreground",
      meta: metas?.meta_proteinas_g ?? null,
    },
    {
      label: "Carboidratos",
      value: totals.carboidratos,
      unit: "g",
      decimals: 1,
      tone: "text-foreground",
      meta: metas?.meta_carboidratos_g ?? null,
    },
    {
      label: "Gorduras",
      value: totals.gorduras,
      unit: "g",
      decimals: 1,
      tone: "text-foreground",
      meta: metas?.meta_gorduras_g ?? null,
    },
    { label: "Fibras", value: totals.fibras, unit: "g", decimals: 1, tone: "text-foreground", meta: null },
  ];

  return (
    <Card className="border-primary-100 bg-primary-50/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Total diário do plano</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {items.map((item) => {
            const comparacao = compareToGoal(item.value, item.meta, item.unit, item.decimals);
            return (
              <div key={item.label}>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {item.label}
                </p>
                <p className={`mt-1 text-xl font-semibold ${item.tone}`}>
                  {item.value.toFixed(item.decimals)}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">{item.unit}</span>
                </p>
                {item.meta !== null && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Meta: {item.meta.toFixed(item.decimals)} {item.unit}
                  </p>
                )}
                {comparacao && (
                  <Badge variant={comparacao.tone} className="mt-1">
                    {comparacao.label} ({comparacao.detail})
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
