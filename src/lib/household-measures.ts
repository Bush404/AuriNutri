/**
 * Medidas caseiras (Fase 17, Bloco D): escolha da medida usual de um alimento
 * e o texto "1 unidade média (50 g)" usado na tela e no PDF. Funções puras —
 * as medidas vêm de `food_measures` (IBGE ou do profissional) e, no item do
 * plano, da cópia gravada em medida_nome/medida_gramas/medida_quantidade.
 */

export interface MedidaBasica {
  nome: string;
  gramas: number;
  fonte?: "ibge" | "personalizado";
}

// Ordem de preferência para a medida que já vem escolhida ao adicionar o alimento.
const PREFERIDAS = [
  /^unidade média$/,
  /^unidade$/,
  /^fatia média$/,
  /^fatia$/,
  /^colher de sopa cheia$/,
  /^colher de servir/,
  /^escumadeira/,
  /^concha média/,
  /^pedaço médio/,
  /^copo/,
  /^xícara/,
  /^unidade/,
  /^porção guia alimentar$/,
];

/**
 * A medida que já vem escolhida ao adicionar o alimento: a última criada pelo
 * profissional, se houver; senão a mais comum do IBGE pela ordem acima; senão
 * a primeira que não seja fração ("1/2 unidade").
 */
export function medidaUsual<T extends MedidaBasica>(medidas: T[]): T | null {
  if (medidas.length === 0) return null;
  const proprias = medidas.filter((m) => m.fonte === "personalizado");
  if (proprias.length) return proprias[proprias.length - 1];
  for (const re of PREFERIDAS) {
    const achada = medidas.find((m) => re.test(m.nome));
    if (achada) return achada;
  }
  return medidas.find((m) => !/^\d+\/\d+/.test(m.nome)) ?? medidas[0];
}

const numero = (v: number, casas = 2) => v.toLocaleString("pt-BR", { maximumFractionDigits: casas });

/**
 * "1 unidade média (50 g)", "2 × colher de sopa cheia (50 g)", "1/2 unidade (25 g)".
 * O "×" evita ler "2 1/2 unidade" como duas unidades e meia.
 */
export function formatarMedida(quantidade: number, nome: string, gramasPorMedida: number): string {
  const gramas = numero(Math.round(quantidade * gramasPorMedida * 10) / 10, 1);
  const comecaComNumero = /^\d/.test(nome);
  if (quantidade === 1) return `${comecaComNumero ? "" : "1 "}${nome} (${gramas} g)`;
  return `${numero(quantidade)} × ${nome} (${gramas} g)`;
}

/** Quantidade de um item como vai no PDF e na lista: em medida caseira, se houver; senão em gramas. */
export function quantidadeDoItem(item: {
  quantidade_g: number;
  medida_nome?: string | null;
  medida_gramas?: number | null;
  medida_quantidade?: number | null;
}): string {
  if (item.medida_nome && item.medida_gramas && item.medida_quantidade) {
    return formatarMedida(Number(item.medida_quantidade), item.medida_nome, Number(item.medida_gramas));
  }
  return `${numero(Number(item.quantidade_g), 1)} g`;
}
