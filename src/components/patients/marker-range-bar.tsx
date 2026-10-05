import { escalaDaFaixa, foraDaFaixa } from "@/lib/lab-marker-range";
import { cn } from "@/lib/utils";

const n = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

/**
 * Barra da faixa de referência: a faixa em verde-claro e um ponto no valor.
 * Fora da faixa, o ponto fica laranja — a mesma sinalização neutra do selo
 * "fora da faixa de referência", nunca um diagnóstico. Sem faixa, não desenha.
 * Decorativa (aria-hidden): o texto ao lado já diz valor e faixa.
 */
export function MarkerRangeBar({ valor, min, max }: { valor: number | null; min: number | null; max: number | null }) {
  const escala = escalaDaFaixa(valor, min, max);
  if (!escala) return null;
  const fora = valor !== null && foraDaFaixa(valor, min, max);

  return (
    <div aria-hidden="true">
      <div className="relative h-2 rounded-full bg-muted">
        <div
          className="absolute inset-y-0 rounded-full bg-success/25"
          style={{ left: `${escala.faixaInicio * 100}%`, width: `${(escala.faixaFim - escala.faixaInicio) * 100}%` }}
        />
        {escala.valor !== null && (
          <span
            className={cn(
              "absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card shadow-sm",
              fora ? "bg-accent" : "bg-primary",
            )}
            style={{ left: `${escala.valor * 100}%` }}
          />
        )}
      </div>
      <div className="relative mt-1 h-4 text-[11px] tabular-nums text-muted-foreground">
        {escala.marcas.map((m) => (
          <span
            key={`${m.rotulo}-${m.posicao}`}
            className={cn("absolute", m.posicao <= 0.02 ? "left-0" : m.posicao >= 0.98 ? "right-0" : "-translate-x-1/2")}
            style={m.posicao > 0.02 && m.posicao < 0.98 ? { left: `${m.posicao * 100}%` } : undefined}
          >
            {n(m.rotulo)}
          </span>
        ))}
      </div>
    </div>
  );
}
