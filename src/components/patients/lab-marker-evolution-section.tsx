"use client";

import { useMemo, useState } from "react";
import type { LabMarker } from "@/lib/types/database.types";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface MarkerHistoryPoint {
  examDataColeta: string;
  marker: LabMarker;
}

/**
 * Evolução de um marcador ao longo do tempo — mesmo padrão SVG do
 * EvolutionChart (peso/IMC do paciente), com a faixa de referência indicada
 * visualmente. A data usada é a da COLETA do exame (data_coleta), não a de
 * quando o marcador foi digitado no sistema.
 */
export function LabMarkerEvolutionSection({ historico }: { historico: MarkerHistoryPoint[] }) {
  const nomesDisponiveis = useMemo(
    () => Array.from(new Set(historico.map((h) => h.marker.nome_marcador))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [historico]
  );

  const [marcadorSelecionado, setMarcadorSelecionado] = useState(nomesDisponiveis[0] ?? "");

  if (nomesDisponiveis.length === 0) return null;

  const pontos = historico
    .filter((h) => h.marker.nome_marcador === marcadorSelecionado)
    .sort((a, b) => new Date(a.examDataColeta).getTime() - new Date(b.examDataColeta).getTime());

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <CardTitle>Evolução de marcador</CardTitle>
        <div className="w-full sm:w-64">
          <Select value={marcadorSelecionado} onValueChange={setMarcadorSelecionado}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um marcador" />
            </SelectTrigger>
            <SelectContent>
              {nomesDisponiveis.map((nome) => (
                <SelectItem key={nome} value={nome}>
                  {nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {pontos.length < 2 ? (
          <p className="text-sm text-muted-foreground">
            Registre esse marcador em pelo menos dois exames para visualizar a evolução.
          </p>
        ) : (
          <MarkerChart pontos={pontos} />
        )}
      </CardContent>
    </Card>
  );
}

function MarkerChart({ pontos }: { pontos: MarkerHistoryPoint[] }) {
  const width = 640;
  const height = 240;
  const padding = { top: 20, right: 20, bottom: 30, left: 44 };

  const valores = pontos.map((p) => p.marker.valor);
  const referencias = pontos.flatMap((p) => [p.marker.referencia_min, p.marker.referencia_max]).filter((v): v is number => v !== null);

  const todosValores = [...valores, ...referencias];
  const min = Math.min(...todosValores);
  const max = Math.max(...todosValores);
  const range = max - min || 1;
  // Margem de 10% pra faixa/linha não colar nas bordas do gráfico.
  const yMin = min - range * 0.1;
  const yMax = max + range * 0.1;
  const yRange = yMax - yMin || 1;

  function yFor(valor: number) {
    return height - padding.bottom - ((valor - yMin) / yRange) * (height - padding.top - padding.bottom);
  }

  const pontosXY = pontos.map((p, index) => ({
    x: padding.left + (index / Math.max(pontos.length - 1, 1)) * (width - padding.left - padding.right),
    y: yFor(p.marker.valor),
    ponto: p,
  }));

  const pathD = pontosXY.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  // Faixa de referência: usa a última faixa conhecida (elas podem mudar de
  // exame pra exame, já que cada lab_markers é um snapshot independente) —
  // mostrada como referência visual, não recalculada.
  const ultimaFaixa = pontos[pontos.length - 1].marker;
  const temFaixa = ultimaFaixa.referencia_min !== null || ultimaFaixa.referencia_max !== null;
  const faixaTopo = ultimaFaixa.referencia_max !== null ? yFor(ultimaFaixa.referencia_max) : padding.top;
  const faixaBase = ultimaFaixa.referencia_min !== null ? yFor(ultimaFaixa.referencia_min) : height - padding.bottom;

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
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

        {temFaixa && (
          <rect
            x={padding.left}
            y={faixaTopo}
            width={width - padding.left - padding.right}
            height={Math.max(faixaBase - faixaTopo, 0)}
            fill="hsl(var(--primary))"
            fillOpacity={0.08}
          />
        )}

        <path d={pathD} fill="none" stroke="hsl(var(--primary))" strokeWidth={2.5} />

        {pontosXY.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={4} fill={p.ponto.marker.fora_da_faixa ? "hsl(var(--accent-foreground))" : "hsl(var(--primary))"} />
            <text x={p.x} y={height - 8} textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground))">
              {formatDate(p.ponto.examDataColeta)}
            </text>
          </g>
        ))}
      </svg>
      {temFaixa && (
        <p className="text-xs text-muted-foreground">
          Faixa de referência mais recente: {ultimaFaixa.referencia_min ?? "—"} a {ultimaFaixa.referencia_max ?? "—"}{" "}
          {ultimaFaixa.unidade} (área sombreada). Pontos fora da área sombreada estão fora da faixa de referência
          daquele exame.
        </p>
      )}
    </div>
  );
}
