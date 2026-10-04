"use client";

import { useState } from "react";
import { Flame, Info, Plus } from "lucide-react";

import { COR_MACRO } from "@/lib/macro-colors";
import { analisarCardapio, distribuicaoCalorica, type MetasDoPlano } from "@/lib/meal-planning";
import type { MacroTotals } from "@/lib/nutrition";
import type { MealItem, MealPlan, Sexo } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";

import { PlanejamentoDialog, type CalculoParaImportar } from "@/components/meal-plans/planejamento-dialog";
import { MicronutrientsDialog } from "@/components/meal-plans/micronutrients-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const fmt = (v: number, casas = 1) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

const valor = (v: number | null, unidade: string) => {
  if (v === null) return "—";
  if (unidade === "kcal") return `${fmt(Math.round(v), 0)} kcal`;
  if (unidade === "kcal/g") return `${fmt(v, 2)} kcal/g`;
  return `${fmt(v)} g`;
};

/** Mesmas cores do resto do plano (src/lib/macro-colors.ts); cada fatia leva o número escrito ao lado. */
const MACROS = [
  { chave: "proteinas", rotulo: "Proteínas", cor: COR_MACRO.proteinas },
  { chave: "lipidios", rotulo: "Lipídios", cor: COR_MACRO.lipidios },
  { chave: "carboidratos", rotulo: "Carboidratos", cor: COR_MACRO.carboidratos },
] as const;

interface Props {
  planId: string;
  plan: Pick<
    MealPlan,
    | "meta_kcal"
    | "meta_proteinas_g"
    | "meta_carboidratos_g"
    | "meta_gorduras_g"
    | "planejamento_modo"
    | "planejamento_peso_kg"
    | "planejamento_proteinas"
    | "planejamento_lipidios"
    | "planejamento_carboidratos"
    | "planejamento_calculo_id"
  >;
  totais: MacroTotals;
  pesoTotalG: number;
  pesoPaciente: number | null;
  calculos: CalculoParaImportar[];
  patientId: string;
  /** Todos os itens do plano, para os micronutrientes × DRI (Fase 17, Bloco F). */
  itens: MealItem[];
  paciente: { sexo: Sexo | null; data_nascimento: string | null };
}

/** "Análise de nutrientes do plano" (Fase 17, Bloco A; visual da Fase 19): Prescrito × Teórico × Diferença + distribuição calórica. */
export function NutrientAnalysisCard({
  planId,
  plan,
  totais,
  pesoTotalG,
  pesoPaciente,
  calculos,
  patientId,
  itens,
  paciente,
}: Props) {
  const [planejando, setPlanejando] = useState(false);
  const metas: MetasDoPlano = plan;
  const temTeorico = plan.meta_kcal !== null;
  const linhas = analisarCardapio(totais, pesoTotalG, metas);
  const dist = distribuicaoCalorica(totais);

  return (
    <Card>
      <CardContent className="grid gap-8 p-4 sm:p-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Análise de nutrientes do plano</h2>
            <p className="text-sm text-muted-foreground">Comparativo entre o prescrito e o teórico calculado.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Nutriente</th>
                  <th className="py-2 pr-3 text-right font-medium">Prescrito</th>
                  <th className="py-2 pr-3 text-right font-medium">Teórico</th>
                  <th className="py-2 text-right font-medium">Diferença</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.parametro} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3 text-foreground">
                      {l.parametro}
                      {l.parametro === "Carboidratos livres" && (
                        <span className="ml-1 text-xs text-muted-foreground" title="Carboidratos totais menos fibras">
                          (sem fibras)
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right font-medium tabular-nums text-foreground">
                      {valor(l.prescrito, l.unidade)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                      {valor(l.teorico, l.unidade)}
                    </td>
                    <td
                      className={cn(
                        "py-2 text-right tabular-nums",
                        !l.diferenca
                          ? "text-muted-foreground"
                          : l.diferenca > 0
                            ? "font-semibold text-success"
                            : "font-semibold text-destructive/90",
                      )}
                    >
                      {l.diferenca === null
                        ? "—"
                        : `${l.diferenca > 0 ? "+" : l.diferenca < 0 ? "−" : ""}${valor(Math.abs(l.diferenca), l.unidade)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={temTeorico ? "outline" : "default"}
              size="sm"
              onClick={() => setPlanejando(true)}
            >
              {!temTeorico && <Plus className="h-4 w-4" />}
              {temTeorico ? "Editar planejamento teórico" : "Adicionar planejamento teórico"}
            </Button>
            <MicronutrientsDialog itens={itens} paciente={paciente} />
          </div>
        </div>

        <div className="space-y-4 lg:border-l lg:border-border lg:pl-8">
          <h3 className="text-base font-semibold text-foreground">Distribuição calórica do plano</h3>
          {dist.total > 0 ? (
            <div
              className="flex h-3 w-full gap-[3px] overflow-hidden rounded-full"
              role="img"
              aria-label={MACROS.map((m) => `${m.rotulo} ${fmt(dist[m.chave].pct)}%`).join(", ")}
            >
              {MACROS.map((m) =>
                dist[m.chave].pct > 0 ? (
                  <div
                    key={m.chave}
                    className="h-full first:rounded-l-full last:rounded-r-full"
                    style={{ width: `${dist[m.chave].pct}%`, backgroundColor: m.cor }}
                    title={`${m.rotulo}: ${fmt(Math.round(dist[m.chave].kcal), 0)} kcal (${fmt(dist[m.chave].pct)}%)`}
                  />
                ) : null,
              )}
            </div>
          ) : (
            <div className="h-3 w-full rounded-full bg-muted" aria-hidden="true" />
          )}
          <div className="grid grid-cols-2 gap-2">
            {MACROS.map((m) => (
              <div key={m.chave} className="flex gap-2.5 rounded-lg bg-muted/50 px-3 py-2.5">
                <span
                  className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: m.cor }}
                  aria-hidden="true"
                />
                <div className="text-sm">
                  <p className="text-muted-foreground">{m.rotulo}</p>
                  <p className="font-semibold tabular-nums text-foreground">
                    {fmt(Math.round(dist[m.chave].kcal), 0)} kcal · {fmt(dist[m.chave].pct)}%
                  </p>
                </div>
              </div>
            ))}
            <div className="flex gap-2.5 rounded-lg bg-success-soft/60 px-3 py-2.5">
              <Flame className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <p className="text-sm text-muted-foreground">Total do plano</p>
                <p className="text-xl font-bold tabular-nums text-primary">{fmt(Math.round(dist.total), 0)} kcal</p>
              </div>
            </div>
          </div>
          <p className="flex gap-2 rounded-lg border border-border px-3 py-2.5 text-xs text-muted-foreground">
            <Info className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
            Percentuais pelas kcal dos macronutrientes (4 kcal/g para proteínas e carboidratos, 9 kcal/g para lipídios).
          </p>
        </div>
      </CardContent>

      {planejando && (
        <PlanejamentoDialog
          planId={planId}
          patientId={patientId}
          plan={plan}
          pesoPaciente={pesoPaciente}
          calculos={calculos}
          onClose={() => setPlanejando(false)}
        />
      )}
    </Card>
  );
}
