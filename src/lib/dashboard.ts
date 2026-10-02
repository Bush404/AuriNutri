import { sumCurrency } from "@/lib/finance";

/**
 * Tendências dos cards do painel (Fase 19): "+N este mês", "% em relação ao mês
 * anterior" e a minilinha dos últimos meses. Tudo derivado de datas já existentes
 * (created_at / data_pagamento) — nada novo é gravado.
 */

/** Chaves "aaaa-mm" dos últimos `n` meses, terminando no mês de `hojeStr` (aaaa-mm-dd). */
export function ultimosMeses(hojeStr: string, n: number): string[] {
  const [ano, mes] = hojeStr.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const total = ano * 12 + (mes - 1) - (n - 1 - i);
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
  });
}

/** Primeiro dia (aaaa-mm-01) do mês mais antigo da janela. */
export function inicioDaJanela(meses: string[]): string {
  return `${meses[0]}-01`;
}

/** Quantas datas (aaaa-mm-dd) caem no mês `chave`. */
export function contarNoMes(datas: string[], chave: string): number {
  return datas.filter((d) => d.slice(0, 7) === chave).length;
}

/**
 * Total acumulado ao fim de cada mês, a partir do total de hoje: no fim do mês M
 * havia `total` menos o que foi criado depois de M. Só precisa das datas recentes
 * (dentro da janela), não do histórico inteiro.
 */
export function serieAcumulada(totalAtual: number, datasCriacao: string[], meses: string[]): number[] {
  return meses.map((chave) => totalAtual - datasCriacao.filter((d) => d.slice(0, 7) > chave).length);
}

/** Soma de valores por mês (data aaaa-mm-dd), em centavos exatos. */
export function somaPorMes(linhas: { data: string | null; valor: number }[], meses: string[]): number[] {
  return meses.map((chave) =>
    sumCurrency(linhas.filter((l) => l.data !== null && l.data.slice(0, 7) === chave).map((l) => l.valor))
  );
}

/** Variação percentual inteira; null quando não há base de comparação. */
export function variacaoPercentual(atual: number, anterior: number): number | null {
  if (anterior <= 0) return null;
  return Math.round(((atual - anterior) / anterior) * 100);
}
