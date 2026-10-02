import { cn } from "@/lib/utils";

interface SparklineProps {
  values: number[];
  /** Rótulo de cada ponto (ex.: "set/2026: 12"), usado no tooltip e na leitura de tela. */
  pointLabels: string[];
  className?: string;
}

const W = 88;
const H = 32;
const PAD = 4;

/** Minilinha de tendência (uma série só, sem eixos). O número do card é o protagonista. */
export function Sparkline({ values, pointLabels, className }: SparklineProps) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => ({
    x: PAD + (i * (W - 2 * PAD)) / (values.length - 1),
    // Série constante fica numa linha reta no meio, não colada no chão.
    y: max === min ? H / 2 : H - PAD - ((v - min) / range) * (H - 2 * PAD),
  }));
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      role="img"
      aria-label={`Tendência: ${pointLabels.join("; ")}`}
      className={cn("shrink-0 overflow-visible", className)}
    >
      <path d={d} fill="none" className="stroke-primary-500" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r={3} className="fill-primary stroke-card" strokeWidth={2} />
      {/* Alvos de hover maiores que a marca, com o valor de cada mês. */}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={7} fill="transparent">
          <title>{pointLabels[i]}</title>
        </circle>
      ))}
    </svg>
  );
}
