"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";

import { faixaProporcional, marcasAlinhadas, marcasDoEixo } from "@/lib/anthropometry-overview";
import type { LinhaAntropometria } from "@/lib/evolution";
import { cn, formatDate } from "@/lib/utils";

/** Cores fixas das séries (pedido de 05/10/2026): peso verde, % de gordura laranja, MLG azul. */
export const COR_SERIE = {
  peso: "hsl(var(--primary))",
  gordura: "hsl(var(--accent))",
  mlg: "#2a78d6",
} as const;

type ChaveSerie = keyof typeof COR_SERIE;

const SERIES: { chave: ChaveSerie; rotulo: string; unidade: "kg" | "%"; get: (l: LinhaAntropometria) => number | null }[] = [
  { chave: "peso", rotulo: "Peso (kg)", unidade: "kg", get: (l) => l.pesoKg },
  { chave: "gordura", rotulo: "% Gordura", unidade: "%", get: (l) => l.percentualGordura },
  { chave: "mlg", rotulo: "Massa livre de gordura (kg)", unidade: "kg", get: (l) => l.massaLivreKg },
];

const ALTURA = 290;
const M = { topo: 16, base: 30, esq: 58, dir: 58 };

const fmt = (v: number, casas = 1) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const fmtEixo = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const dataCurta = (iso: string) => {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a.slice(2)}`;
};
const dias = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86_400_000;

/** Largura real do contêiner: o SVG é desenhado em pixels para o texto não encolher no celular. */
function useLargura<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [largura, setLargura] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => setLargura(Math.floor(e.contentRect.width)));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, largura] as const;
}

/**
 * Evolução da composição corporal: peso, % de gordura e massa livre de
 * gordura, só nos pontos que existem (sem interpolar valores nem prever).
 * Eixo X proporcional ao tempo; kg à esquerda e % à direita, com as mesmas
 * linhas de grade.
 */
export function AnthropometryChart({ linhas }: { linhas: LinhaAntropometria[] }) {
  const [ref, largura] = useLargura<HTMLDivElement>();
  const [ativo, setAtivo] = useState<number | null>(null);
  const [ocultas, setOcultas] = useState<ChaveSerie[]>([]);
  const idBase = useId().replace(/:/g, "");

  // Séries com algum valor no período (vão para a legenda) e, delas, as ligadas.
  const disponiveis = SERIES.filter((s) => linhas.some((l) => s.get(l) !== null));
  const series = disponiveis.filter((s) => !ocultas.includes(s.chave));
  // Mais antiga à esquerda; só datas com algum valor das séries ligadas.
  const pontos = [...linhas].reverse().filter((l) => series.some((s) => s.get(l) !== null));

  if (disponiveis.length === 0) return null;

  // Clicar na legenda liga/desliga a série; a última ligada não desliga (o gráfico nunca fica vazio).
  function alternar(chave: ChaveSerie) {
    setAtivo(null);
    setOcultas((atual) =>
      atual.includes(chave)
        ? atual.filter((c) => c !== chave)
        : series.length > 1
          ? [...atual, chave]
          : atual,
    );
  }

  const legenda = (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs">
      {disponiveis.map((s) => {
        const ligada = !ocultas.includes(s.chave);
        return (
          <button
            key={s.chave}
            type="button"
            aria-pressed={ligada}
            onClick={() => alternar(s.chave)}
            title={ligada ? `Esconder ${s.rotulo}` : `Mostrar ${s.rotulo}`}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              ligada ? "text-foreground" : "text-muted-foreground line-through opacity-60",
            )}
          >
            <span
              className="h-2.5 w-2.5 rounded-full border-2"
              style={{ borderColor: COR_SERIE[s.chave], background: ligada ? COR_SERIE[s.chave] : "transparent" }}
              aria-hidden
            />
            {s.rotulo}
          </button>
        );
      })}
      {ocultas.length > 0 && (
        <button
          type="button"
          onClick={() => setOcultas([])}
          className="rounded-full px-2 py-1 font-medium text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Mostrar todas
        </button>
      )}
    </div>
  );

  const valores = (unidade: "kg" | "%") =>
    series.filter((s) => s.unidade === unidade).flatMap((s) => pontos.map(s.get).filter((v): v is number => v !== null));
  const kg = valores("kg");
  const pct = valores("%");
  const marcasKg = kg.length ? marcasDoEixo(Math.min(...kg), Math.max(...kg)) : null;
  // Com kg na tela, a % ganha a mesma folga relativa (sem exagerar variações pequenas).
  const marcasPct = pct.length
    ? marcasKg
      ? marcasAlinhadas(
          ...faixaProporcional(Math.min(...pct), Math.max(...pct), marcasKg[0], marcasKg[marcasKg.length - 1]),
          marcasKg.length,
        )
      : marcasDoEixo(Math.min(...pct), Math.max(...pct))
    : null;

  const esq = marcasKg ? M.esq : 12;
  const dir = marcasPct ? M.dir : 12;
  const w = Math.max(largura, 280);
  const plotW = w - esq - dir;
  const plotH = ALTURA - M.topo - M.base;
  const folgaX = 14;

  const d0 = dias(pontos[0].data);
  const d1 = dias(pontos[pontos.length - 1].data);
  const x = (iso: string) =>
    d1 === d0 ? esq + plotW / 2 : esq + folgaX + ((dias(iso) - d0) / (d1 - d0)) * (plotW - 2 * folgaX);
  const yDe = (marcas: number[]) => (v: number) => {
    const min = marcas[0];
    const max = marcas[marcas.length - 1];
    return M.topo + plotH - ((v - min) / (max - min)) * plotH;
  };
  const yKg = marcasKg ? yDe(marcasKg) : null;
  const yPct = marcasPct ? yDe(marcasPct) : null;
  const yDaSerie = (s: (typeof SERIES)[number]) => (s.unidade === "kg" ? yKg : yPct)!;
  const grade = marcasKg ?? marcasPct!;
  const yGrade = (marcasKg ? yKg : yPct)!;

  // Rótulos do eixo X nas datas reais das avaliações; afinados para caber (a última sempre aparece).
  const cabem = Math.max(2, Math.floor(plotW / 64));
  const salto = Math.ceil(pontos.length / cabem);
  const rotulosX = pontos
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => (pontos.length - 1 - i) % salto === 0);

  // Faixa de hover de cada data: até o meio do caminho para a vizinha.
  const xs = pontos.map((p) => x(p.data));
  const faixa = (i: number) => {
    const ini = i === 0 ? esq : (xs[i - 1] + xs[i]) / 2;
    const fim = i === xs.length - 1 ? w - dir : (xs[i] + xs[i + 1]) / 2;
    return { ini, fim };
  };

  const descricao = pontos
    .map((p) =>
      [
        formatDate(p.data),
        ...series.map((s) => {
          const v = s.get(p);
          return v === null ? null : `${s.rotulo} ${fmt(v)}`;
        }),
      ]
        .filter(Boolean)
        .join(", "),
    )
    .join("; ");

  const pAtivo = ativo !== null ? pontos[ativo] : null;

  return (
    <div className="space-y-3">
      {legenda}

      <div ref={ref} className="relative w-full" style={{ height: ALTURA }} onPointerLeave={() => setAtivo(null)}>
        {largura > 0 && (
          <svg width={w} height={ALTURA} role="img" aria-label={`Evolução: ${descricao}`} className="block overflow-visible">
            {/* Grade e eixos */}
            {grade.map((v, i) => (
              <line
                key={`g${i}`}
                x1={esq}
                x2={w - dir}
                y1={yGrade(v)}
                y2={yGrade(v)}
                className="stroke-border"
                strokeDasharray={i === 0 ? undefined : "3 4"}
              />
            ))}
            {marcasKg?.map((v) => (
              <text key={`k${v}`} x={esq - 8} y={yKg!(v)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
                {fmtEixo(v)}
              </text>
            ))}
            {marcasPct?.map((v) => (
              <text key={`p${v}`} x={w - dir + 8} y={yPct!(v)} dy="0.32em" className="fill-muted-foreground text-[11px] tabular-nums">
                {fmtEixo(v)}
              </text>
            ))}
            {/* Títulos dos eixos na lateral, longe dos números. */}
            {marcasKg && (
              <text
                transform={`translate(12 ${M.topo + plotH / 2}) rotate(-90)`}
                textAnchor="middle"
                className="fill-muted-foreground text-[11px]"
              >
                {series.some((s) => s.chave === "mlg") ? "Peso e MLG (kg)" : "Peso (kg)"}
              </text>
            )}
            {marcasPct && (
              <text
                transform={`translate(${w - 10} ${M.topo + plotH / 2}) rotate(90)`}
                textAnchor="middle"
                className="fill-muted-foreground text-[11px]"
              >
                % Gordura
              </text>
            )}
            <defs>
              {series.filter((s) => s.chave === "peso").map((s) => (
                <linearGradient key={s.chave} id={`${idBase}-${s.chave}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={COR_SERIE[s.chave]} stopOpacity={0.14} />
                  <stop offset="100%" stopColor={COR_SERIE[s.chave]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            {rotulosX.map(({ p, i }) => (
              <text key={`x${i}`} x={xs[i]} y={ALTURA - 8} textAnchor="middle" className="fill-muted-foreground text-[11px] tabular-nums">
                {dataCurta(p.data)}
              </text>
            ))}

            {/* Guia da data em foco */}
            {ativo !== null && (
              <line x1={xs[ativo]} x2={xs[ativo]} y1={M.topo} y2={M.topo + plotH} className="stroke-muted-foreground/40" />
            )}

            {/* Séries: linhas só entre pontos reais */}
            {series.map((s) => {
              const y = yDaSerie(s);
              const pts = pontos.flatMap((p, i) => {
                const v = s.get(p);
                return v === null ? [] : [{ x: xs[i], y: y(v), i }];
              });
              const d = pts.map((p, k) => `${k === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
              return (
                <g key={s.chave}>
                  {/* Preenchimento suave só embaixo do peso: três áreas sobrepostas misturavam as cores. */}
                  {s.chave === "peso" && pts.length > 1 && (
                    <path
                      d={`${d} L${pts[pts.length - 1].x.toFixed(1)} ${M.topo + plotH} L${pts[0].x.toFixed(1)} ${M.topo + plotH} Z`}
                      fill={`url(#${idBase}-${s.chave})`}
                    />
                  )}
                  {pts.length > 1 && (
                    <path d={d} fill="none" stroke={COR_SERIE[s.chave]} strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />
                  )}
                  {pts.map((p) => (
                    <circle
                      key={p.i}
                      cx={p.x}
                      cy={p.y}
                      r={ativo === p.i ? 5 : 3.5}
                      fill={COR_SERIE[s.chave]}
                      className="stroke-card"
                      strokeWidth={2}
                    />
                  ))}
                </g>
              );
            })}

            {/* Áreas de hover/toque por data */}
            {pontos.map((p, i) => {
              const { ini, fim } = faixa(i);
              return (
                <rect
                  key={`h${i}`}
                  x={ini}
                  y={M.topo}
                  width={Math.max(0, fim - ini)}
                  height={plotH}
                  fill="transparent"
                  onPointerEnter={() => setAtivo(i)}
                  onPointerDown={() => setAtivo(i)}
                />
              );
            })}
          </svg>
        )}

        {pAtivo && ativo !== null && (
          <div
            className="pointer-events-none absolute top-1 z-10 min-w-[10rem] rounded-lg border bg-popover px-3 py-2 text-xs shadow-md"
            style={
              xs[ativo] > w / 2
                ? { right: Math.max(0, w - xs[ativo] + 10) }
                : { left: Math.max(0, xs[ativo] + 10) }
            }
          >
            <p className="mb-1 font-semibold text-foreground">
              {formatDate(pAtivo.data)}
              {pAtivo.origem === "anexo" && <span className="font-normal text-muted-foreground"> · relatório externo</span>}
            </p>
            {series.map((s) => {
              const v = s.get(pAtivo);
              if (v === null) return null;
              return (
                <p key={s.chave} className="flex items-center justify-between gap-3 text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: COR_SERIE[s.chave] }} aria-hidden />
                    {s.rotulo}
                  </span>
                  <span className="font-medium tabular-nums text-foreground">{fmt(v)}</span>
                </p>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
