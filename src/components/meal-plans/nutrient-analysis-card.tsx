"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { analisarCardapio, distribuicaoCalorica, type MetasDoPlano } from "@/lib/meal-planning";
import type { MacroTotals } from "@/lib/nutrition";
import type { MealPlan } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";

import { PlanejamentoDialog, type CalculoParaImportar } from "@/components/meal-plans/planejamento-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const fmt = (v: number, casas = 1) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

const valor = (v: number | null, unidade: string) => {
  if (v === null) return "—";
  if (unidade === "kcal") return `${fmt(Math.round(v), 0)} kcal`;
  if (unidade === "kcal/g") return `${fmt(v, 2)} kcal/g`;
  return `${fmt(v)} g`;
};

/**
 * Cores das três fatias: os três primeiros tons da paleta categórica validada
 * (azul, laranja, verde-água — passam todas as checagens de daltonismo entre
 * si). O verde-água tem contraste < 3:1 com o fundo, por isso cada fatia leva
 * o número escrito ao lado.
 */
const MACROS = [
  { chave: "proteinas", rotulo: "Proteínas", cor: "#2a78d6" },
  { chave: "lipidios", rotulo: "Lipídios", cor: "#eb6834" },
  { chave: "carboidratos", rotulo: "Carboidratos", cor: "#1baf7a" },
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
}

/** "Análise de nutrientes do cardápio" (Fase 17, Bloco A): Prescrito × Teórico × Diferença + distribuição calórica. */
export function NutrientAnalysisCard({ planId, plan, totais, pesoTotalG, pesoPaciente, calculos, patientId }: Props) {
  const [planejando, setPlanejando] = useState(false);
  const metas: MetasDoPlano = plan;
  const temTeorico = plan.meta_kcal !== null;
  const linhas = analisarCardapio(totais, pesoTotalG, metas);
  const dist = distribuicaoCalorica(totais);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Análise de nutrientes do cardápio</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Parâmetro</th>
                  <th className="py-2 pr-3 text-right font-medium">Prescrito</th>
                  <th className="py-2 pr-3 text-right font-medium">Teórico</th>
                  <th className="py-2 text-right font-medium">Diferença</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.parametro} className="border-b border-border/60 last:border-0">
                    <td className="py-1.5 pr-3 text-foreground">
                      {l.parametro}
                      {l.parametro === "Carboidratos livres" && (
                        <span className="ml-1 text-xs text-muted-foreground" title="Carboidratos totais menos fibras">
                          (sem fibras)
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{valor(l.prescrito, l.unidade)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground">{valor(l.teorico, l.unidade)}</td>
                    <td className={cn("py-1.5 text-right tabular-nums", l.diferenca ? "font-medium" : "")}>
                      {l.diferenca === null ? "—" : `${l.diferenca > 0 ? "+" : l.diferenca < 0 ? "−" : ""}${valor(Math.abs(l.diferenca), l.unidade)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button type="button" variant={temTeorico ? "outline" : "default"} size="sm" onClick={() => setPlanejando(true)}>
            {!temTeorico && <Plus className="h-4 w-4" />}
            {temTeorico ? "Editar planejamento teórico" : "Adicionar planejamento teórico"}
          </Button>
        </div>

        <div className="space-y-4">
          <p className="text-sm font-medium text-foreground">Distribuição calórica do cardápio</p>
          {dist.total > 0 ? (
            <div
              className="flex h-4 w-full gap-[2px] overflow-hidden rounded"
              role="img"
              aria-label={MACROS.map((m) => `${m.rotulo} ${fmt(dist[m.chave].pct)}%`).join(", ")}
            >
              {MACROS.map((m) =>
                dist[m.chave].pct > 0 ? (
                  <div
                    key={m.chave}
                    className="h-full first:rounded-l last:rounded-r"
                    style={{ width: `${dist[m.chave].pct}%`, backgroundColor: m.cor }}
                    title={`${m.rotulo}: ${fmt(Math.round(dist[m.chave].kcal), 0)} kcal (${fmt(dist[m.chave].pct)}%)`}
                  />
                ) : null
              )}
            </div>
          ) : (
            <div className="h-4 w-full rounded bg-muted" aria-hidden="true" />
          )}
          <div className="grid grid-cols-2 gap-2">
            {MACROS.map((m) => (
              <div key={m.chave} className="flex gap-2 rounded-md bg-muted/50 px-3 py-2">
                <span className="mt-1 h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: m.cor }} aria-hidden="true" />
                <div className="text-sm">
                  <p className="text-muted-foreground">{m.rotulo}</p>
                  <p className="font-medium tabular-nums text-foreground">
                    {fmt(Math.round(dist[m.chave].kcal), 0)} kcal · {fmt(dist[m.chave].pct)}%
                  </p>
                </div>
              </div>
            ))}
            <div className="flex gap-2 rounded-md bg-muted/50 px-3 py-2">
              <span className="mt-1 h-3 w-3 shrink-0" aria-hidden="true" />
              <div className="text-sm">
                <p className="text-muted-foreground">Total</p>
                <p className="font-medium tabular-nums text-foreground">{fmt(Math.round(dist.total), 0)} kcal</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
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
