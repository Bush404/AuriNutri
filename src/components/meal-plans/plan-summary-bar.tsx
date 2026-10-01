import { COR_MACRO } from "@/lib/macro-colors";
import type { MacroTotals, PlanMetas } from "@/lib/nutrition";

const fmt = (v: number, casas = 1) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

/**
 * Resumo fixo no rodapé enquanto o plano é montado (Fase 17, decisão 7.6:
 * rodapé, igual ao WebDiet, no computador e no celular). Mostra o prescrito e,
 * quando há planejamento teórico, a meta ao lado. Começa depois do menu
 * lateral (w-64) no computador.
 */
export function PlanSummaryBar({ totais, metas }: { totais: MacroTotals; metas: PlanMetas }) {
  const itens = [
    { rotulo: "Proteínas", valor: totais.proteinas, meta: metas.meta_proteinas_g, unidade: "g", cor: COR_MACRO.proteinas },
    { rotulo: "Lipídios", valor: totais.gorduras, meta: metas.meta_gorduras_g, unidade: "g", cor: COR_MACRO.lipidios },
    { rotulo: "Carboidratos", valor: totais.carboidratos, meta: metas.meta_carboidratos_g, unidade: "g", cor: COR_MACRO.carboidratos },
    { rotulo: "Calorias", valor: totais.calorias, meta: metas.meta_kcal, unidade: "kcal", cor: null },
  ];

  return (
    <div
      role="region"
      aria-label="Resumo do plano"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-foreground text-background md:left-64"
    >
      <p className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
        <span className="font-semibold">Resumo</span>
        {itens.map((i) => (
          <span key={i.rotulo} className="flex items-center gap-1.5 tabular-nums">
            {i.cor && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: i.cor }} aria-hidden="true" />}
            {i.rotulo}:{" "}
            <span className="font-semibold">
              {i.unidade === "kcal" ? fmt(Math.round(i.valor), 0) : fmt(i.valor)}
              {i.meta !== null && (
                <span className="font-normal opacity-70"> / {i.unidade === "kcal" ? fmt(Math.round(i.meta), 0) : fmt(i.meta)}</span>
              )}{" "}
              {i.unidade}
            </span>
          </span>
        ))}
      </p>
    </div>
  );
}
