"use client";

import { FileText, Scale } from "lucide-react";

import { COR_MACRO } from "@/lib/macro-colors";
import { classificarDensidade, distribuicaoCalorica } from "@/lib/meal-planning";
import type { MacroTotals } from "@/lib/nutrition";

const fmt = (v: number, casas = 1) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

/** Rosca da distribuição calórica: cada fatia pelas kcal do macro (4/9/4 kcal/g). */
function Rosca({ fatias, kcal }: { fatias: { cor: string; pct: number; rotulo: string }[]; kcal: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  // Início de cada fatia = soma das anteriores.
  const arcos = fatias.map((f, i) => ({
    ...f,
    tamanho: (f.pct / 100) * c,
    inicio: fatias.slice(0, i).reduce((s, x) => s + (x.pct / 100) * c, 0),
  }));
  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={fatias.map((f) => `${f.rotulo} ${fmt(f.pct)}%`).join(", ")}>
        <circle cx="50" cy="50" r={r} fill="none" className="stroke-muted" strokeWidth="11" />
        {arcos.map((f) =>
          f.pct > 0 ? (
            <circle
              key={f.rotulo}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={f.cor}
              strokeWidth="11"
              strokeDasharray={`${Math.max(f.tamanho - 1.5, 0)} ${c}`}
              strokeDashoffset={-f.inicio}
            />
          ) : null,
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums leading-none text-foreground">{fmt(Math.round(kcal), 0)}</span>
        <span className="text-xs text-muted-foreground">kcal</span>
      </div>
    </div>
  );
}

/**
 * Resumo nutricional da refeição (Fase 19), calculado do rascunho na hora:
 * kcal, macros com a % das kcal, peso e densidade calórica (Ledikwe et al., 2005).
 */
export function MealEditorSummary({ totais, pesoG }: { totais: MacroTotals; pesoG: number }) {
  const dist = distribuicaoCalorica(totais);
  const dens = classificarDensidade(totais.calorias, pesoG);
  const linhas = [
    { rotulo: "Proteínas", g: totais.proteinas, pct: dist.proteinas.pct, cor: COR_MACRO.proteinas },
    { rotulo: "Gorduras", g: totais.gorduras, pct: dist.lipidios.pct, cor: COR_MACRO.lipidios },
    { rotulo: "Carboidratos", g: totais.carboidratos, pct: dist.carboidratos.pct, cor: COR_MACRO.carboidratos },
  ];

  return (
    <section aria-labelledby="resumo-refeicao" className="space-y-4 rounded-xl border border-border bg-card p-4">
      <h3 id="resumo-refeicao" className="font-semibold text-foreground">
        Resumo nutricional
      </h3>
      <div className="flex items-center gap-5">
        <Rosca fatias={linhas} kcal={totais.calorias} />
        <ul className="min-w-0 flex-1 space-y-2.5 text-sm">
          {linhas.map((l) => (
            <li key={l.rotulo} className="flex gap-2 tabular-nums">
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: l.cor }} aria-hidden="true" />
              <span className="min-w-0 leading-tight">
                <span className="block text-xs text-muted-foreground">{l.rotulo}</span>
                <span className="whitespace-nowrap font-semibold text-foreground">{fmt(l.g)} g</span>
                <span className="ml-1.5 whitespace-nowrap text-xs text-muted-foreground">
                  {dist.total > 0 ? `${fmt(l.pct)}%` : "—"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-muted/50 px-3 py-2">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Scale className="h-3.5 w-3.5" aria-hidden="true" />
            Peso total
          </p>
          <p className="font-semibold tabular-nums text-foreground">{fmt(pesoG, 0)} g</p>
        </div>
        <div className="rounded-lg bg-muted/50 px-3 py-2">
          <p className="text-xs text-muted-foreground">Densidade calórica</p>
          {dens ? (
            <p className="font-semibold tabular-nums text-foreground" title={`Densidade ${dens.rotulo} (${dens.faixa}) — faixas de Ledikwe et al. (2005)`}>
              {fmt(dens.valor, 2)} kcal/g <span className="text-xs font-normal text-muted-foreground">· {dens.rotulo}</span>
            </p>
          ) : (
            <p className="text-muted-foreground">—</p>
          )}
        </div>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
        Percentuais pelas kcal dos macronutrientes (4 kcal/g para proteínas e carboidratos, 9 kcal/g para lipídios).
      </p>
    </section>
  );
}
