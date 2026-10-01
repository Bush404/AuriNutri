"use client";

import { useId } from "react";

import type { SexoParaFormula } from "@/lib/energy";
import { INDICADOR_LABELS, lmsEm, valorNoZ, type IndicadorCrescimento } from "@/lib/growth/growth";
import { WHO_LMS } from "@/lib/growth/who-lms-data";
import { formatDate } from "@/lib/utils";

export interface PontoCrescimento {
  x: number;
  valor: number;
  data: string;
  atual?: boolean;
}

const UNIDADE: Record<IndicadorCrescimento, string> = {
  peso_idade: "kg",
  altura_idade: "cm",
  imc_idade: "kg/m²",
  peso_comprimento: "kg",
  peso_estatura: "kg",
};

/** Indicadores de peso para estatura e IMC têm o corte de +1 (risco de sobrepeso / sobrepeso). */
const TEM_MAIS_UM: Record<IndicadorCrescimento, boolean> = {
  peso_idade: false,
  altura_idade: false,
  imc_idade: true,
  peso_comprimento: true,
  peso_estatura: true,
};

/** Janela do eixo x: foca na faixa da criança em vez de espremer 0 a 19 anos. */
export function janelaDoGrafico(indicador: IndicadorCrescimento, sexo: SexoParaFormula, xAtual: number): [number, number] {
  const tabela = WHO_LMS[indicador][sexo];
  const [min, max] = [tabela[0][0], tabela[tabela.length - 1][0]];
  if (indicador === "peso_comprimento" || indicador === "peso_estatura") return [min, max];
  if (xAtual <= 24) return [0, 24];
  if (xAtual <= 60) return [0, 60];
  return [60, max];
}

const W = 640;
const H = 280;
const P = { top: 12, right: 44, bottom: 34, left: 40 };

export function GrowthChart({
  indicador,
  sexo,
  pontos,
  janela,
}: {
  indicador: IndicadorCrescimento;
  sexo: SexoParaFormula;
  pontos: PontoCrescimento[];
  janela: [number, number];
}) {
  const titleId = useId();
  const [x0, x1] = janela;
  const passo = indicador === "peso_comprimento" || indicador === "peso_estatura" ? 0.5 : x1 - x0 > 60 ? 2 : 1;
  const zs = TEM_MAIS_UM[indicador] ? [-3, -2, 0, 1, 2, 3] : [-3, -2, 0, 2, 3];

  const xs: number[] = [];
  for (let x = x0; x <= x1 + 1e-9; x += passo) xs.push(Math.round(x * 10) / 10);
  const curvas = zs.map((z) => ({
    z,
    pts: xs.flatMap((x) => {
      const lms = lmsEm(indicador, sexo, x);
      return lms ? [[x, valorNoZ(lms, z)] as const] : [];
    }),
  }));

  const visiveis = pontos.filter((p) => p.x >= x0 && p.x <= x1);
  const todosY = [...curvas.flatMap((c) => c.pts.map(([, y]) => y)), ...visiveis.map((p) => p.valor)];
  const yMin = Math.floor(Math.min(...todosY) * 0.95);
  const yMax = Math.ceil(Math.max(...todosY) * 1.02);

  const px = (x: number) => P.left + ((x - x0) / (x1 - x0)) * (W - P.left - P.right);
  const py = (y: number) => H - P.bottom - ((y - yMin) / (yMax - yMin || 1)) * (H - P.top - P.bottom);
  const path = (pts: readonly (readonly [number, number])[]) =>
    pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${px(x).toFixed(1)} ${py(y).toFixed(1)}`).join(" ");

  // Faixa "adequada": −2 a +2 (ou −2 a +1 onde +1 já é risco).
  const baixo = curvas.find((c) => c.z === -2)!.pts;
  const alto = curvas.find((c) => c.z === (TEM_MAIS_UM[indicador] ? 1 : 2))!.pts;
  const faixa = `${path(baixo)} ${[...alto].reverse().map(([x, y]) => `L${px(x).toFixed(1)} ${py(y).toFixed(1)}`).join(" ")} Z`;

  const porIdade = indicador !== "peso_comprimento" && indicador !== "peso_estatura";
  const ticksX: number[] = [];
  const passoTick = porIdade ? (x1 - x0 > 60 ? 24 : x1 - x0 > 24 ? 12 : 3) : 10;
  for (let t = Math.ceil(x0 / passoTick) * passoTick; t <= x1; t += passoTick) ticksX.push(t);
  const ticksY: number[] = [];
  const passoY = Math.max(1, Math.round((yMax - yMin) / 6));
  for (let t = Math.ceil(yMin / passoY) * passoY; t <= yMax; t += passoY) ticksY.push(t);

  const ordenados = [...visiveis].sort((a, b) => a.x - b.x);
  const unidade = UNIDADE[indicador];
  const descricao =
    `${INDICADOR_LABELS[indicador]} (OMS). ` +
    (ordenados.length
      ? ordenados.map((p) => `${formatDate(p.data)}: ${p.valor.toFixed(1)} ${unidade}`).join("; ")
      : "Sem medidas nesta faixa.");

  return (
    <figure className="space-y-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-labelledby={titleId}>
        <title id={titleId}>{descricao}</title>
        <path d={faixa} className="fill-primary/10" />
        {ticksY.map((t) => (
          <g key={`y${t}`}>
            <line x1={P.left} x2={W - P.right} y1={py(t)} y2={py(t)} className="stroke-border" strokeWidth={0.5} />
            <text x={P.left - 6} y={py(t) + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">
              {t}
            </text>
          </g>
        ))}
        {ticksX.map((t) => (
          <text key={`x${t}`} x={px(t)} y={H - P.bottom + 14} textAnchor="middle" className="fill-muted-foreground text-[10px]">
            {porIdade ? (t % 12 === 0 ? `${t / 12}a` : `${t}m`) : t}
          </text>
        ))}
        <text x={(P.left + W - P.right) / 2} y={H - 4} textAnchor="middle" className="fill-muted-foreground text-[10px]">
          {porIdade ? "Idade (anos/meses)" : "Comprimento/estatura (cm)"}
        </text>
        {curvas.map((c) => (
          <g key={c.z}>
            <path
              d={path(c.pts)}
              fill="none"
              strokeWidth={c.z === 0 ? 1.5 : 1}
              strokeDasharray={Math.abs(c.z) === 3 ? "4 3" : undefined}
              className={c.z === 0 ? "stroke-primary" : Math.abs(c.z) >= 2 ? "stroke-destructive/60" : "stroke-accent"}
            />
            {c.pts.length > 0 && (
              <text
                x={W - P.right + 4}
                y={py(c.pts[c.pts.length - 1][1]) + 3}
                className="fill-muted-foreground text-[10px]"
              >
                {c.z > 0 ? `+${c.z}` : c.z}
              </text>
            )}
          </g>
        ))}
        {ordenados.length > 1 && (
          <path d={path(ordenados.map((p) => [p.x, p.valor]))} fill="none" className="stroke-foreground" strokeWidth={1.2} />
        )}
        {ordenados.map((p) => (
          <circle
            key={`${p.data}-${p.x}`}
            cx={px(p.x)}
            cy={py(p.valor)}
            r={p.atual ? 5 : 3.5}
            className={p.atual ? "fill-foreground stroke-background" : "fill-muted-foreground"}
            strokeWidth={p.atual ? 2 : 0}
          />
        ))}
      </svg>
      <figcaption className="text-xs text-muted-foreground">
        Linhas: escore-z da OMS (0 = mediana). Faixa sombreada: adequada. Pontos: avaliações do paciente
        {ordenados.length > 1 ? " (o maior é esta avaliação)" : ""}.
      </figcaption>
    </figure>
  );
}
