/**
 * Medidas caseiras da USDA → estilo das do IBGE ("xícara de chá", "colher de sopa",
 * "unidade média"), sempre para 1 medida (gramas ÷ quantidade).
 *
 * Só entram medidas que fazem sentido no Brasil: onça, libra, "fl oz", quart, polegada
 * cúbica, embalagens e latas de tamanho americano e "rendimento" ficam de fora (o
 * nutricionista usa gramas ou as medidas brasileiras). Medida de xícara com descrição
 * desconhecida também fica de fora, para não registrar gramas de outra coisa.
 */

const FORA =
  /\boz\b|\blb\b|fl oz|quart|pint|gallon|cubic inch|package|\bcan\b|container|nlea|yield|recipe|bottle|\bjar\b|\bbox\b|envelope|portion, amount|\bbird\b|\bchicken\b|\bduck\b|\bturkey\b|roast|\bunit\b|\bdash\b|\bpinch\b|\bdrop\b|\bmini\b|\bbag\b|\bpouch\b/;

/** Unidade (começo da descrição) → nome em português. Ordem importa. */
const UNIDADES = [
  [/^cups?\b/, "xícara de chá"],
  [/^(tbsp|tablespoons?)\b/, "colher de sopa"],
  [/^(tsp|teaspoons?)\b/, "colher de chá"],
  [/^slices?\b/, "fatia"],
  [/^pieces?\b/, "pedaço"],
  [/^fillets?\b/, "filé"],
  [/^servings?\b/, "porção"],
  [/^steaks?\b/, "bife"],
  [/^chops?\b/, "bisteca"],
  [/^extra large\b/, "unidade extragrande"],
  [/^medium\b/, "unidade média"],
  [/^large\b/, "unidade grande"],
  [/^small\b/, "unidade pequena"],
  [/^(cookies?|crackers?|muffins?|rolls?|bagels?|cakes?|fruits?|eggs?|buns?|biscuits?|doughnuts?|pancakes?|waffles?|tortillas?|olives?|nuts?|kernels?|berries|berry|pretzels?|cones?)\b/, "unidade"],
  [/^bars?\b/, "barra"],
  [/^links?\b/, "gomo"],
  [/^patty\b|^patties\b/, "hambúrguer"],
  [/^leaf\b|^leaves\b/, "folha"],
  [/^stalks?\b|^spears?\b/, "talo"],
  [/^heads?\b/, "cabeça"],
  [/^cloves?\b/, "dente"],
  [/^ears?\b/, "espiga"],
  [/^breasts?\b/, "peito"],
  [/^drumsticks?\b/, "coxa"],
  [/^thighs?\b/, "sobrecoxa"],
  [/^wings?\b/, "asa"],
  [/^strips?\b/, "tira"],
  [/^sticks?\b/, "palito"],
  [/^packets?\b/, "sachê"],
  [/^sprigs?\b/, "ramo"],
  [/^florets?\b/, "florete"],
  [/^half\b/, "metade"],
  [/^wedges?\b/, "gomo"],
];

/** Descrição depois da unidade (só para xícara, colheres e fatias) → complemento. */
const COMPLEMENTOS = [
  [/chopped or diced|chopped|diced/, "picado"],
  [/sliced|slices/, "fatiado"],
  [/shredded|grated/, "ralado"],
  [/mashed/, "amassado"],
  [/cubes|cubed/, "em cubos"],
  [/halves/, "em metades"],
  [/pieces/, "em pedaços"],
  [/crushed/, "triturado"],
  [/pitted/, "sem caroço"],
  [/packed/, "compactado"],
  [/ground/, "moído"],
  [/whole/, "inteiro"],
];

function quantidade(texto) {
  const m = texto.match(/^(\d+)\s*\/\s*(\d+)/) ?? null;
  if (m) return Number(m[1]) / Number(m[2]);
  const n = parseFloat(texto);
  return Number.isFinite(n) ? n : 1;
}

/** @returns {{ nome: string, gramas: number } | null} */
export function traduzirMedida(descricaoEn, gramas) {
  const texto = descricaoEn.trim().toLowerCase();
  if (!texto || !(gramas > 0) || FORA.test(texto)) return null;

  const qtd = quantidade(texto);
  if (!(qtd > 0)) return null;
  // Tira a quantidade e os tamanhos entre parênteses ("medium (2-1/4" dia)").
  const resto = texto
    .replace(/^[\d.\s/-]+/, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const unidade = UNIDADES.find(([re]) => re.test(resto));
  if (!unidade) return null;
  let nome = unidade[1];

  const depois = resto.replace(unidade[0], "").replace(/^[,\s]+/, "").trim();
  if (depois) {
    const ehVolume = /^(xícara|colher|fatia)/.test(nome);
    const complemento = COMPLEMENTOS.find(([re]) => re.test(depois));
    if (complemento) nome = `${nome} (${complemento[1]})`;
    else if (/with skin/.test(depois)) nome = `${nome} (com pele)`;
    else if (/without skin/.test(depois)) nome = `${nome} (sem pele)`;
    else if (/thin/.test(depois)) nome = `${nome} fina`;
    else if (/thick/.test(depois)) nome = `${nome} grossa`;
    // Xícara/colher de outra coisa ("cup penne") é medida de outro alimento: fora.
    else if (ehVolume && !/^(of|level|heaping|packed|fluid|whole|raw|cooked|unpacked)\b/.test(depois)) return null;
  }

  const porUnidade = Math.round((gramas / qtd) * 100) / 100;
  if (!(porUnidade > 0)) return null;
  return { nome, gramas: porUnidade };
}

/** Medidas de um alimento: traduzidas, sem nome repetido, no máximo 8. */
export function medidasDoAlimento(porcoes) {
  const vistas = new Set();
  const saida = [];
  for (const p of porcoes) {
    const m = traduzirMedida(p.descricao_en, p.gramas);
    if (!m || vistas.has(m.nome)) continue;
    vistas.add(m.nome);
    saida.push(m);
    if (saida.length === 8) break;
  }
  return saida;
}
