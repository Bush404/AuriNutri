"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { FileDown, Table2, TrendingUp } from "lucide-react";

import {
  datasDisponiveis,
  INDICADOR_EVOLUCAO_INFO,
  INDICADORES_EVOLUCAO,
  INDICADORES_PADRAO,
  MAX_INDICADORES,
  montarSeries,
  parseIndicadores,
  type EntradaEvolucao,
  type IndicadorEvolucao,
  type PontoEvolucao,
} from "@/lib/evolution";
import { cn, formatDate } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STORAGE_KEY = "aurinutri:evolucao-indicadores";

function lerPreferencia(): IndicadorEvolucao[] {
  try {
    return parseIndicadores(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return INDICADORES_PADRAO;
  }
}

const fmt = (v: number, casas: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

/**
 * Evolução física (Fase 15, Bloco D). Com `ateFixo`, mostra a evolução até
 * aquela avaliação (página da avaliação); sem ele, o profissional escolhe a data.
 */
export function EvolutionPanel({
  patientId,
  entrada,
  ateFixo,
}: {
  patientId: string;
  entrada: EntradaEvolucao;
  ateFixo?: string;
}) {
  const datas = useMemo(() => datasDisponiveis(entrada), [entrada]);
  const [ateEscolhida, setAteEscolhida] = useState<string>(datas[0] ?? "");
  const ate = ateFixo ?? ateEscolhida;
  const [escolhidos, setEscolhidos] = useState<IndicadorEvolucao[]>(INDICADORES_PADRAO);
  const [modoTabela, setModoTabela] = useState(false);

  // Preferência de indicadores lembrada neste navegador (só conveniência).
  // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage só existe no navegador
  useEffect(() => setEscolhidos(lerPreferencia()), []);

  function alternar(id: IndicadorEvolucao) {
    setEscolhidos((atual) => {
      const novo = atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id].slice(0, MAX_INDICADORES);
      try {
        window.localStorage.setItem(STORAGE_KEY, novo.join(","));
      } catch {
        // navegador sem armazenamento: só não lembra a escolha
      }
      return novo;
    });
  }

  const series = useMemo(() => montarSeries(entrada, ate || null), [entrada, ate]);
  const pdfHref = `/pacientes/${patientId}/evolucao/pdf?ate=${ate}&ind=${escolhidos.join(",")}`;

  if (datas.length === 0) {
    return <p className="text-sm text-muted-foreground">Registre avaliações para acompanhar a evolução do paciente.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        {ateFixo ? (
          <p className="text-sm text-muted-foreground">Todas as avaliações até {formatDate(ateFixo)}.</p>
        ) : (
          <div className="w-56 space-y-1">
            <Label className="text-xs">Evolução até</Label>
            <Select value={ateEscolhida} onValueChange={setAteEscolhida}>
              <SelectTrigger aria-label="Evolução até a data">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {datas.map((d) => (
                  <SelectItem key={d} value={d}>
                    {formatDate(d)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setModoTabela((x) => !x)} aria-pressed={modoTabela}>
            {modoTabela ? <TrendingUp className="h-4 w-4" /> : <Table2 className="h-4 w-4" />}
            {modoTabela ? "Ver gráficos" : "Ver tabela"}
          </Button>
          <Button variant="outline" size="sm" asChild disabled={escolhidos.length === 0}>
            <a href={pdfHref} download>
              <FileDown className="h-4 w-4" />
              PDF Evolução física
            </a>
          </Button>
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 text-xs text-muted-foreground">
          Indicadores ({escolhidos.length} de até {MAX_INDICADORES})
        </legend>
        <div className="flex flex-wrap gap-2">
          {INDICADORES_EVOLUCAO.map(({ id, label }) => {
            const ativo = escolhidos.includes(id);
            const semDados = series[id].length === 0;
            const cheio = !ativo && escolhidos.length >= MAX_INDICADORES;
            return (
              <Button
                key={id}
                type="button"
                size="sm"
                variant={ativo ? "default" : "outline"}
                aria-pressed={ativo}
                disabled={!ativo && (semDados || cheio)}
                title={semDados ? "Sem medidas até esta data" : cheio ? `Máximo de ${MAX_INDICADORES}` : undefined}
                onClick={() => alternar(id)}
                className="h-8"
              >
                {label}
              </Button>
            );
          })}
        </div>
      </fieldset>

      {modoTabela ? (
        <TabelaEvolucao escolhidos={escolhidos} series={series} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {escolhidos.map((id) => (
            <GraficoIndicador key={id} id={id} pontos={series[id]} />
          ))}
          {escolhidos.some((id) => series[id].some((p) => p.origem === "anexo")) && (
            <p className="text-xs text-muted-foreground md:col-span-2">O ponto vazado vem de um relatório anexado.</p>
          )}
        </div>
      )}
    </div>
  );
}

function GraficoIndicador({ id, pontos }: { id: IndicadorEvolucao; pontos: PontoEvolucao[] }) {
  const info = INDICADOR_EVOLUCAO_INFO[id];
  const titleId = useId();
  const primeiro = pontos[0];
  const ultimo = pontos[pontos.length - 1];
  const delta = primeiro && ultimo && pontos.length > 1 ? ultimo.valor - primeiro.valor : null;
  const unidade = info.unidade ? ` ${info.unidade}` : "";

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground">{info.label}</h3>
        {ultimo && (
          <p className="text-sm">
            <span className="font-semibold">
              {fmt(ultimo.valor, info.casas)}
              {unidade}
            </span>
            {delta !== null && (
              <span className={cn("ml-2 text-xs", delta === 0 ? "text-muted-foreground" : "text-foreground")}>
                ({delta > 0 ? "+" : ""}
                {fmt(delta, info.casas)} desde {formatDate(primeiro.data)})
              </span>
            )}
          </p>
        )}
      </div>
      {pontos.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sem medidas até esta data.</p>
      ) : (
        <LinhaSvg pontos={pontos} casas={info.casas} titleId={titleId} titulo={`${info.label}${unidade}`} />
      )}
    </div>
  );
}

function LinhaSvg({ pontos, casas, titleId, titulo }: { pontos: PontoEvolucao[]; casas: number; titleId: string; titulo: string }) {
  const W = 320;
  const H = 130;
  const P = { top: 14, right: 12, bottom: 22, left: 12 };
  const tempos = pontos.map((p) => Date.parse(p.data));
  const t0 = Math.min(...tempos);
  const t1 = Math.max(...tempos);
  const vs = pontos.map((p) => p.valor);
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const faixa = max - min || Math.abs(max) * 0.1 || 1;
  const x = (t: number) => (t1 === t0 ? W / 2 : P.left + ((t - t0) / (t1 - t0)) * (W - P.left - P.right));
  const y = (v: number) => H - P.bottom - ((v - (min - faixa * 0.1)) / (faixa * 1.2)) * (H - P.top - P.bottom);
  const d = pontos.map((p, i) => `${i === 0 ? "M" : "L"}${x(tempos[i]).toFixed(1)} ${y(p.valor).toFixed(1)}`).join(" ");
  const descricao = `${titulo}: ${pontos.map((p) => `${formatDate(p.data)} ${fmt(p.valor, casas)}`).join("; ")}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-labelledby={titleId}>
      <title id={titleId}>{descricao}</title>
      <line x1={P.left} x2={W - P.right} y1={H - P.bottom} y2={H - P.bottom} className="stroke-border" />
      {pontos.length > 1 && <path d={d} fill="none" className="stroke-primary" strokeWidth={2} />}
      {pontos.map((p, i) => (
        <g key={`${p.data}-${i}`}>
          <circle
            cx={x(tempos[i])}
            cy={y(p.valor)}
            r={3.5}
            className={p.origem === "anexo" ? "fill-background stroke-primary" : "fill-primary"}
            strokeWidth={p.origem === "anexo" ? 2 : 0}
          />
          {(i === 0 || i === pontos.length - 1 || pontos.length <= 6) && (
            <text x={x(tempos[i])} y={y(p.valor) - 6} textAnchor="middle" className="fill-foreground text-[9px]">
              {fmt(p.valor, casas)}
            </text>
          )}
        </g>
      ))}
      <text x={P.left} y={H - 6} className="fill-muted-foreground text-[9px]">
        {formatDate(pontos[0].data)}
      </text>
      {pontos.length > 1 && (
        <text x={W - P.right} y={H - 6} textAnchor="end" className="fill-muted-foreground text-[9px]">
          {formatDate(pontos[pontos.length - 1].data)}
        </text>
      )}
    </svg>
  );
}

function TabelaEvolucao({
  escolhidos,
  series,
}: {
  escolhidos: IndicadorEvolucao[];
  series: Record<IndicadorEvolucao, PontoEvolucao[]>;
}) {
  // Uma linha por data E origem: avaliação e relatório anexado no mesmo dia não se misturam.
  const linhas = [...new Set(escolhidos.flatMap((id) => series[id].map((p) => `${p.data}|${p.origem}`)))].sort();
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            {escolhidos.map((id) => (
              <TableHead key={id} className="text-right">
                {INDICADOR_EVOLUCAO_INFO[id].label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {linhas.map((linha) => {
            const [d, origem] = linha.split("|");
            return (
              <TableRow key={linha}>
                <TableCell className="text-sm">
                  {formatDate(d)}
                  {origem === "anexo" && <span className="ml-1 text-xs text-muted-foreground">(relatório)</span>}
                </TableCell>
                {escolhidos.map((id) => {
                  const p = series[id].find((x) => x.data === d && x.origem === origem);
                  return (
                    <TableCell key={id} className="text-right text-sm">
                      {p ? fmt(p.valor, INDICADOR_EVOLUCAO_INFO[id].casas) : "—"}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
