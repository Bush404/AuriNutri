/**
 * Aba "Antropometria Geral" (Fase 19): regras puras da tela — qual avaliação
 * é a "atual", a diferença para a anterior, o filtro de período do gráfico e
 * a escala visual das classificações. Nenhuma faixa clínica é definida aqui:
 * a escala é lida do próprio classificador que o sistema já usa.
 */

import type { Classificacao, Tom } from "@/lib/anthropometry";
import type { LinhaAntropometria } from "@/lib/evolution";

/** Tem algum número que a tela mostra? (avaliação aberta e deixada em branco não conta) */
export function temMedida(l: LinhaAntropometria) {
  return [l.pesoKg, l.alturaCm, l.imc, l.percentualGordura, l.massaLivreKg].some((v) => v !== null);
}

/**
 * A avaliação "atual" é a mais recente feita no AuriNutri COM PESO (uma
 * avaliação aberta e deixada só com a altura não toma o lugar da última de
 * verdade); a "anterior" é a imediatamente antes dela, também com peso. Sem
 * nenhuma com peso, vale a mais recente com alguma medida. Relatórios
 * externos ficam de fora do resumo (decisão de 05/10/2026).
 */
export function avaliacaoAtualEAnterior(linhas: LinhaAntropometria[]) {
  const avaliacoes = linhas.filter((l) => l.origem === "avaliacao");
  const comPeso = avaliacoes.filter((l) => l.pesoKg !== null);
  const base = comPeso.length ? comPeso : avaliacoes.filter(temMedida);
  return { atual: base[0] ?? null, anterior: base[1] ?? null };
}

export type Diferenca = { sentido: "subiu" | "desceu"; valor: number } | { sentido: "igual"; valor: 0 };

/**
 * Diferença atual − anterior, arredondada nas casas exibidas (assim nunca
 * aparece "↓ 0,0"). Nula quando falta um dos lados.
 */
export function diferenca(atual: number | null, anterior: number | null, casas: number): Diferenca | null {
  if (atual === null || anterior === null) return null;
  const f = 10 ** casas;
  const d = Math.round(atual * f) / f - Math.round(anterior * f) / f;
  const valor = Math.round(Math.abs(d) * f) / f;
  if (valor === 0) return { sentido: "igual", valor: 0 };
  return { sentido: d > 0 ? "subiu" : "desceu", valor };
}

export const PERIODOS = [
  { valor: "3m", rotulo: "3 meses", meses: 3 },
  { valor: "6m", rotulo: "6 meses", meses: 6 },
  { valor: "1a", rotulo: "1 ano", meses: 12 },
  { valor: "tudo", rotulo: "Tudo", meses: null },
] as const;

export type Periodo = (typeof PERIODOS)[number]["valor"];

export const PERIODO_PADRAO: Periodo = "6m";

/** "yyyy-mm-dd" de `meses` atrás (o dia é limitado ao último do mês: 31/03 − 1 mês = 28 ou 29/02). */
export function inicioDoPeriodo(hoje: string, meses: number): string {
  const [ano, mes, dia] = hoje.split("-").map(Number);
  const alvo = new Date(Date.UTC(ano, mes - 1 - meses, 1));
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(dia, ultimoDia));
  return alvo.toISOString().slice(0, 10);
}

/** Itens dentro do período (inclusive o primeiro dia), contando a partir de hoje. */
export function filtrarPorPeriodo<T extends { data: string }>(itens: T[], periodo: Periodo, hoje: string): T[] {
  const meses = PERIODOS.find((p) => p.valor === periodo)?.meses ?? null;
  if (meses === null) return itens;
  const inicio = inicioDoPeriodo(hoje, meses);
  return itens.filter((i) => i.data >= inicio && i.data <= hoje);
}

// ---------------------------------------------------------------------------
// Escala visual de uma classificação
// ---------------------------------------------------------------------------

export interface FaixaEscala {
  /** Início da faixa (o fim é o início da próxima, ou `max`). */
  de: number;
  ate: number;
  label: string;
  tom: Tom;
}

/**
 * Lê as faixas do classificador percorrendo [min, max] de `passo` em `passo`:
 * onde o rótulo muda, começa outra faixa. Os limites saem da regra real —
 * mudar o classificador muda a escala junto. `min`/`max` são só o recorte
 * visual. Faixas vizinhas com o mesmo rótulo viram uma só.
 */
export function faixasDoClassificador(
  classificar: (valor: number) => Classificacao,
  min: number,
  max: number,
  passo: number,
): FaixaEscala[] {
  const faixas: FaixaEscala[] = [];
  const casas = Math.max(0, -Math.floor(Math.log10(passo)));
  const n = Math.round((max - min) / passo);
  for (let i = 0; i <= n; i++) {
    const v = Number((min + i * passo).toFixed(casas));
    const c = classificar(v);
    const ultima = faixas[faixas.length - 1];
    if (ultima && ultima.label === c.label) {
      ultima.ate = v;
    } else {
      if (ultima) ultima.ate = v;
      faixas.push({ de: v, ate: v, label: c.label, tom: c.tom });
    }
  }
  return faixas;
}

/** Posição (0 a 1) de um valor no recorte da escala; fora dele, cola na ponta. */
export function posicaoNaEscala(valor: number, min: number, max: number) {
  if (max <= min) return 0.5;
  return Math.min(1, Math.max(0, (valor - min) / (max - min)));
}

// ---------------------------------------------------------------------------
// Eixos do gráfico
// ---------------------------------------------------------------------------

/** Marcas "redondas" (1, 2, 5 × 10ⁿ) que cobrem [min, max], com folga. */
export function marcasDoEixo(min: number, max: number, alvo = 4): number[] {
  if (min === max) {
    const folga = Math.abs(min) * 0.1 || 1;
    min -= folga;
    max += folga;
  }
  const bruto = (max - min) / alvo;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 5, 10].map((m) => m * potencia).find((p) => p >= bruto) ?? 10 * potencia;
  const inicio = Math.floor(min / passo) * passo;
  const fim = Math.ceil(max / passo) * passo;
  const marcas: number[] = [];
  for (let v = inicio; v <= fim + passo / 2; v += passo) marcas.push(Number(v.toFixed(6)));
  return marcas;
}

/**
 * Marcas do segundo eixo (direita) na MESMA quantidade do primeiro, para as
 * linhas de grade servirem aos dois: passo redondo que cubra [min, max] em
 * `quantidade − 1` intervalos.
 */
export function marcasAlinhadas(min: number, max: number, quantidade: number): number[] {
  const intervalos = Math.max(1, quantidade - 1);
  if (min === max) {
    const folga = Math.abs(min) * 0.1 || 1;
    min -= folga;
    max += folga;
  }
  const bruto = (max - min) / intervalos;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  for (const p of [1, 2, 2.5, 5, 10, 20, 25, 50, 100].map((m) => m * potencia)) {
    const inicio = Math.floor(min / p) * p;
    if (inicio + p * intervalos >= max) {
      return Array.from({ length: intervalos + 1 }, (_, i) => Number((inicio + i * p).toFixed(6)));
    }
  }
  return marcasDoEixo(min, max, intervalos);
}

/**
 * Faixa do eixo da % de gordura com a MESMA folga relativa do eixo de kg:
 * se o eixo de kg cobre ±X% em volta do meio, o de % também — assim a mesma
 * variação relativa tem a mesma inclinação nas duas escalas, e 2 pontos de
 * gordura não parecem a maior mudança do gráfico (ajuste de 05/10/2026).
 * Nunca abaixo de 0% nem acima de 100%.
 */
export function faixaProporcional(min: number, max: number, kgMin: number, kgMax: number): [number, number] {
  const meioKg = (kgMin + kgMax) / 2;
  const relativa = meioKg > 0 ? (kgMax - kgMin) / meioKg : 0;
  const meio = (min + max) / 2;
  const span = Math.max(max - min, meio * relativa);
  let ini = meio - span / 2;
  let fim = meio + span / 2;
  if (ini < 0) [ini, fim] = [0, fim - ini];
  if (fim > 100) [ini, fim] = [Math.max(0, ini - (fim - 100)), 100];
  return [ini, fim];
}

/** Ordem da lista: mais recente primeiro; na mesma data, a que tem medidas vem antes da em branco. */
export function ordenarParaLista(linhas: LinhaAntropometria[]): LinhaAntropometria[] {
  return linhas
    .map((l, i) => ({ l, i }))
    .sort((a, b) => b.l.data.localeCompare(a.l.data) || Number(temMedida(b.l)) - Number(temMedida(a.l)) || a.i - b.i)
    .map(({ l }) => l);
}
