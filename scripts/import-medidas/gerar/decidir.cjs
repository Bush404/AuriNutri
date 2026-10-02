// Decide a ligação TACO → IBGE de forma conservadora e filtra as medidas pelo estado (cru x preparado).
const fs = require('fs');
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const raiz = (t) => t.replace(/(oes|aes)$/, 'ao').replace(/(ais)$/, 'al').replace(/s$/, '');
const PARADAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'com', 'sem', 'a', 'o', 'tipo', 'etc', 'ou', 'na', 'no', 'para', 'qualquer']);
const tokens = (s) => norm(s).split(' ').filter((t) => t.length > 1 && !PARADAS.has(t)).map(raiz);

const cands = require('./candidatos.json');
const grupos = require('./grupos.json');

// Palavras que mudam o PRODUTO: se a TACO tem, o nome do IBGE também precisa ter.
const FORMA = new Set(['extrato', 'molho', 'pure', 'polpa', 'suco', 'doce', 'calda', 'farofa', 'conserva', 'enlatado', 'enlatada', 'desidratado', 'desidratada', 'po', 'farinha', 'floco', 'mingau', 'mistura', 'barra', 'pasta', 'geleia', 'amido', 'fuba', 'fecula', 'creme', 'oleo', 'leite', 'queijo', 'integral', 'light', 'diet', 'concentrado', 'xarope', 'seco', 'seca', 'cristalizado', 'cristalizada', 'massa', 'broto', 'semente', 'castanha', 'bebida', 'iogurte', 'requeijao', 'manteiga', 'margarina', 'linguica', 'salsicha', 'mortadela', 'presunto', 'apresuntado', 'salame', 'bacon', 'hamburguer', 'nugget', 'empanado', 'defumado', 'defumada', 'salgado', 'salgada']);
// Palavras do IBGE que indicam outro produto quando a TACO não tem.
const OUTRO = new Set(['suco', 'vitamina', 'molho', 'conserva', 'doce', 'bolo', 'pao', 'biscoito', 'mingau', 'pastel', 'torta', 'salada', 'sopa', 'caldo', 'creme', 'pure', 'farofa', 'integral', 'light', 'diet', 'organico', 'organica', 'aguardente', 'licor', 'geleia', 'sorvete', 'pudim', 'refresco', 'bebida', 'granola', 'farinha', 'po', 'extrato', 'polpa']);

const PREPARADO = /\b(cozid|frit|assad|grelhad|refogad|ensopad|torrad|empanad)/;
const CRU = /\bcru(a|s|as)?\b/;

const decisao = [];
for (const x of cands) {
  const tacoTk = new Set(tokens(x.taco));
  const tacoCru = CRU.test(norm(x.taco));
  const tacoPreparado = PREPARADO.test(norm(x.taco));
  let escolhido = null;
  let motivo = 'sem candidato';
  for (const c of x.candidatos) {
    const ibgeTk = new Set(tokens(c.nome.split(' — ')[0]));
    const ibgePrincipal = tokens(c.nome.split(' — ')[0].replace(/\([^)]*\)/g, ' '));
    const base = tokens(x.taco.split(',')[0]);
    if (c.score < 7) { motivo = 'pontuação baixa'; continue; }
    if (ibgePrincipal[0] !== base[0]) { motivo = 'nome base diferente'; continue; }
    const formaFaltando = [...tacoTk].filter((t) => FORMA.has(t) && !ibgeTk.has(t));
    if (formaFaltando.length) { motivo = `produto diferente (${formaFaltando.join(', ')})`; continue; }
    const outro = [...ibgeTk].filter((t) => OUTRO.has(t) && !tacoTk.has(t));
    if (outro.length) { motivo = `IBGE é outro produto (${outro.join(', ')})`; continue; }
    // Medidas compatíveis com o estado do alimento da TACO.
    const medidas = grupos[c.ibge].medidas.filter((m) => {
      const n = norm(m.ref ?? m.nome);
      if (tacoCru && PREPARADO.test(n)) return false;
      if (tacoPreparado && CRU.test(n)) return false;
      return true;
    });
    if (!medidas.length) { motivo = 'nenhuma medida no mesmo estado (cru/preparado)'; continue; }
    escolhido = { ibge: c.ibge, nome: c.nome, medidas };
    motivo = 'ok';
    break;
  }
  decisao.push({ codigo_taco: x.codigo_taco, taco: x.taco, ...(escolhido ?? {}), motivo });
}
fs.writeFileSync('decisao.json', JSON.stringify(decisao, null, 1));
const ok = decisao.filter((d) => d.ibge);
console.log('ligados', ok.length, 'de', decisao.length);
const porMotivo = {};
decisao.filter((d) => !d.ibge).forEach((d) => (porMotivo[d.motivo.split(' (')[0]] = (porMotivo[d.motivo.split(' (')[0]] || 0) + 1));
console.log(porMotivo);
