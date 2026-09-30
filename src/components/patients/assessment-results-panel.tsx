"use client";

import type { ReactNode } from "react";

import type { Classificacao } from "@/lib/anthropometry";
import type { ResultadosAvaliacao } from "@/lib/anthropometry-results";
import { Badge } from "@/components/ui/badge";

function num(value: number | null | undefined, casas = 1, unidade = "") {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}${unidade}`;
}

function Selo({ c }: { c: Classificacao | null }) {
  if (!c) return null;
  return (
    <Badge variant={c.tom} className="whitespace-normal text-left">
      {c.label}
    </Badge>
  );
}

function Linha({ label, valor, fonte, children }: { label: string; valor: string; fonte?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md bg-muted/50 px-3 py-2 text-sm">
      <span className="text-muted-foreground">
        {label}
        {fonte && <span className="ml-1 text-[11px]">({fonte})</span>}
      </span>
      <span className="flex flex-wrap items-center justify-end gap-2 font-medium text-foreground">
        {valor}
        {children}
      </span>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
      {children}
    </section>
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
  const temBio = Object.values(bio).some((v) => v !== null);

  return (
    <div className="space-y-5">
      <Secao titulo="Pesos e medidas">
        <Linha label="Peso" valor={num(pesoKg, 1, " kg")} />
        <Linha label="Altura" valor={num(alturaCm, 1, " cm")} />
        <Linha label="IMC" valor={num(r.imc, 2, " kg/m²")} fonte={r.classificacaoImc?.fonte}>
          <Selo c={r.classificacaoImc} />
        </Linha>
        <Linha
          label={r.idoso ? "Faixa de peso ideal (IMC 22–27)" : "Faixa de peso ideal (IMC 18,5–24,9)"}
          valor={r.pesoIdeal ? `${num(r.pesoIdeal.minKg)} a ${num(r.pesoIdeal.maxKg, 1, " kg")}` : "—"}
        />
        <Linha label="Relação cintura/quadril (RCQ)" valor={num(r.rcq, 2)} fonte={r.classificacaoRcq?.fonte}>
          <Selo c={r.classificacaoRcq} />
        </Linha>
        <Linha label="Relação cintura/estatura (RCEst)" valor={num(r.rcest, 2)} fonte={r.classificacaoRcest?.fonte}>
          <Selo c={r.classificacaoRcest} />
        </Linha>
        <Linha label="Circunferência muscular do braço (CMB)" valor={num(r.cmb, 1, " cm")} />
        {r.classificacaoCmb && (
          <>
            <Linha
              label="Adequação da CMB"
              valor={num(r.classificacaoCmb.adequacaoPercentual, 0, "%")}
              fonte={r.classificacaoCmb.adequacao.fonte}
            >
              <Selo c={r.classificacaoCmb.adequacao} />
            </Linha>
            <Linha label="Percentil da CMB" valor="" fonte={r.classificacaoCmb.percentil.fonte}>
              <Selo c={r.classificacaoCmb.percentil} />
            </Linha>
            {r.classificacaoCmb.acimaDaTabela && (
              <p className="px-1 text-xs text-muted-foreground">
                A tabela de Frisancho vai até 74 anos — usada a faixa de 65 a 74.
              </p>
            )}
          </>
        )}
        {r.panturrilhaIdoso && (
          <Linha label="Panturrilha (idoso)" valor="" fonte={r.panturrilhaIdoso.fonte}>
            <Selo c={r.panturrilhaIdoso} />
          </Linha>
        )}
      </Secao>

      <Secao titulo="Dobras e diâmetros ósseos">
        {g && !g.ok && (
          <p role="status" className="rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-foreground">
            {g.motivo}
          </p>
        )}
        <Linha label="% de gordura" valor={num(g?.ok ? g.percentualGordura : null, 1, "%")} fonte={g?.ok ? g.fonte : undefined} />
        <Linha label="Classificação do % de gordura" valor="" fonte={r.classificacaoGordura?.fonte}>
          {r.classificacaoGordura ? <Selo c={r.classificacaoGordura} /> : "—"}
        </Linha>
        <Linha label="% de gordura de referência (média)" valor={num(r.percentualGorduraReferencia, 0, "%")} />
        <Linha label="Massa de gordura" valor={num(r.massaGordaKg, 1, " kg")} />
        <Linha label="Massa livre de gordura" valor={num(r.massaLivreGorduraKg, 1, " kg")} />
        <Linha label="Peso ósseo" valor={num(r.pesoOsseoKg, 1, " kg")} fonte="Rocha, 1975" />
        <Linha label="Peso residual" valor={num(r.pesoResidualKg, 1, " kg")} fonte="Würch, 1974" />
        <Linha label="Massa muscular" valor={num(r.massaMuscularKg, 1, " kg")} fonte="De Rose & Guimarães, 1980" />
        <Linha label="Soma das dobras do protocolo" valor={num(g?.ok ? g.somaDobras : null, 1, " mm")} />
        <Linha label="Densidade corporal" valor={num(g?.ok ? g.densidade : null, 4, " g/cm³")} />
        {r.massaMuscularKg === null && r.massaGordaKg !== null && (
          <p className="px-1 text-xs text-muted-foreground">
            Para a massa muscular, preencha os diâmetros do punho e do fêmur.
          </p>
        )}
      </Secao>

      {temBio && (
        <Secao titulo="Bioimpedância (valores do aparelho)">
          <Linha label="% de gordura" valor={num(bio.bio_percentual_gordura, 1, "%")}>
            <Selo c={classificacaoBio} />
          </Linha>
          <Linha label="Massa de gordura" valor={num(bio.bio_massa_gorda_kg, 1, " kg")} />
          <Linha label="% de massa muscular" valor={num(bio.bio_percentual_massa_muscular, 1, "%")} />
          <Linha label="Massa muscular" valor={num(bio.bio_massa_muscular_kg, 1, " kg")} />
          <Linha label="Massa livre de gordura" valor={num(bio.bio_massa_livre_gordura_kg, 1, " kg")} />
          <Linha label="Peso ósseo" valor={num(bio.bio_peso_osseo_kg, 1, " kg")} />
          <Linha label="Gordura visceral" valor={num(bio.bio_gordura_visceral, 1)} />
          <Linha label="Água corporal" valor={num(bio.bio_agua_corporal_percentual, 1, "%")} />
          <Linha label="Idade metabólica" valor={num(bio.bio_idade_metabolica, 0, " anos")} />
        </Secao>
      )}
    </div>
  );
}
