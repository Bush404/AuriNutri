"use client";

import type { ComponentType } from "react";
import { ArrowRight, Droplets, Dumbbell, Gauge, Hourglass, Ruler } from "lucide-react";

import {
  classificarImc,
  classificarPercentualGordura,
  classificarRcq,
  IDADE_IDOSO,
  type Classificacao,
  type Tom,
} from "@/lib/anthropometry";
import { faixasDoClassificador, posicaoNaEscala } from "@/lib/anthropometry-overview";
import type { IndicadoresAtuais } from "@/lib/evolution";
import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const fmt = (v: number, casas = 1) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

const COR_FAIXA: Record<Tom, string> = {
  success: "bg-success/25",
  warning: "bg-warning/25",
  destructive: "bg-destructive/20",
};

/** Recorte visual de cada escala (o que fica fora cola na ponta) e o passo da leitura do classificador. */
interface Escala {
  classificar: (v: number) => Classificacao;
  min: number;
  max: number;
  passo: number;
  casas: number;
}

function EscalaVisual({ valor, escala }: { valor: number; escala: Escala }) {
  const { classificar, min, max, passo, casas } = escala;
  const faixas = faixasDoClassificador(classificar, min, max, passo);
  const total = max - min;
  // Limite lido entre dois passos (ex.: "≤ 5" vira 5,1): arredonda quando está a um passo de um inteiro.
  const limite = (v: number) => (Math.abs(v - Math.round(v)) <= passo + 1e-9 ? Math.round(v) : v);
  const marcas = faixas.slice(1).reduce<{ v: number; pos: number }[]>((acc, f) => {
    const pos = posicaoNaEscala(f.de, min, max);
    // Duas marcas quase no mesmo lugar ficariam uma em cima da outra: fica só a primeira.
    if (acc.length && pos - acc[acc.length - 1].pos < 0.09) return acc;
    return [...acc, { v: limite(f.de), pos }];
  }, []);

  return (
    <div aria-hidden className="mt-3">
      <div className="relative">
        <div className="flex h-2 overflow-hidden rounded-full">
          {faixas.map((f) => (
            <div
              key={`${f.label}-${f.de}`}
              title={f.label}
              className={cn("h-full border-r border-card last:border-r-0", COR_FAIXA[f.tom])}
              style={{ width: `${((f.ate - f.de) / total) * 100}%` }}
            />
          ))}
        </div>
        <span
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-primary shadow-sm"
          style={{ left: `${posicaoNaEscala(valor, min, max) * 100}%` }}
        />
      </div>
      <div className="relative mt-1 h-3.5 text-[10px] tabular-nums text-muted-foreground">
        {marcas.map((m) => (
          <span key={m.v} className="absolute -translate-x-1/2" style={{ left: `${m.pos * 100}%` }}>
            {m.v.toLocaleString("pt-BR", { maximumFractionDigits: casas })}
          </span>
        ))}
      </div>
    </div>
  );
}

function Indicador({
  icon: Icon,
  rotulo,
  valor,
  classificacao,
  escala,
  numero,
  rodape,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  rotulo: string;
  valor: string;
  classificacao?: Classificacao | null;
  escala?: Escala | null;
  numero?: number;
  rodape?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-xl border bg-card px-4 py-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success-soft text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{rotulo}</p>
          <p className="whitespace-nowrap text-xl font-bold tabular-nums tracking-tight text-foreground">{valor}</p>
        </div>
        {classificacao && (
          <Badge variant={classificacao.tom} className="max-w-[45%] shrink-0 whitespace-normal text-center leading-tight">
            {classificacao.label}
          </Badge>
        )}
      </div>
      {escala && numero !== undefined && <EscalaVisual valor={numero} escala={escala} />}
      {children}
      {(classificacao || rodape) && (
        <p className="mt-auto pt-2 text-[11px] text-muted-foreground">{rodape ?? `Referência: ${classificacao!.fonte}`}</p>
      )}
    </div>
  );
}

/**
 * "Indicadores atuais": só valores e classificações que o sistema já
 * calcula na tela da avaliação. Sem classificação implementada (ex.:
 * circunferência da cintura sozinha), mostra só o número.
 */
export function AnthropometryIndicators({
  ind,
  dataAvaliacao,
  onVerTodas,
}: {
  ind: IndicadoresAtuais;
  dataAvaliacao: string;
  onVerTodas: () => void;
}) {
  const { sexo, idade } = ind;
  const adulto = !ind.crianca;

  const escalaImc: Escala | null =
    adulto && ind.imc !== null && ind.classificacaoImc
      ? idade !== null && idade >= IDADE_IDOSO
        ? { classificar: (v) => classificarImc(v, idade), min: 16, max: 34, passo: 0.1, casas: 1 }
        : { classificar: (v) => classificarImc(v, idade), min: 14, max: 42, passo: 0.1, casas: 1 }
      : null;
  const escalaGordura: Escala | null =
    adulto && sexo && ind.classificacaoGordura
      ? { classificar: (v) => classificarPercentualGordura(v, sexo), min: 2, max: 40, passo: 0.1, casas: 1 }
      : null;
  const escalaRcq: Escala | null =
    sexo && ind.classificacaoRcq ? { classificar: (v) => classificarRcq(v, sexo), min: 0.6, max: 1.2, passo: 0.01, casas: 2 } : null;

  const cards = [
    ind.imc !== null && (
      <Indicador
        key="imc"
        icon={Gauge}
        rotulo={ind.crianca ? "IMC (para a idade)" : "IMC"}
        valor={`${fmt(ind.imc)} kg/m²`}
        classificacao={ind.classificacaoImc}
        escala={escalaImc}
        numero={ind.imc}
      />
    ),
    ind.percentualGordura !== null && (
      <Indicador
        key="gordura"
        icon={Droplets}
        rotulo="% de gordura"
        valor={`${fmt(ind.percentualGordura)}%`}
        classificacao={ind.classificacaoGordura}
        escala={escalaGordura}
        numero={ind.percentualGordura}
      />
    ),
    ind.rcq !== null && (
      <Indicador
        key="rcq"
        icon={Hourglass}
        rotulo="Relação cintura/quadril"
        valor={fmt(ind.rcq, 2)}
        classificacao={ind.classificacaoRcq}
        escala={escalaRcq}
        numero={ind.rcq}
      />
    ),
    ind.cinturaCm !== null && (
      <Indicador key="cintura" icon={Ruler} rotulo="Circunferência da cintura" valor={`${fmt(ind.cinturaCm)} cm`} />
    ),
    ind.massaLivreKg !== null && (
      <Indicador key="mlg" icon={Dumbbell} rotulo="Massa livre de gordura" valor={`${fmt(ind.massaLivreKg)} kg`}>
        {ind.pesoKg !== null && ind.pesoKg > 0 && (
          <div className="mt-3">
            <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div
                className="h-full rounded-full bg-primary/70"
                style={{ width: `${Math.min(100, (ind.massaLivreKg / ind.pesoKg) * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {fmt((ind.massaLivreKg / ind.pesoKg) * 100)}% do peso corporal
            </p>
          </div>
        )}
      </Indicador>
    ),
  ].filter(Boolean);

  if (cards.length === 0) return null;

  return (
    <section aria-labelledby="indicadores-atuais" className="space-y-4 rounded-xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 id="indicadores-atuais" className="text-base font-semibold text-foreground">
            Indicadores atuais
          </h3>
          <p className="text-sm text-muted-foreground">
            Classificação e interpretação dos principais indicadores · avaliação de {dataAvaliacao}
          </p>
        </div>
        <Button variant="outline" size="sm" className="self-start sm:self-auto" onClick={onVerTodas}>
          Ver todas as medidas
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(13rem,1fr))]">{cards}</div>
    </section>
  );
}
