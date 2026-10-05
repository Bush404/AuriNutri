"use client";

import type { ComponentType, ReactNode } from "react";
import { Activity, Droplets, Dumbbell, Pipette, Ruler, Scale } from "lucide-react";

import type { Classificacao } from "@/lib/anthropometry";
import type { ResultadosAvaliacao } from "@/lib/anthropometry-results";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type Icone = ComponentType<{ className?: string }>;

const fmt = (value: number | null | undefined, casas = 1) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? null
    : value.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

function Selo({ c }: { c: Classificacao | null | undefined }) {
  if (!c) return null;
  return (
    <Badge variant={c.tom} className="whitespace-normal text-left">
      {c.label}
    </Badge>
  );
}

/**
 * Uma linha de resultado: rótulo (com a fonte e o selo de classificação
 * embaixo, para os números ficarem alinhados), valor e unidade em coluna
 * própria. Sem valor: "—".
 */
function Linha({
  label,
  valor,
  unidade,
  fonte,
  selo,
  children,
}: {
  label: string;
  valor: string | null;
  unidade?: string;
  fonte?: string;
  selo?: Classificacao | null;
  children?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_2.75rem] items-center gap-x-2 border-b border-border/60 px-1 py-2 text-sm last:border-0">
      <div className="min-w-0">
        <span className="text-muted-foreground">
          {label}
          {fonte && <span className="ml-1 text-[11px]">({fonte})</span>}
        </span>
        {(selo || children) && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Selo c={selo} />
            {children}
          </div>
        )}
      </div>
      <span className={cn("text-right font-semibold tabular-nums", valor ? "text-foreground" : "text-muted-foreground")}>
        {valor ?? "—"}
      </span>
      <span className="text-xs text-muted-foreground">{unidade}</span>
    </div>
  );
}

function Bloco({ titulo, icon: Icon, cor, children }: { titulo: string; icon: Icone; cor: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card px-3 pb-2 pt-3">
      <h3 className="mb-1 flex items-center gap-2 px-1 text-sm font-semibold text-foreground">
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-md", cor)}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        {titulo}
      </h3>
      {children}
    </section>
  );
}

/** Cartão de destaque do topo: o número que mais se olha na consulta. */
function Destaque({
  rotulo,
  valor,
  unidade,
  origem,
  icon: Icon,
  classes,
}: {
  rotulo: string;
  valor: string | null;
  unidade: string;
  /** De onde veio o número quando há mais de um caminho (dobras ou bioimpedância). */
  origem?: string;
  icon: Icone;
  classes: { fundo: string; icone: string };
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2 rounded-xl border px-3 py-3", classes.fundo)}>
      <div className="flex items-center gap-2">
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-card", classes.icone)}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="text-xs font-semibold leading-tight text-foreground">{rotulo}</span>
      </div>
      <p className="text-xl font-bold tabular-nums tracking-tight text-foreground">
        {valor ?? <span className="text-muted-foreground">—</span>}
        <span className="ml-1 text-xs font-medium text-muted-foreground">{unidade}</span>
      </p>
      {origem && <p className="-mt-1.5 text-[11px] text-muted-foreground">{origem}</p>}
    </div>
  );
}

export interface BioimpedanciaValores {
  bio_percentual_gordura: number | null;
  bio_massa_gorda_kg: number | null;
  bio_percentual_massa_muscular: number | null;
  bio_massa_muscular_kg: number | null;
  bio_massa_livre_gordura_kg: number | null;
  bio_peso_osseo_kg: number | null;
  bio_gordura_visceral: number | null;
  bio_agua_corporal_percentual: number | null;
  bio_idade_metabolica: number | null;
}

export function AssessmentResultsPanel({
  r,
  pesoKg,
  alturaCm,
  bio,
  classificacaoBio,
}: {
  r: ResultadosAvaliacao;
  pesoKg: number | null;
  alturaCm: number | null;
  bio: BioimpedanciaValores;
  classificacaoBio: Classificacao | null;
}) {
  const g = r.gordura;
  const pgDobras = g?.ok ? g.percentualGordura : null;
  // Destaques: o valor das dobras; sem ele, o do aparelho (com a origem escrita) — a mesma regra da aba Antropometria Geral.
  const pgDestaque = pgDobras ?? bio.bio_percentual_gordura;
  const mlgDestaque = r.massaLivreGorduraKg ?? bio.bio_massa_livre_gordura_kg;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
        <Destaque
          rotulo="Peso"
          valor={fmt(pesoKg, 1)}
          unidade="kg"
          icon={Scale}
          classes={{ fundo: "bg-success-soft/70", icone: "text-primary" }}
        />
        <Destaque
          rotulo="% Gordura"
          valor={fmt(pgDestaque, 1)}
          unidade="%"
          origem={pgDobras === null && pgDestaque !== null ? "bioimpedância" : undefined}
          icon={Droplets}
          classes={{ fundo: "bg-warning-soft/50", icone: "text-accent" }}
        />
        <Destaque
          rotulo="Massa livre de gordura"
          valor={fmt(mlgDestaque, 1)}
          unidade="kg"
          origem={r.massaLivreGorduraKg === null && mlgDestaque !== null ? "bioimpedância" : undefined}
          icon={Dumbbell}
          classes={{ fundo: "bg-info-soft/60", icone: "text-info" }}
        />
      </div>

      <Bloco titulo="Pesos e medidas" icon={Ruler} cor="bg-success-soft text-primary">
        <Linha label="Peso" valor={fmt(pesoKg)} unidade="kg" />
        <Linha label="Altura" valor={fmt(alturaCm)} unidade="cm" />
        <Linha label="IMC" valor={fmt(r.imc, 2)} unidade="kg/m²" fonte={r.classificacaoImc?.fonte} selo={r.classificacaoImc} />
        <Linha
          label={r.idoso ? "Faixa de peso ideal (IMC 22–27)" : "Faixa de peso ideal (IMC 18,5–24,9)"}
          valor={r.pesoIdeal ? `${fmt(r.pesoIdeal.minKg)} a ${fmt(r.pesoIdeal.maxKg)}` : null}
          unidade="kg"
        />
        <Linha label="Relação cintura/quadril (RCQ)" valor={fmt(r.rcq, 2)} fonte={r.classificacaoRcq?.fonte} selo={r.classificacaoRcq} />
        <Linha
          label="Relação cintura/estatura (RCEst)"
          valor={fmt(r.rcest, 2)}
          fonte={r.classificacaoRcest?.fonte}
          selo={r.classificacaoRcest}
        />
        <Linha label="Circunferência muscular do braço (CMB)" valor={fmt(r.cmb)} unidade="cm" />
        {r.classificacaoCmb && (
          <>
            <Linha
              label="Adequação da CMB"
              valor={fmt(r.classificacaoCmb.adequacaoPercentual, 0)}
              unidade="%"
              fonte={r.classificacaoCmb.adequacao.fonte}
              selo={r.classificacaoCmb.adequacao}
            />
            <Linha label="Percentil da CMB" valor={null} fonte={r.classificacaoCmb.percentil.fonte} selo={r.classificacaoCmb.percentil} />
            {r.classificacaoCmb.acimaDaTabela && (
              <p className="px-1 py-1 text-xs text-muted-foreground">
                A tabela de Frisancho vai até 74 anos — usada a faixa de 65 a 74.
              </p>
            )}
          </>
        )}
        {r.panturrilhaIdoso && (
          <Linha label="Panturrilha (idoso)" valor={null} fonte={r.panturrilhaIdoso.fonte} selo={r.panturrilhaIdoso} />
        )}
      </Bloco>

      <Bloco titulo="Dobras e diâmetros ósseos" icon={Pipette} cor="bg-warning-soft text-accent">
        {g && !g.ok && (
          <p role="status" className="my-1 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-foreground">
            {g.motivo}
          </p>
        )}
        <Linha label="% de gordura" valor={fmt(pgDobras)} unidade="%" fonte={g?.ok ? g.fonte : undefined} />
        <Linha
          label="Classificação do % de gordura"
          valor={null}
          fonte={r.classificacaoGordura?.fonte}
          selo={r.classificacaoGordura}
        />
        <Linha label="Massa de gordura" valor={fmt(r.massaGordaKg)} unidade="kg" />
        <Linha label="Massa livre de gordura" valor={fmt(r.massaLivreGorduraKg)} unidade="kg" />
        <Linha label="Peso ósseo" valor={fmt(r.pesoOsseoKg)} unidade="kg" fonte="Rocha, 1975" />
        <Linha label="Peso residual" valor={fmt(r.pesoResidualKg)} unidade="kg" fonte="Würch, 1974" />
        <Linha label="Massa muscular" valor={fmt(r.massaMuscularKg)} unidade="kg" fonte="De Rose & Guimarães, 1980" />
        <Linha label="Soma das dobras do protocolo" valor={fmt(g?.ok ? g.somaDobras : null)} unidade="mm" />
        <Linha label="Densidade corporal" valor={fmt(g?.ok ? g.densidade : null, 4)} unidade="g/cm³" />
        {r.massaMuscularKg === null && r.massaGordaKg !== null && (
          <p className="px-1 py-1 text-xs text-muted-foreground">Para a massa muscular, preencha os diâmetros do punho e do fêmur.</p>
        )}
      </Bloco>

      {/* Bloco próprio e sempre visível, como no WebDiet: a bioimpedância é outra forma de avaliação (pedido de 05/10/2026). */}
      <Bloco titulo="Análises por bioimpedância" icon={Activity} cor="bg-violet-100 text-violet-600">
        <Linha label="% de gordura" valor={fmt(bio.bio_percentual_gordura)} unidade="%" />
        <Linha label="Classificação do % de gordura" valor={null} fonte={classificacaoBio?.fonte} selo={classificacaoBio} />
        <Linha label="% de massa muscular" valor={fmt(bio.bio_percentual_massa_muscular)} unidade="%" />
        <Linha label="Massa muscular" valor={fmt(bio.bio_massa_muscular_kg)} unidade="kg" />
        <Linha label="Água corporal" valor={fmt(bio.bio_agua_corporal_percentual)} unidade="%" />
        <Linha label="Peso ósseo" valor={fmt(bio.bio_peso_osseo_kg)} unidade="kg" />
        <Linha label="Massa de gordura" valor={fmt(bio.bio_massa_gorda_kg)} unidade="kg" />
        <Linha label="Massa livre de gordura" valor={fmt(bio.bio_massa_livre_gordura_kg)} unidade="kg" />
        <Linha label="Gordura visceral" valor={fmt(bio.bio_gordura_visceral)} unidade="nível" />
        <Linha label="Idade metabólica" valor={fmt(bio.bio_idade_metabolica, 0)} unidade="anos" />
      </Bloco>
    </div>
  );
}
