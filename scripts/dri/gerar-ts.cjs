const fs = require('fs');
const d = require('./dri-extraido.json');
const linhas = d.linhas;
let s = '';
s += `/**
 * Ingestão diária de referência (DRI) — Fase 17, Bloco F.
 *
 * GERADO a partir das tabelas-resumo oficiais (National Academies of Sciences,
 * Engineering, and Medicine. Dietary Reference Intakes for Sodium and Potassium,
 * 2019 — Appendix J: "Dietary Reference Intakes Summary Tables",
 * doi:10.17226/25353), extraídas do texto da publicação, não digitadas à mão.
 * Ver docs/FASE_17_DRI.md. Não editar os números aqui sem conferir na fonte.
 *
 * Cada linha: [recomendação, tipo ("RDA" ou "AI"), limite superior tolerável (UL)].
 * Unidades iguais às colunas da TACO (mg, mcg, g). Cobre: µg/d da tabela → mg.
 * Fósforo UL: g/d da tabela → mg. UL de magnésio, niacina e da vitamina A em RAE
 * ficam de fora de propósito (valem só para suplemento/forma sintética ou só
 * para retinol pré-formado — este vai em retinol_mcg).
 */

/** Faixas de vida da tabela (bebês < 1 ano ficam de fora). c = criança, m = masculino, f = feminino, g = gestante, l = lactante. */
export const FASES_DA_VIDA = ${JSON.stringify(linhas)} as const;
export type FaseDaVida = (typeof FASES_DA_VIDA)[number];

export type TipoReferencia = "RDA" | "AI";
type Linha = readonly [number | null, TipoReferencia | null, number | null];

export const DRI = {
`;
for (const [k, v] of Object.entries(d.valores)) {
  s += `  ${k}: [\n`;
  v.forEach((x, i) => (s += `    [${x[0] ?? 'null'}, ${x[1] ? `"${x[1]}"` : 'null'}, ${x[2] ?? 'null'}], // ${linhas[i]}\n`));
  s += `  ],\n`;
}
s += `} as const satisfies Record<string, readonly Linha[]>;

export type NutrienteDri = keyof typeof DRI;
`;
fs.writeFileSync(process.argv[2], s);
console.log('ok', Object.keys(d.valores).length);
