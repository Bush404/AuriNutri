// Extrai das tabelas-resumo oficiais (NASEM 2019, Appendix J) os valores usados pelo AuriNutri.
const fs = require('fs');
const txt = fs.readFileSync('nap25353.txt', 'utf8').split('\n').filter((l) => l.trim()).join(' ').replace(/ \| /g, '|');
const LINHAS = ['i0', 'i7', 'c1', 'c4', 'm9', 'm14', 'm19', 'm31', 'm51', 'm70', 'f9', 'f14', 'f19', 'f31', 'f51', 'f70', 'g14', 'g19', 'g31', 'l14', 'l19', 'l31'];

function valores(trecho) {
  return trecho
    .split('|')
    .map((t) => t.trim())
    .filter((t) => /^(ND[a-z]?|\d[\d, ]*(\.\d+)?\*?[a-z]?)$/.test(t))
    .map((t) => (t.startsWith('ND') ? null : { v: Number(t.replace(/[^\d.]/g, '')), ai: t.includes('*') }));
}
function entre(ini, fim, aPartirDe = 0) {
  const a = txt.indexOf(ini, aPartirDe);
  const b = txt.indexOf(fim, a + ini.length);
  if (a < 0 || b < 0) throw new Error('não achei ' + ini);
  return { s: txt.slice(a + ini.length, b), fim: b };
}
function tabela(trecho, colunas) {
  const v = valores(trecho);
  if (v.length !== colunas.length * 22) throw new Error(`esperava ${colunas.length * 22}, veio ${v.length}: ${colunas}`);
  const out = {};
  colunas.forEach((c, j) => (out[c] = LINHAS.map((_, i) => v[i * colunas.length + j])));
  return out;
}

const vitA = entre('Recommended Dietary Allowances and Adequate Intakes, Vitamins  Food and Nutrition Board, National Academies  Life-Stage Group|', 'NOTES');
const vitB = entre('Choline (mg/d)g|', 'gAlthough', vitA.fim);
const eleA = entre('Recommended Dietary Allowances and Adequate Intakes, Elements  Food and Nutrition Board, National Academies  Life-Stage Group|', 'NOTES');
const eleB = entre('Chloride (g/d)|', 'aLife-stage', eleA.fim);
const mac = entre('Recommended Dietary Allowances and Adequate Intakes, Total Water and Macronutrients  Food and Nutrition Board, National Academies  Life-Stage Group|', 'NOTES');
const ulVA = entre('Tolerable Upper Intake Levels, Vitamins  Food and Nutrition Board, National Academies  Life-Stage Group|', 'NOTES');
const ulVB = entre('Carotenoidsd|', 'dG-Carotene', ulVA.fim);
const ulEA = entre('Tolerable Upper Intake Levels, Elements  Food and Nutrition Board, National Academies  Life-Stage Group|', 'NOTES');
const ulEB = entre('Chloride (g/d)|', 'based on adverse', ulEA.fim);

const t = {
  ...tabela(vitA.s.replace(/^.*?Thiamin \(mg\/d\)\|/, ''), ['vitA', 'vitC', 'vitD', 'vitE', 'vitK', 'tiamina']),
  ...tabela(vitB.s, ['riboflavina', 'niacina', 'b6', 'folato', 'b12', 'pantotenico', 'biotina', 'colina']),
  ...tabela(eleA.s.replace(/^.*?Magnesium \(mg\/d\)\|/, ''), ['calcio', 'cromo', 'cobre', 'fluor', 'iodo', 'ferro', 'magnesio']),
  ...tabela(eleB.s, ['manganes', 'molibdenio', 'fosforo', 'selenio', 'zinco', 'potassio', 'sodio', 'cloro']),
  ...tabela(mac.s.replace(/^.*?\(g\/d\)\|\s*Proteinb \(g\/d\)\|/, ''), ['agua', 'cho', 'fibra', 'gordura', 'linoleico', 'linolenico', 'proteina']),
};
const ul = {
  ...tabela(ulVA.s.replace(/^.*?Riboﬂavin\|/, ''), ['vitA', 'vitC', 'vitD', 'vitE', 'vitK', 'tiamina', 'riboflavina']),
  ...tabela(ulVB.s, ['niacina', 'b6', 'folato', 'b12', 'pantotenico', 'biotina', 'colina', 'carotenoides']),
  ...tabela(ulEA.s.replace(/^.*?Manganese \(mg\/d\)\|/, ''), ['arsenico', 'boro', 'calcio', 'cromo', 'cobre', 'fluor', 'iodo', 'ferro', 'magnesio', 'manganes']),
  ...tabela(ulEB.s, ['molibdenio', 'niquel', 'fosforo', 'potassio', 'selenio', 'silicio', 'sulfato', 'vanadio', 'zinco', 'sodio', 'cloro']),
};

// Recomendação (RDA ou AI) e limite (UL) dos nutrientes que a TACO traz.
const USAR = {
  calcio_mg: ['calcio', 1, 'calcio', 1],
  ferro_mg: ['ferro', 1, 'ferro', 1],
  magnesio_mg: ['magnesio', 1, null], // UL do magnésio vale só para suplemento/medicamento
  fosforo_mg: ['fosforo', 1, 'fosforo', 1000], // UL em g/d
  zinco_mg: ['zinco', 1, 'zinco', 1],
  cobre_mg: ['cobre', 0.001, 'cobre', 0.001], // µg/d → mg
  manganes_mg: ['manganes', 1, 'manganes', 1],
  potassio_mg: ['potassio', 1, null],
  sodio_mg: ['sodio', 1, null],
  rae_mcg: ['vitA', 1, null], // UL da vitamina A é só de retinol pré-formado (vai em retinol_mcg)
  retinol_mcg: [null, 1, 'vitA', 1],
  vitamina_c_mg: ['vitC', 1, 'vitC', 1],
  tiamina_mg: ['tiamina', 1, null],
  riboflavina_mg: ['riboflavina', 1, null],
  niacina_mg: ['niacina', 1, null], // UL da niacina vale só para forma sintética
  piridoxina_mg: ['b6', 1, 'b6', 1],
  fibras_g: ['fibra', 1, null],
};
const saida = {};
for (const [chave, [rec, fr, lim, fl]] of Object.entries(USAR)) {
  saida[chave] = LINHAS.slice(2).map((_, k) => {
    const i = k + 2;
    const r = rec ? t[rec][i] : null;
    const u = lim ? ul[lim][i] : null;
    return [r ? +(r.v * fr).toFixed(4) : null, r ? (r.ai ? 'AI' : 'RDA') : null, u ? +(u.v * fl).toFixed(4) : null];
  });
}
fs.writeFileSync('dri-extraido.json', JSON.stringify({ linhas: LINHAS.slice(2), valores: saida }, null, 0));
for (const k of Object.keys(saida)) console.log(k.padEnd(16), saida[k].slice(4, 6).map((x) => x.join('/')).join('  '), '| f19:', saida[k][10].join('/'));
