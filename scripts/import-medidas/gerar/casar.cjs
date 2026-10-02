// Sugere, para cada alimento da TACO, o alimento (código + preparo) do IBGE com medidas caseiras.
const X = require('xlsx');
const fs = require('fs');

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const PARADAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'com', 'sem', 'a', 'o', 'tipo', 'etc', 'ou', 'na', 'no', 'para', 'qualquer']);
const raiz = (t) => t.replace(/(oes|aes)$/, 'ao').replace(/(ais)$/, 'al').replace(/s$/, '');
const tokens = (s) => norm(s).split(' ').filter((t) => t.length > 1 && !PARADAS.has(t)).map(raiz);

const wbT = X.read(fs.readFileSync(process.argv[2], 'utf8'), { type: 'string' });
const taco = X.utils.sheet_to_json(wbT.Sheets[wbT.SheetNames[0]]);
const comp = X.utils.sheet_to_json(X.readFile('comp/tabelacompleta.xls').Sheets['Tabela de Composição '], { header: 1 }).slice(4).filter((r) => r[0]);
const med = X.utils.sheet_to_json(X.readFile('med/tabelamedidas_bd.xls').Sheets['Tab_Medidas Caseiras'], { header: 1 }).slice(4).filter((r) => r[0]);

const chave = (c, p) => `${c}|${p}`;

/** "Arroz cozido - colher de arroz cheia" → "colher de arroz cheia"; Grama/Quilo/Mililitro ficam de fora. */
function nomeMedida(ref) {
  const s = String(ref ?? '').trim();
  if (/^(grama|quilo|mililitro|litro)$/i.test(s)) return null;
  const i = s.lastIndexOf(' - ');
  return (i >= 0 ? s.slice(i + 3) : s).trim().toLowerCase() || null;
}

const grupos = new Map();
for (const r of med) {
  const k = chave(r[0], r[2]);
  if (!grupos.has(k)) grupos.set(k, { codigo: r[0], desc: String(r[1]), prep: r[2], prepDesc: String(r[3]).replace('CROZIDO', 'COZIDO'), medidas: new Map(), refs: [] });
  grupos.get(k).refs.push(String(r[10] ?? ''));
  const nome = nomeMedida(r[10]);
  const g = Number(r[8]);
  if (nome && g > 0) grupos.get(k).medidas.set(`${nome}|${g}`, { nome, gramas: g, ref: String(r[10] ?? "") });
}
const refPor = new Map(comp.map((r) => [chave(r[0], r[2]), { ref: r[4], refDesc: String(r[5] ?? '') }]));

const PREP = { cru: 'CRU(A)', cozido: 'COZIDO(A)', frito: 'FRITO(A)', assado: 'ASSADO(A)', grelhado: 'GRELHADO(A)/BRASA/CHURRASCO', refogado: 'REFOGADO(A)', ensopado: 'ENSOPADO' };

const candidatos = [...grupos.values()]
  .filter((g) => g.medidas.size > 0)
  .map((g) => {
    const semParenteses = g.desc.replace(/\([^)]*\)/g, ' ');
    return { ...g, tkTodos: tokens(g.desc), tkPrincipais: tokens(semParenteses), ...refPor.get(chave(g.codigo, g.prep)) };
  });

const saida = [];
for (const t of taco) {
  const base = tokens(t.base);
  const qual = tokens(t.qualificadores);
  const prepTaco = norm(t.preparo).split(' ')[0];
  const tacoNome = norm(t.descricao);
  const pont = candidatos
    .map((c) => {
      let s = 0;
      if (c.ref === 2 && norm(c.refDesc).startsWith(tacoNome)) s += 8; // o IBGE cita este alimento da TACO
      const baseOk = base.filter((b) => c.tkTodos.includes(b)).length;
      if (baseOk < base.length) return { c, s: -1 };
      s += 4;
      // a base da TACO tem que ser o começo do nome principal do IBGE (evita "creme de arroz" para "arroz")
      if (c.tkPrincipais[0] === base[0]) s += 2;
      s += qual.filter((q) => c.tkTodos.includes(q)).length;
      s -= Math.max(0, c.tkPrincipais.length - base.length - qual.filter((q) => c.tkPrincipais.includes(q)).length) * 0.7;
      if (PREP[prepTaco] && c.prepDesc === PREP[prepTaco]) s += 2;
      else if (c.prepDesc === 'NAO SE APLICA') s += 1;
      else if (PREP[prepTaco]) s -= 1.5;
      s += Math.min(c.medidas.size, 6) * 0.1;
      return { c, s };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 3);
  saida.push({
    codigo_taco: Number(t.numero_alimento),
    taco: t.descricao,
    candidatos: pont.map(({ c, s }) => ({
      ibge: chave(c.codigo, c.prep),
      nome: `${c.desc} — ${c.prepDesc}`,
      score: Math.round(s * 10) / 10,
      medidas: [...c.medidas.values()].map((m) => `${m.nome} ${m.gramas}g`).join('; '),
    })),
  });
}
fs.writeFileSync('candidatos.json', JSON.stringify(saida, null, 1));
fs.writeFileSync('grupos.json', JSON.stringify(Object.fromEntries([...grupos].map(([k, g]) => [k, { nome: `${g.desc} — ${g.prepDesc}`, medidas: [...g.medidas.values()], refs: g.refs.join(' | ') }]))));
const comCand = saida.filter((s) => s.candidatos.length);
const fortes = comCand.filter((s) => s.candidatos[0].score >= 8 && (s.candidatos.length < 2 || s.candidatos[0].score - s.candidatos[1].score >= 1));
console.log('TACO', taco.length, '| com candidato', comCand.length, '| fortes', fortes.length, '| sem', saida.length - comCand.length);
