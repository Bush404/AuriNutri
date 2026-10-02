// Aplica a revisão manual e gera o arquivo de ligação TACO → medidas do IBGE.
const fs = require('fs');
const decisao = require('./decisao.json');
const grupos = require('./grupos.json');

// Revisão manual (02/10/2026): ligações aceitas pela regra, mas erradas para o produto.
const REJEITAR = new Set([2, 4, 6, 11, 12, 19, 55, 57, 104, 141, 324, 330, 331, 387, 395, 415, 416, 417, 478, 486, 487, 575, 591]);
const TROCAR = { 9: '8004801|99', 10: '8004801|99', 99: '8002212|99', 489: null /* = mesmo grupo do 488 */ };
const porCodigo = new Map(decisao.map((d) => [d.codigo_taco, d]));
TROCAR[489] = porCodigo.get(488).ibge;

const CORRIGIR = [
  [/^[a-zà-ú ]+ ?-\s?(?=\d|\w)/i, ''], // "abacate -1/2 unidade" → "1/2 unidade"
  [/\bmédo\b/g, 'médio'],
  [/\bescumadeia\b/g, 'escumadeira'],
  [/\s+/g, ' '],
];
const DESCARTAR = /^se a medida|barra de cereal|^bolo |^biscoito |^pão /i;

function limparNome(nome, alimento) {
  let n = nome;
  // remove o nome do próprio alimento grudado no começo ("quindim- unidade pequena")
  const primeira = alimento.split(',')[0].toLowerCase();
  if (n.startsWith(primeira)) n = n.slice(primeira.length).replace(/^[\s\-–]+/, '');
  for (const [re, por] of CORRIGIR) n = n.replace(re, por);
  return n.trim();
}

const saida = [];
for (const d of decisao) {
  if (REJEITAR.has(d.codigo_taco)) continue;
  const chave = TROCAR[d.codigo_taco] ?? d.ibge;
  if (!chave) continue;
  const g = grupos[chave];
  const medidasBase = TROCAR[d.codigo_taco] ? g.medidas : d.medidas;
  const vistas = new Set();
  const medidas = medidasBase
    .map((m) => ({ nome: limparNome(m.nome, d.taco), gramas: Math.round(m.gramas * 10) / 10 }))
    .filter((m) => m.nome && !DESCARTAR.test(m.nome) && m.gramas > 0)
    .filter((m) => (vistas.has(`${m.nome}|${m.gramas}`) ? false : vistas.add(`${m.nome}|${m.gramas}`)))
    .sort((a, b) => a.gramas - b.gramas);
  if (!medidas.length) continue;
  saida.push({ codigo_taco: d.codigo_taco, taco: d.taco, ibge: chave, ibge_nome: g.nome, medidas });
}
fs.writeFileSync(process.argv[2], JSON.stringify(saida, null, 1) + '\n');
console.log('alimentos da TACO com medidas:', saida.length, '| medidas:', saida.reduce((s, x) => s + x.medidas.length, 0));
for (const c of [3, 9, 53, 163, 444, 489, 509]) {
  const x = saida.find((s) => s.codigo_taco === c);
  console.log(c, x ? `${x.taco} => ${x.medidas.slice(0, 4).map((m) => `${m.nome} ${m.gramas}g`).join('; ')}` : 'sem medidas');
}
