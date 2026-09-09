import type { MacroTotals } from "@/lib/nutrition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DailyTotalsCard({ totals }: { totals: MacroTotals }) {
  const items = [
    { label: "Calorias", value: totals.calorias, unit: "kcal", tone: "text-primary-700" },
    { label: "Proteínas", value: totals.proteinas, unit: "g", tone: "text-foreground" },
    { label: "Carboidratos", value: totals.carboidratos, unit: "g", tone: "text-foreground" },
    { label: "Gorduras", value: totals.gorduras, unit: "g", tone: "text-foreground" },
    { label: "Fibras", value: totals.fibras, unit: "g", tone: "text-foreground" },
  ];

  return (
    <Card className="border-primary-100 bg-primary-50/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Total diário do plano</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {items.map((item) => (
            <div key={item.label}>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {item.label}
              </p>
              <p className={`mt-1 text-xl font-semibold ${item.tone}`}>
                {item.value.toFixed(item.label === "Calorias" ? 0 : 1)}
                <span className="ml-1 text-sm font-normal text-muted-foreground">{item.unit}</span>
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
