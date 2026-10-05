"use client";

import { useState, type ComponentType } from "react";
import { ArrowDownRight, ArrowUpRight, ClipboardList, Droplets, Dumbbell, Gauge, MoveVertical, Scale } from "lucide-react";

import {
  avaliacaoAtualEAnterior,
  diferenca,
  filtrarPorPeriodo,
  ordenarParaLista,
  PERIODO_PADRAO,
  PERIODOS,
  type Periodo,
} from "@/lib/anthropometry-overview";
import {
  indicadoresAtuais,
  itensDisponiveis,
  linhasAntropometria,
  type ChaveItem,
  type EntradaEvolucao,
  type LinhaAntropometria,
} from "@/lib/evolution";
import type { AnthropometricAssessment, AnthropometricAttachment, Sexo } from "@/lib/types/database.types";
import { cn, formatDate } from "@/lib/utils";

import { AnthropometryChart, COR_SERIE } from "@/components/patients/anthropometry-chart";
import { AnthropometryHistory } from "@/components/patients/anthropometry-history";
import { AnthropometryIndicators } from "@/components/patients/anthropometry-indicators";
import { EvolutionDialog } from "@/components/patients/evolution-dialog";
import { NewAssessmentMenu } from "@/components/patients/new-assessment-menu";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";

const fmt = (v: number, casas: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

interface DefResumo {
  chave: string;
  rotulo: string;
  icon: ComponentType<{ className?: string }>;
  /** Cor do ícone: a mesma da série no gráfico, quando a medida está nele. */
  cor?: string;
  casas: number;
  unidade: string;
  /** Unidade da diferença (% de gordura muda em pontos percentuais). */
  unidadeDiferenca: string;
  get: (l: LinhaAntropometria) => number | null;
}

const RESUMO: DefResumo[] = [
  { chave: "peso", rotulo: "Peso atual", icon: Scale, cor: COR_SERIE.peso, casas: 1, unidade: " kg", unidadeDiferenca: " kg", get: (l) => l.pesoKg },
  { chave: "altura", rotulo: "Altura", icon: MoveVertical, casas: 0, unidade: " cm", unidadeDiferenca: " cm", get: (l) => l.alturaCm },
  { chave: "imc", rotulo: "IMC atual", icon: Gauge, casas: 1, unidade: " kg/m²", unidadeDiferenca: "", get: (l) => l.imc },
  { chave: "gordura", rotulo: "% Gordura", icon: Droplets, cor: COR_SERIE.gordura, casas: 1, unidade: "%", unidadeDiferenca: " p.p.", get: (l) => l.percentualGordura },
  { chave: "mlg", rotulo: "Massa livre de gordura", icon: Dumbbell, cor: COR_SERIE.mlg, casas: 1, unidade: " kg", unidadeDiferenca: " kg", get: (l) => l.massaLivreKg },
];

/** Altura com casa decimal só quando tem (175 cm, 162,5 cm). */
const casasDe = (def: DefResumo, v: number) => (def.chave === "altura" && !Number.isInteger(v) ? 1 : def.casas);

function CartaoResumo({ def, atual, anterior }: { def: DefResumo; atual: LinhaAntropometria; anterior: LinhaAntropometria | null }) {
  const valor = def.get(atual)!;
  const casas = casasDe(def, valor);
  const valorAnterior = anterior ? def.get(anterior) : null;
  const dif = diferenca(valor, valorAnterior, casas);
  const Icon = def.icon;

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-4 shadow-sm">
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-success-soft text-primary"
        style={def.cor ? { color: def.cor, background: `color-mix(in srgb, ${def.cor} 12%, transparent)` } : undefined}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs leading-tight text-muted-foreground">{def.rotulo}</p>
        <p className="whitespace-nowrap text-xl font-bold tabular-nums tracking-tight text-foreground">
          {fmt(valor, casas)}
          <span className="text-base font-semibold">{def.unidade}</span>
        </p>
      </div>
      {/* Diferença em tom neutro: subir ou descer não é "bom" nem "ruim" por si. */}
      <div className="flex shrink-0 flex-col items-end gap-1.5 self-stretch justify-between text-right">
        <span
          className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-foreground"
          title={anterior ? `Avaliação anterior: ${formatDate(anterior.data)}` : undefined}
        >
          {dif === null ? (
            "—"
          ) : dif.sentido === "igual" ? (
            "="
          ) : (
            <>
              {dif.sentido === "subiu" ? (
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />
              )}
              <span className="sr-only">{dif.sentido === "subiu" ? "aumentou" : "diminuiu"}</span>
              {dif.sentido === "subiu" ? "+" : "−"}
              {fmt(dif.valor, casas)}
              {def.unidadeDiferenca}
            </>
          )}
        </span>
        <span className="text-[11px] leading-tight text-muted-foreground">
          {dif === null
            ? anterior
              ? "sem medida anterior"
              : "primeira avaliação"
            : dif.sentido === "igual"
              ? "sem alterações"
              : "vs. última avaliação"}
        </span>
      </div>
    </div>
  );
}

/**
 * Aba "Antropometria Geral" (Fase 19, layout de referência de 05/10/2026):
 * como o paciente está hoje (resumo + indicadores), como evoluiu (gráfico
 * por período) e quais avaliações foram feitas (histórico com ações).
 * Todos os números vêm de `linhasAntropometria`/`indicadoresAtuais`, os
 * mesmos cálculos da evolução e do relatório em PDF.
 */
export function AnthropometryPanel({
  patientId,
  sexo,
  dataNascimento,
  consentimentoAtivoExames,
  assessments,
  attachments,
  hoje,
}: {
  patientId: string;
  sexo: Sexo | null;
  dataNascimento: string | null;
  consentimentoAtivoExames: boolean;
  assessments: AnthropometricAssessment[];
  attachments: AnthropometricAttachment[];
  /** "yyyy-mm-dd" no fuso do Brasil, vindo do servidor (o filtro de período conta a partir daqui). */
  hoje: string;
}) {
  const [periodo, setPeriodo] = useState<Periodo>(PERIODO_PADRAO);
  const [evolucaoDe, setEvolucaoDe] = useState<ChaveItem | null>(null);

  const entrada: EntradaEvolucao = { assessments, attachments, sexo, dataNascimento };
  const linhas = linhasAntropometria(entrada);
  const itens = itensDisponiveis(entrada);
  const { atual, anterior } = avaliacaoAtualEAnterior(linhas);
  const avaliacaoAtual = atual ? assessments.find((a) => a.id === atual.id) ?? null : null;
  const indicadores = avaliacaoAtual ? indicadoresAtuais(entrada, avaliacaoAtual) : null;
  const noPeriodo = filtrarPorPeriodo(linhas, periodo, hoje);
  const temPontoNoGrafico = (l: LinhaAntropometria) =>
    l.pesoKg !== null || l.percentualGordura !== null || l.massaLivreKg !== null;
  const rotuloPeriodo = PERIODOS.find((p) => p.valor === periodo)!.rotulo;

  return (
    <Card>
      <CardContent className="space-y-5 p-4 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Antropometria Geral</h2>
            <p className="text-sm text-muted-foreground">
              Acompanhe a evolução da composição corporal e compare os resultados das avaliações.
            </p>
          </div>
          <NewAssessmentMenu
            patientId={patientId}
            dataNascimento={dataNascimento}
            consentimentoAtivoExames={consentimentoAtivoExames}
            rotuloCompleto
            size="lg"
          />
        </div>

        {linhas.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Nenhuma avaliação registrada"
            description="Registre a primeira avaliação antropométrica deste paciente. A evolução aparece aqui a partir dela."
          />
        ) : (
          <>
            {atual && (
              <section aria-label={`Resumo da avaliação de ${formatDate(atual.data)}`}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(13.5rem,1fr))]">
                  {RESUMO.filter((def) => def.get(atual) !== null).map((def) => (
                    <CartaoResumo key={def.chave} def={def} atual={atual} anterior={anterior} />
                  ))}
                </div>
              </section>
            )}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
              <section aria-labelledby="evolucao-composicao" className="min-w-0 space-y-4 rounded-xl border bg-card p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 id="evolucao-composicao" className="text-base font-semibold text-foreground">
                      Evolução da composição corporal
                    </h3>
                    <p className="text-sm text-muted-foreground">Acompanhe as principais medidas ao longo do tempo.</p>
                  </div>
                  <div role="group" aria-label="Período do gráfico" className="inline-flex shrink-0 self-start rounded-lg bg-muted p-0.5">
                    {PERIODOS.map((p) => (
                      <button
                        key={p.valor}
                        type="button"
                        aria-pressed={periodo === p.valor}
                        onClick={() => setPeriodo(p.valor)}
                        className={cn(
                          "rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          periodo === p.valor
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {p.rotulo}
                      </button>
                    ))}
                  </div>
                </div>
                {noPeriodo.some(temPontoNoGrafico) ? (
                  <AnthropometryChart linhas={noPeriodo} />
                ) : (
                  <div className="flex min-h-[12rem] flex-col items-center justify-center rounded-lg bg-muted/40 px-4 text-center">
                    <p className="text-sm font-medium text-foreground">
                      {periodo === "tudo" ? "Nenhuma medida para o gráfico" : `Nenhuma avaliação nos últimos ${rotuloPeriodo}`}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {periodo === "tudo"
                        ? "O gráfico usa peso, % de gordura e massa livre de gordura."
                        : "Escolha um período maior para ver as avaliações anteriores."}
                    </p>
                  </div>
                )}
              </section>

              <section aria-labelledby="avaliacoes-realizadas" className="min-w-0 space-y-3 rounded-xl border bg-card p-4 shadow-sm sm:p-5">
                <div>
                  <h3 id="avaliacoes-realizadas" className="text-base font-semibold text-foreground">
                    Avaliações realizadas
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Histórico de todas as avaliações antropométricas.
                  </p>
                </div>
                <AnthropometryHistory
                  patientId={patientId}
                  linhas={ordenarParaLista(linhas)}
                  atual={atual?.chave ?? null}
                  attachments={attachments}
                  onEvolucao={setEvolucaoDe}
                />
              </section>
            </div>

            {indicadores && atual && (
              <AnthropometryIndicators
                ind={indicadores}
                dataAvaliacao={formatDate(atual.data)}
                onVerTodas={() => setEvolucaoDe(atual.chave)}
              />
            )}
          </>
        )}
      </CardContent>

      {evolucaoDe && (
        <EvolutionDialog
          key={evolucaoDe}
          patientId={patientId}
          itens={itens}
          aPartirDe={evolucaoDe}
          open
          onOpenChange={(o) => !o && setEvolucaoDe(null)}
        />
      )}
    </Card>
  );
}
