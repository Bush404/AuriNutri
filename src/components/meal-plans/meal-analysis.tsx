"use client";

import { useState } from "react";

import { COR_MACRO } from "@/lib/macro-colors";
import { classificarDensidade, distribuicaoCalorica } from "@/lib/meal-planning";
import type { MacroTotals } from "@/lib/nutrition";
import { escapeHtml } from "@/lib/rich-text";
import { atualizarObservacoesRefeicao } from "@/lib/actions/meal-food-search";
import { useAutoSave } from "@/lib/hooks/use-auto-save";

import { AutoSaveStatus } from "@/components/patients/auto-save-status";
import { RichTextEditor } from "@/components/shared/rich-text-editor";

const fmt = (v: number, casas = 1) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

/** "Análise de nutrientes" de uma refeição (Fase 17, 4.7): macros, peso total, densidade calórica e % de cada macro. */
export function MealAnalysis({ totais, pesoG }: { totais: MacroTotals; pesoG: number }) {
  const dist = distribuicaoCalorica(totais);
  const dens = classificarDensidade(totais.calorias, pesoG);
  const linhas = [
    { rotulo: "Proteínas", valor: `${fmt(totais.proteinas)} g`, cor: COR_MACRO.proteinas, pct: dist.proteinas.pct },
    { rotulo: "Lipídios", valor: `${fmt(totais.gorduras)} g`, cor: COR_MACRO.lipidios, pct: dist.lipidios.pct },
    { rotulo: "Carboidratos", valor: `${fmt(totais.carboidratos)} g`, cor: COR_MACRO.carboidratos, pct: dist.carboidratos.pct },
  ];

  return (
    <div className="grid gap-3 rounded-md bg-muted/40 p-3 text-sm sm:grid-cols-3">
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Macronutrientes da refeição</p>
        {linhas.map((l) => (
          <p key={l.rotulo} className="flex items-center justify-between gap-2 tabular-nums">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.cor }} aria-hidden="true" />
              {l.rotulo}
            </span>
            <span className="font-medium">{l.valor}</span>
          </p>
        ))}
        <p className="flex justify-between gap-2 tabular-nums">
          <span>Calorias</span>
          <span className="font-medium">{fmt(Math.round(totais.calorias), 0)} kcal</span>
        </p>
        <p className="flex justify-between gap-2 tabular-nums">
          <span>Peso total</span>
          <span className="font-medium">{fmt(pesoG, 0)} g</span>
        </p>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Densidade calórica</p>
        {dens ? (
          <>
            <p className="text-lg font-semibold tabular-nums">{fmt(dens.valor, 2)} kcal/g</p>
            <p className="text-muted-foreground">
              Densidade {dens.rotulo} ({dens.faixa})
            </p>
            <p className="text-xs text-muted-foreground">Faixas de Ledikwe et al. (2005).</p>
          </>
        ) : (
          <p className="text-muted-foreground">Sem alimentos.</p>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Distribuição calórica da refeição</p>
        {linhas.map((l) => (
          <p key={l.rotulo} className="flex items-center justify-between gap-2 tabular-nums">
            <span>{l.rotulo}</span>
            <span className="font-medium">{dist.total > 0 ? `${fmt(l.pct)}%` : "—"}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

/** Observações antigas eram texto simples: viram um parágrafo para o editor. */
const paraHtml = (texto: string | null) =>
  !texto ? "" : /<[a-z][\s\S]*>/i.test(texto) ? texto : texto.split(/\n+/).map((l) => `<p>${escapeHtml(l)}</p>`).join("");

/** Observações da refeição com texto formatado (Fase 17, 4.8): salvam sozinhas e saem no PDF. */
export function MealObservations({ planId, mealId, inicial }: { planId: string; mealId: string; inicial: string | null }) {
  const [html, setHtml] = useState(() => paraHtml(inicial));
  const { estado, erro } = useAutoSave(html, (valor) => atualizarObservacoesRefeicao(planId, mealId, valor), 1200);

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-foreground">Observações da refeição</p>
      <RichTextEditor value={html} onChange={setHtml} ariaLabel="Observações da refeição" />
      <AutoSaveStatus estado={estado} erro={erro} />
    </div>
  );
}
