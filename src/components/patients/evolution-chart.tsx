"use client";

import { useId, useMemo, useState } from "react";
import { Table2, TrendingUp } from "lucide-react";
import type { AnthropometricAssessment } from "@/lib/types/database.types";
import { formatDate, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Metric = "peso_kg" | "imc";

const METRIC_LABEL: Record<Metric, string> = {
  peso_kg: "Peso (kg)",
  imc: "IMC",
};

export function EvolutionChart({ assessments }: { assessments: AnthropometricAssessment[] }) {
  const [metric, setMetric] = useState<Metric>("peso_kg");
  const [modoTabela, setModoTabela] = useState(false);
  const titleId = useId();

  const sorted = useMemo(
    () =>
      [...assessments].sort(
        (a, b) => new Date(a.data_avaliacao).getTime() - new Date(b.data_avaliacao).getTime()
      ),
    [assessments]
  );

  const width = 640;
  const height = 220;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };

  const values = sorted.map((a) => a[metric]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = sorted.map((assessment, index) => {
    const x =
      padding.left +
      (index / Math.max(sorted.length - 1, 1)) * (width - padding.left - padding.right);
    const y =
      height -
      padding.bottom -
      ((assessment[metric] - min) / range) * (height - padding.top - padding.bottom);
    return { x, y, assessment };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const delta = first && last ? (Number(last[metric]) - Number(first[metric])).toFixed(1) : null;

  const chartDescription =
    first && last
      ? `Gráfico de linha da evolução de ${METRIC_LABEL[metric]}, de ${Number(first[metric])} em ${formatDate(
          first.data_avaliacao
        )} até ${Number(last[metric])} em ${formatDate(last.data_avaliacao)}, ao longo de ${sorted.length} avaliações.`
      : `Gráfico de evolução de ${METRIC_LABEL[metric]}.`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
            <Button
              key={m}
              type="button"
              size="sm"
              variant={metric === m ? "default" : "outline"}
              onClick={() => setMetric(m)}
              aria-pressed={metric === m}
            >
              {METRIC_LABEL[m]}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {delta !== null && (
            <span
              className={cn(
                "text-sm font-medium",
                Number(delta) < 0 ? "text-primary-700" : Number(delta) > 0 ? "text-accent-foreground" : "text-muted-foreground"
              )}
            >
              {Number(delta) > 0 ? "+" : ""}
              {delta} desde a primeira avaliação
            </span>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={() => setModoTabela((v) => !v)}>
            {modoTabela ? <TrendingUp className="h-4 w-4" /> : <Table2 className="h-4 w-4" />}
            {modoTabela ? "Ver como gráfico" : "Ver dados em tabela"}
          </Button>
        </div>
      </div>

      {modoTabela ? (
        <Table aria-label="Evolução de peso e IMC por avaliação">
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Peso (kg)</TableHead>
              <TableHead>IMC</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((a) => (
              <TableRow key={a.id}>
                <TableCell>{formatDate(a.data_avaliacao)}</TableCell>
                <TableCell>{a.peso_kg}</TableCell>
                <TableCell>{a.imc}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-labelledby={titleId}>
          <title id={titleId}>{chartDescription}</title>
          {/* Linhas guia horizontais */}
          {[0, 0.5, 1].map((t) => (
            <line
              key={t}
              x1={padding.left}
              x2={width - padding.right}
              y1={padding.top + t * (height - padding.top - padding.bottom)}
              y2={padding.top + t * (height - padding.top - padding.bottom)}
              stroke="hsl(var(--border))"
              strokeDasharray="4 4"
            />
          ))}

          <path d={pathD} fill="none" stroke="hsl(var(--primary))" strokeWidth={2.5} />

          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={4} fill="hsl(var(--primary))" />
              <text x={p.x} y={height - 8} textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground))">
                {formatDate(p.assessment.data_avaliacao)}
              </text>
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}
