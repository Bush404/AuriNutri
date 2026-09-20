/**
 * Converte um valor em reais para texto por extenso em português — usado só
 * no Recibo (Fase 9, Bloco C). Isolado num módulo próprio porque é lógica de
 * formatação de texto, não cálculo financeiro (não pertence a
 * src/lib/finance.ts).
 *
 * Toda a conversão parte de CENTAVOS (inteiros), nunca de reais em ponto
 * flutuante — mesmo cuidado do resto do projeto com dinheiro.
 */

const UNIDADES = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const DEZ_A_DEZENOVE = [
  "dez",
  "onze",
  "doze",
  "treze",
  "catorze",
  "quinze",
  "dezesseis",
  "dezessete",
  "dezoito",
  "dezenove",
];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = [
  "",
  "cento",
  "duzentos",
  "trezentos",
  "quatrocentos",
  "quinhentos",
  "seiscentos",
  "setecentos",
  "oitocentos",
  "novecentos",
];

/** Um grupo de 1 a 999 por extenso — "cem" é caso especial (não "cento"). */
function grupoPorExtenso(n: number): string {
  if (n === 100) return "cem";

  const centena = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];

  if (centena > 0) partes.push(CENTENAS[centena]);

  if (resto > 0) {
    if (resto < 10) partes.push(UNIDADES[resto]);
    else if (resto < 20) partes.push(DEZ_A_DEZENOVE[resto - 10]);
    else {
      const dezena = Math.floor(resto / 10);
      const unidade = resto % 10;
      partes.push(unidade === 0 ? DEZENAS[dezena] : `${DEZENAS[dezena]} e ${UNIDADES[unidade]}`);
    }
  }

  return partes.join(" e ");
}

/**
 * Um número inteiro não-negativo por extenso, com milhar e milhão. Junta os
 * grupos (milhão / mil / centena-dezena-unidade) com ", " — exceto o último,
 * que usa " e " quando vale menos de 100 ou é uma centena exata (100, 200,
 * ..., 900), seguindo a convenção usual de extenso em português.
 */
function inteiroPorExtenso(n: number): string {
  if (n === 0) return "zero";

  const milhoes = Math.floor(n / 1_000_000);
  const milhares = Math.floor((n % 1_000_000) / 1000);
  const centena = n % 1000;

  const grupos: { valor: number; texto: string }[] = [];

  if (milhoes > 0) {
    grupos.push({ valor: milhoes, texto: milhoes === 1 ? "um milhão" : `${grupoPorExtenso(milhoes)} milhões` });
  }
  if (milhares > 0) {
    grupos.push({ valor: milhares, texto: milhares === 1 ? "mil" : `${grupoPorExtenso(milhares)} mil` });
  }
  if (centena > 0) {
    grupos.push({ valor: centena, texto: grupoPorExtenso(centena) });
  }

  if (grupos.length === 1) return grupos[0].texto;

  const ultimo = grupos[grupos.length - 1];
  const usaE = ultimo.valor < 100 || ultimo.valor % 100 === 0;
  const cabeca = grupos
    .slice(0, -1)
    .map((g) => g.texto)
    .join(", ");

  return usaE ? `${cabeca} e ${ultimo.texto}` : `${cabeca}, ${ultimo.texto}`;
}

/**
 * Valor em reais por extenso (ex.: 1234.56 → "mil, duzentos e trinta e
 * quatro reais e cinquenta e seis centavos"). Trata singular ("um real",
 * "um centavo") e nunca menciona centavos quando o valor é redondo. "de
 * reais" só quando o último grupo falado é milhão/milhões (ex.: "um milhão
 * de reais"), regra do português para esse caso específico.
 */
export function valorPorExtenso(valor: number): string {
  const totalCentavos = Math.round(valor * 100);
  const reais = Math.floor(totalCentavos / 100);
  const centavos = totalCentavos % 100;

  const milhoes = Math.floor(reais / 1_000_000);
  const ehSoMilhoes = milhoes > 0 && reais % 1_000_000 === 0;

  const parteReais =
    reais === 0 ? null : reais === 1 ? "um real" : `${inteiroPorExtenso(reais)} ${ehSoMilhoes ? "de reais" : "reais"}`;
  const parteCentavos = centavos === 0 ? null : centavos === 1 ? "um centavo" : `${inteiroPorExtenso(centavos)} centavos`;

  if (parteReais && parteCentavos) return `${parteReais} e ${parteCentavos}`;
  if (parteReais) return parteReais;
  if (parteCentavos) return parteCentavos;
  return "zero reais";
}
