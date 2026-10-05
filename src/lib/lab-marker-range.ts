/**
 * Barra da faixa de referência de um marcador (janela "Marcadores", Fase 19):
 * onde fica a faixa e onde cai o valor. Só posição na tela — o "fora da
 * faixa" é a mesma regra da coluna gerada do banco (migration 0020), repetida
 * aqui só para o rascunho que ainda não foi salvo.
 */

/** Mesma regra de lab_markers.fora_da_faixa (coluna gerada no banco). */
export function foraDaFaixa(valor: number, min: number | null, max: number | null): boolean {
  return (min !== null && valor < min) || (max !== null && valor > max);
}

/** "até 190 mg/dL", "entre 70 e 99 mg/dL", "a partir de 40 mg/dL" — ou null sem faixa. */
export function textoDaFaixa(min: number | null, max: number | null, unidade: string): string | null {
  const n = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
  const u = unidade ? ` ${unidade}` : "";
  if (min !== null && max !== null) return `entre ${n(min)} e ${n(max)}${u}`;
  if (max !== null) return `até ${n(max)}${u}`;
  if (min !== null) return `a partir de ${n(min)}${u}`;
  return null;
}

export interface EscalaDaFaixa {
  /** Início e fim da faixa de referência na barra (0 a 1). */
  faixaInicio: number;
  faixaFim: number;
  /** Posição do valor na barra (0 a 1), ou null sem valor. */
  valor: number | null;
  /** Rótulos embaixo da barra: os limites da faixa (e o 0 quando a faixa é "até"). */
  marcas: { posicao: number; rotulo: number }[];
}

/**
 * Escala da barra: a faixa ocupa o meio, com uma folga de cada lado; um
 * valor fora dela estica a escala para continuar visível. Faixa "até X"
 * começa no 0 (como a referência). Sem faixa nenhuma: null (não há barra).
 */
export function escalaDaFaixa(valor: number | null, min: number | null, max: number | null): EscalaDaFaixa | null {
  if (min === null && max === null) return null;

  let inicio: number;
  let fim: number;
  if (min !== null && max !== null) {
    const folga = (max - min) * 0.25 || Math.abs(max) * 0.25 || 1;
    inicio = min >= 0 ? Math.max(0, min - folga) : min - folga;
    fim = max + folga;
  } else if (max !== null) {
    inicio = Math.min(0, max);
    fim = max;
  } else {
    const folga = Math.abs(min!) * 0.5 || 1;
    inicio = min! >= 0 ? Math.max(0, min! - folga) : min! - folga;
    fim = min! + folga * 2;
  }
  if (valor !== null && Number.isFinite(valor)) {
    if (valor < inicio) inicio = valor - (fim - valor) * 0.05;
    if (valor > fim) fim = valor + (valor - inicio) * 0.05;
  }

  const pos = (v: number) => (fim === inicio ? 0.5 : Math.min(1, Math.max(0, (v - inicio) / (fim - inicio))));
  const marcas = [
    ...(min === null && max !== null && inicio === 0 ? [{ posicao: 0, rotulo: 0 }] : []),
    ...(min !== null ? [{ posicao: pos(min), rotulo: min }] : []),
    ...(max !== null ? [{ posicao: pos(max), rotulo: max }] : []),
  ];
  return {
    faixaInicio: min !== null ? pos(min) : 0,
    faixaFim: max !== null ? pos(max) : 1,
    valor: valor !== null && Number.isFinite(valor) ? pos(valor) : null,
    marcas,
  };
}
