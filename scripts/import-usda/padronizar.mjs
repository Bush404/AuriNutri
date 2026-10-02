/**
 * Padroniza os nomes da USDA no jeito brasileiro e no modelo da TACO (pedido da
 * nutricionista em 02/10/2026: "só traduzir causa confusão").
 *
 *   Carnes:  "Carne, bovina, contra-filé, sem gordura, grelhado"  /  "Porco, lombo, assado"
 *   Aves:    "Frango, peito, sem pele, grelhado"
 *   Leite:   "Leite, de vaca, integral"   Ovo: "Ovo, de galinha, inteiro, cozido"
 *   Demais:  o nome traduzido (montar-nome.mjs), limpo dos termos que confundem e com o
 *            preparo no vocabulário da TACO (cru, cozido, assado, grelhado, frito).
 *
 * Variações americanas que viram o mesmo alimento (graus da carne, aparagem, importada,
 * com/sem sal, com/sem vitamina A e D...) são juntadas em uma só — ver escolherRepresentantes().
 * Corte americano sem equivalente no Brasil fica com o nome americano.
 */
import { montarNome } from "./montar-nome.mjs";

// ---------------------------------------------------------------- preparo
/** Preparo no vocabulário da TACO, com concordância. null = sem preparo indicado. */
function preparo(en, genero) {
  const t = en.toLowerCase();
  const f = genero === "f";
  const g = (m, fem) => (f ? fem : m);
  if (/\braw\b|uncooked/.test(t)) return g("cru", "crua");
  if (/breaded|batter|flour.*fried|fried.*flour/.test(t) && /fried/.test(t)) return g("empanado, frito", "empanada, frita");
  if (/fried|deep-fried/.test(t)) return g("frito", "frita");
  if (/grilled|broiled|pan-broil/.test(t)) return g("grelhado", "grelhada");
  if (/roasted|baked|dry heat|rotisserie/.test(t)) return g("assado", "assada");
  if (/braised|simmered|stewed|boiled|moist heat|steamed|microwaved|cooked/.test(t)) return g("cozido", "cozida");
  if (/heated/.test(t)) return g("aquecido", "aquecida");
  return null;
}

function gorduraDaCarne(en) {
  if (/separable lean and fat|lean and fat/i.test(en)) return "com gordura";
  if (/separable lean only|lean only/i.test(en)) return "sem gordura";
  return null;
}

const MIUDOS = [
  [/\bliver\b/i, "fígado", "m"],
  [/\btongue\b/i, "língua", "f"],
  [/\bheart\b/i, "coração", "m"],
  [/\bkidneys?\b/i, "rim", "m"],
  [/\btripe\b/i, "bucho", "m"],
  [/\bbrains?\b/i, "miolo", "m"],
  [/thymus|sweetbread/i, "moleja", "f"],
  [/\blungs\b/i, "pulmão", "m"],
  [/\bspleen\b/i, "baço", "m"],
  [/\bpancreas\b/i, "pâncreas", "m"],
  [/\bsuet\b/i, "sebo", "m"],
  [/\btail\b/i, "rabo", "m"],
  [/\bfeet\b/i, "pé", "m"],
  [/\bears\b/i, "orelha", "f"],
  [/\bjowl\b/i, "papada", "f"],
  [/\bstomach\b/i, "estômago", "m"],
  [/chitterlings/i, "tripa", "f"],
  [/\btestes\b/i, "testículo", "m"],
];

/** Corte → [nome brasileiro (ou americano, se não houver), gênero]. Ordem importa. */
const CORTES_BOVINOS = [
  [/top sirloin cap/i, "picanha", "f"],
  [/ribeye cap/i, "capa de contra-filé", "f"],
  [/tri-tip/i, "maminha", "f"],
  [/porterhouse/i, "porterhouse", "m"],
  [/t-bone/i, "T-bone", "m"],
  [/tenderloin/i, "filé-mignon", "m"],
  [/rib ?eye|ribeye|cube roll/i, "contra-filé de costela", "m"],
  [/top loin|short loin|strip ?loin|strip steak/i, "contra-filé", "m"],
  [/bottom sirloin butt/i, "bottom sirloin", "m"],
  [/bottom sirloin|flap/i, "fraldinha", "f"],
  [/top sirloin|sirloin|rump/i, "miolo de alcatra", "m"],
  [/\binside\b/i, "coxão mole", "m"],
  [/ribs prepared/i, "costela", "f"],
  [/flank/i, "flanco", "m"],
  [/skirt/i, "skirt", "m"],
  [/brisket/i, "peito", "m"],
  [/eye of round|eye round/i, "lagarto", "m"],
  [/bottom round|outside round|\bflat\b/i, "coxão duro", "m"],
  [/top round|inside round/i, "coxão mole", "m"],
  [/tip round|round tip|knuckle|tip center|tip side/i, "patinho", "m"],
  [/\bround\b/i, "coxão", "m"],
  [/shank|shin/i, "músculo", "m"],
  [/plate/i, "ponta de agulha", "f"],
  [/short ribs|back ?ribs|\brib\b/i, "costela", "f"],
  [/shoulder top blade|top blade|mock tender|clod|shoulder|\barm\b|petite tender/i, "paleta", "f"],
  [/chuck|blade|denver/i, "acém", "m"],
];

const CORTES_SUINOS = [
  [/tenderloin/i, "filé-mignon", "m"],
  [/leg cap|sirloin tip/i, "pernil", "m"],
  [/shoulder breast/i, "paleta", "f"],
  [/spare ?ribs|back ?ribs|country-style ribs|\bribs\b/i, "costela", "f"],
  [/belly/i, "barriga", "f"],
  [/backfat/i, "toucinho", "m"],
  [/\bchops?\b|\(chops/i, "bisteca", "f"],
  [/\bloin\b/i, "lombo", "m"],
  [/shoulder|boston|blade|picnic|petite tender/i, "paleta", "f"],
  [/\bleg\b|\bham\b/i, "pernil", "m"],
];

const CORTES_CORDEIRO = [
  [/tenderloin/i, "filé-mignon", "m"],
  [/\bflap\b/i, "fraldinha", "f"],
  [/chump|rump/i, "garupa", "f"],
  [/breast/i, "peito", "m"],
  [/\bleg\b|sirloin/i, "pernil", "m"],
  [/\brack\b|\brib\b/i, "carré", "m"],
  [/\bloin\b/i, "lombo", "m"],
  [/shoulder|\barm\b|blade/i, "paleta", "f"],
  [/shank/i, "músculo", "m"],
  [/\bneck\b/i, "pescoço", "m"],
  [/cubed/i, "em cubos", "m"],
];

const CORTES_VITELA = [
  [/breast/i, "peito", "m"],
  [/top round|\bleg\b/i, "coxão mole", "m"],
  [/sirloin/i, "alcatra", "f"],
  [/\bloin\b/i, "lombo", "m"],
  [/\brib\b/i, "costela", "f"],
  [/shoulder|\barm\b|blade/i, "paleta", "f"],
  [/shank/i, "músculo", "m"],
  [/cubed/i, "em cubos", "m"],
];

function acharCorte(en, tabela) {
  for (const [re, nome, genero] of tabela) if (re.test(en)) return [nome, genero];
  return null;
}

/** Carne vermelha: "<cabeça>, <corte>, <com/sem gordura>, <preparo>". null se não encaixar. */
function carneVermelha(en, cabeca, cortes, generoMoida = "f") {
  if (/separable fat|composite of|retail cuts|carcass|rendered fat|\bfat\b only|seam fat|external fat|intermuscular|subcutaneous|mechanically|manufacturing beef/i.test(en))
    return { excluir: true };
  // Miúdos valem sempre que o termo aparecer (nem todos vêm com "variety meats").
  const miudo = acharCorte(en, MIUDOS);
  if (miudo || /variety meats|by-products/i.test(en)) {
    if (!miudo) return null;
    return { nome: [cabeca, miudo[0], preparo(en, miudo[1])].filter(Boolean).join(", ") };
  }
  if (/\bground\b|patties|\bpatty\b|hamburger/i.test(en)) {
    const pct = en.match(/(\d+)% lean meat ?\/ ?(\d+)% fat/i) ?? en.match(/(\d+)% lean ?\/ ?(\d+)% fat/i);
    const hamburguer = /patt/i.test(en);
    const moida = generoMoida === "f" ? "moída" : "moído";
    const partes = [cabeca, hamburguer ? "hambúrguer" : moida, pct ? `${pct[2]}% de gordura` : null, preparo(en, hamburguer ? "m" : generoMoida)];
    return { nome: partes.filter(Boolean).join(", ") };
  }
  const corte = acharCorte(en, cortes);
  if (!corte) return null;
  return { nome: [cabeca, corte[0], gorduraDaCarne(en), preparo(en, corte[1])].filter(Boolean).join(", ") };
}

// ---------------------------------------------------------------- aves
const AVES = [
  [/^Chicken, stewing/i, "Galinha"],
  [/^Chicken, capons/i, "Capão"],
  [/^Chicken, cornish game hens/i, "Galeto"],
  [/^Chicken,/i, "Frango"],
  [/^Turkey\b/i, "Peru"],
  [/^Duck,/i, "Pato"],
  [/^Goose,/i, "Ganso"],
  [/^Quail,/i, "Codorna"],
  [/^Pheasant,/i, "Faisão"],
  [/^Squab/i, "Pombo"],
  [/^Guinea hen/i, "Galinha-d'angola"],
];

const PARTES_AVE = [
  [/giblets/i, "miúdos", "m"],
  [/\bliver\b/i, "fígado", "m"],
  [/\bheart\b/i, "coração", "m"],
  [/gizzard/i, "moela", "f"],
  [/\bfeet\b/i, "pé", "m"],
  [/skin only|\bskin \(/i, "pele", "f"],
  [/breast/i, "peito", "m"],
  [/drumstick/i, "coxa", "f"],
  [/thigh/i, "sobrecoxa", "f"],
  [/\bwing\b/i, "asa", "f"],
  [/\bback\b/i, "dorso", "m"],
  [/\bneck\b/i, "pescoço", "m"],
  [/\bleg\b/i, "coxa e sobrecoxa", "f"],
  [/light meat/i, "carne branca", "f"],
  [/dark meat/i, "carne escura", "f"],
  [/\bground\b/i, "moído", "m"],
];

function ave(en) {
  const animal = AVES.find(([re]) => re.test(en))?.[1];
  if (!animal) return null;
  if (/meatless/i.test(en)) return { nome: "Substituto de frango, vegetariano" };
  if (/separable fat|\bfat\b,|mechanically/i.test(en)) return { excluir: true };
  if (/canned|nuggets|breaded tenders|\broll\b|\bloaf\b|\bsticks\b|salad|spread|gravy|deli|luncheon|smoked|pre-basted|seasoned/i.test(en)) return null;
  if (/\bground\b/i.test(en)) {
    const pct = en.match(/(\d+)% lean ?\/ ?(\d+)% fat/i);
    const hamburguer = /patt/i.test(en);
    const partes = [animal, hamburguer ? "hambúrguer" : "moído", pct ? `${pct[2]}% de gordura` : null, preparo(en, "m")];
    return { nome: partes.filter(Boolean).join(", ") };
  }
  const inteiroComMiudos = /meat and skin and giblets and neck/i.test(en);
  const parte = inteiroComMiudos ? [null, "inteiro", "m"] : PARTES_AVE.find(([re]) => re.test(en)) ?? [null, "inteiro", "m"];
  let pele = null;
  if (/meat and skin and giblets and neck/i.test(en)) pele = "com pele e miúdos";
  else if (/meat and skin|with skin/i.test(en)) pele = "com pele";
  else if (/meat only|without skin|skinless/i.test(en)) pele = "sem pele";
  return { nome: [animal, parte[1], pele, preparo(en, parte[2])].filter(Boolean).join(", ") };
}

// ---------------------------------------------------------------- leite, iogurte, ovo
function tipoDeLeite(en) {
  if (/\bwhole\b|3\.25%|3\.7%/i.test(en)) return "integral";
  if (/reduced fat|2% (milk)?fat/i.test(en)) return "semidesnatado (2% de gordura)";
  if (/lowfat|low fat|1% (milk)?fat/i.test(en)) return "semidesnatado (1% de gordura)";
  if (/nonfat|fat free|skim/i.test(en)) return "desnatado";
  return null;
}

function leite(en) {
  if (!/^Milk,/i.test(en)) return null;
  const tipo = tipoDeLeite(en);
  const extras = [];
  if (/protein fortified/i.test(en)) extras.push("com proteína adicionada");
  if (/nonfat milk solids/i.test(en)) extras.push("com sólidos de leite adicionados");
  if (/calcium fortified|added calcium/i.test(en)) extras.push("com cálcio adicionado");
  if (/calcium reduced/i.test(en)) extras.push("cálcio reduzido");
  if (/low sodium/i.test(en)) extras.push("baixo teor de sódio");
  if (/reduced sugar/i.test(en)) extras.push("açúcar reduzido");
  if (/instant/i.test(en)) extras.push("instantâneo");
  if (/goat/i.test(en)) return { nome: "Leite, de cabra" };
  if (/sheep/i.test(en)) return { nome: "Leite, de ovelha" };
  if (/buffalo/i.test(en)) return { nome: "Leite, de búfala" };
  if (/human/i.test(en)) return { nome: "Leite, materno" };
  if (/condensed/i.test(en)) return { nome: "Leite, condensado" };
  if (/evaporated/i.test(en)) return { nome: ["Leite, evaporado", tipo === "integral" ? null : tipo, ...extras].filter(Boolean).join(", ") };
  if (/buttermilk/i.test(en)) return { nome: ["Leite, fermentado (buttermilk)", tipo, /dried/i.test(en) ? "pó" : null].filter(Boolean).join(", ") };
  if (/chocolate/i.test(en) && !/hot cocoa/i.test(en)) return { nome: ["Leite, de vaca, achocolatado", tipo, ...extras].filter(Boolean).join(", ") };
  if (/filled|imitation|substitute|hot cocoa/i.test(en)) return null;
  const po = /\bdry\b|dried/i.test(en);
  return { nome: ["Leite, de vaca", tipo, ...extras, po ? "pó" : null].filter(Boolean).join(", ") };
}

function iogurte(en) {
  if (!/^Yogurt,/i.test(en) || /frozen/i.test(en)) return null;
  const partes = ["Iogurte"];
  if (/greek/i.test(en)) partes.push("grego");
  if (/plain/i.test(en)) partes.push("natural");
  const sabor = en.match(/\b(vanilla|strawberry|chocolate|lemon|fruit)\b/i)?.[1]?.toLowerCase();
  const SABORES = { vanilla: "sabor baunilha", strawberry: "sabor morango", chocolate: "sabor chocolate", lemon: "sabor limão", fruit: "com fruta" };
  if (sabor) partes.push(SABORES[sabor]);
  if (/whole milk/i.test(en)) partes.push("integral");
  else if (/nonfat|non-fat|fat free|skim/i.test(en)) partes.push("desnatado");
  else if (/low ?fat|lowfat/i.test(en)) partes.push("semidesnatado");
  if (/low.?calorie sweetener|saccharin|sucralose|aspartame/i.test(en)) partes.push("com adoçante");
  return { nome: partes.join(", ") };
}

function ovo(en) {
  if (!/^Egg,/i.test(en)) return null;
  const AVE_OVO = [
    [/\bduck\b/i, "de pata"],
    [/\bgoose\b/i, "de gansa"],
    [/\bquail\b/i, "de codorna"],
    [/\bturkey\b/i, "de perua"],
  ];
  const deQual = AVE_OVO.find(([re]) => re.test(en))?.[1] ?? "de galinha";
  let parte = ["inteiro", "m"];
  if (/\bwhite\b/i.test(en)) parte = ["clara", "f"];
  else if (/\byolk\b/i.test(en)) parte = ["gema", "f"];
  const f = parte[1] === "f";
  let prep = preparo(en, parte[1]);
  if (/hard-boiled/i.test(en)) prep = f ? "cozida" : "cozido";
  if (/scrambled/i.test(en)) prep = f ? "mexida" : "mexido";
  if (/poached/i.test(en)) prep = "pochê";
  if (/omelet/i.test(en)) return { nome: "Ovo, de galinha, omelete" };
  if (/dried|powder/i.test(en)) prep = "pó";
  if (/frozen/i.test(en) && !prep) prep = f ? "congelada" : "congelado";
  if (/fresh/i.test(en) && !prep) prep = f ? "crua" : "cru";
  return { nome: ["Ovo", deQual, parte[0], prep].filter(Boolean).join(", ") };
}

// ---------------------------------------------------------------- limpeza geral
const RUIDO = new Set([
  "tradicional", "todas as variedades", "todos os tipos", "todas as classes", "todas as regiões",
  "todos os estilos", "embalagem comum", "fluido", "fluida", "espécies variadas", "como comprado",
  "sólidos e líquido", "média", "importado", "importada", "australiano", "australiana",
  "da Nova Zelândia", "genérico", "genérica", "não especificado", "não especificada",
  "industrial e varejo", "média anual", "comum", "para salada ou cozinha", "grãos maduros", "grão maduro", "todas as variedades comerciais", "variedades tradicionais", "todos",
]);

const TROCAS = new Map([
  ["assado no forno", "assado"], ["assada no forno", "assada"],
  ["grelhado no forno", "grelhado"], ["grelhada no forno", "grelhada"],
  ["frito na frigideira", "frito"], ["frita na frigideira", "frita"],
  ["cozido em fogo baixo", "cozido"], ["cozida em fogo baixo", "cozida"],
  ["cozido em água", "cozido"], ["cozida em água", "cozida"],
  ["só os sólidos", "drenado"],
  ["em calda grossa", "em calda"], ["em calda leve", "em calda"],
  ["em calda extra grossa", "em calda"], ["em calda extra leve", "em calda"],
  ["salteado", "refogado"], ["salteada", "refogada"],
  ["calda grossa", "em calda"], ["calda leve", "em calda"], ["calda extra grossa", "em calda"], ["calda extra leve", "em calda"],
  ["guisado", "cozido"], ["guisada", "cozida"], ["calda", "em calda"],
  ["cozido sem sal", "cozido"], ["cozida sem sal", "cozida"],
]);

const VITAMINA_A_D = /vitaminas? (A|D|A e D|D2)\b|vitaminas A e D/;
// Enriquecido/branqueado/conservante: diferenças americanas que não existem no Brasil.
const PROCESSO_EUA = /^(não )?(enriquecid|branquead)[oa]s?$|propionato de cálcio|^com farinha (não )?enriquecida$|^farinha (não )?enriquecida$/;
const CABECAS_TACO = new Map([
  ["Biscoito doce", "Biscoito, doce"],
  ["Biscoito salgado", "Biscoito, salgado"],
]);

function limparNome(nome, categoria, genero = "m") {
  let partes = nome.split(", ");
  // "Calor seco/úmido" é o jeito americano de dizer assado/cozido.
  const f = genero === "f";
  partes = partes.map((p) =>
    p === "em calor seco" ? (f ? "assada" : "assado") : p === "em calor úmido" ? (f ? "cozida" : "cozido") : p
  );
  // "with skin" em carne e peixe é pele, não casca.
  if (/Carnes|Pescados/.test(categoria)) partes = partes.map((p) => (p === "com casca" ? "com pele" : p));
  const cabeca = partes[0];
  partes = partes
    .slice(1)
    .map((p) => TROCAS.get(p) ?? p)
    .filter((p) => !RUIDO.has(p))
    // Fortificação com A e D não muda o uso clínico; as variações são juntadas.
    .filter((p) => !VITAMINA_A_D.test(p))
    .filter((p) => !PROCESSO_EUA.test(p));
  const cozido = partes.some((p) => /^cozid|^assad|^grelhad|^frit|^refogad/.test(p));
  if (cozido) {
    partes = partes.filter((p) => !/^(drenado|drenada|no vapor|no micro-ondas|cru|crua)$/.test(p));
    // Sal do cozimento: a TACO não separa; fica a versão sem sal.
    if (/Verduras|Leguminosas|Cereais/.test(categoria)) {
      partes = partes.filter((p) => !/^(sem sal|com sal|com sal adicionado|sem adição de sal)$/.test(p));
    }
  }
  // Repetição da cabeça: "Achocolatado em pó, em pó", "Manteiga, manteiga clarificada",
  // "Molho para salada, molho francês", "Refrigerante, refrigerante de uva".
  const cabecaMin = cabeca.toLowerCase();
  const primeiraPalavra = cabecaMin.split(" ")[0];
  partes = partes
    .filter((p) => !cabecaMin.includes(p.toLowerCase().replace(/[()]/g, "")))
    .map((p) => (p.toLowerCase().startsWith(`${primeiraPalavra} `) ? p.slice(primeiraPalavra.length + 1) : p));
  // Concordância dos termos que a limpeza injeta no masculino ("Batata, enlatada, drenado").
  if (f) partes = partes.map((p) => (p === "drenado" ? "drenada" : p));
  // Congelado "não preparado" é o congelado cru.
  if (partes.some((p) => /^congelad[oa]$/.test(p))) {
    partes = partes.map((p) => (p === "não preparado" ? "cru" : p === "não preparada" ? "crua" : p));
  }
  // "cozida, cozida com casca" → "cozida com casca"; "cozido, refogado" → "refogado".
  partes = partes.filter((p, i) => {
    const prox = partes[i + 1] ?? "";
    if (prox.startsWith(`${p} `)) return false;
    return !(/^cozid[oa]$/.test(p) && /^(assad|grelhad|frit|refogad)/.test(prox));
  });
  // Óleos no padrão da TACO: "Óleo, de soja".
  if (cabeca === "Óleo" && partes[0] && !/^(de |industrial|para |uso |alto |médio |baixo |totalmente|refinado)/.test(partes[0])) {
    partes[0] = `de ${partes[0]}`;
  }
  // "cru" no fim, como na TACO ("Abacaxi, cru").
  const iCru = partes.findIndex((p) => /^cru[a]?$/.test(p));
  if (iCru >= 0 && iCru !== partes.length - 1) partes.push(...partes.splice(iCru, 1));
  return [CABECAS_TACO.get(cabeca) ?? cabeca, ...partes].filter((p, i, arr) => p && p !== arr[i - 1]).join(", ");
}

// ---------------------------------------------------------------- suíno curado
/**
 * Presunto, bacon e toucinho. As variações de rotulagem americana do presunto
 * ("water added", "natural juices", "ham and water product"), de corte e de
 * aquecimento viram poucas opções: com/sem gordura, extramagro, baixo sódio, enlatado.
 */
function suinoCurado(en) {
  if (/separable fat|rendered fat/i.test(en)) return { excluir: true };
  if (/\bham\b/i.test(en)) {
    const partes = ["Presunto"];
    if (/extra lean/i.test(en)) partes.push("extramagro");
    else if (/lean only/i.test(en)) partes.push("sem gordura");
    else if (/lean and fat/i.test(en)) partes.push("com gordura");
    if (/low sodium|reduced sodium/i.test(en)) partes.push("baixo teor de sódio");
    if (/canned/i.test(en)) partes.push("enlatado");
    if (/patties/i.test(en)) partes.push("hambúrguer");
    return { nome: partes.join(", ") };
  }
  if (/canadian bacon/i.test(en)) return { nome: ["Bacon canadense (lombo defumado)", preparo(en, "m") ?? "cru"].join(", ") };
  if (/\bbacon\b/i.test(en)) {
    let prep = "cru";
    if (/fried|microwaved|pan-fried/i.test(en)) prep = "frito";
    else if (/baked|roasted/i.test(en)) prep = "assado";
    return { nome: ["Bacon", /low sodium|reduced sodium/i.test(en) ? "baixo teor de sódio" : null, prep].filter(Boolean).join(", ") };
  }
  if (/salt pork/i.test(en)) return { nome: "Toucinho, salgado, cru" };
  if (/breakfast strips/i.test(en)) return { nome: ["Bacon, tiras para café da manhã", preparo(en, "m") ?? "cru"].join(", ") };
  if (/shoulder|picnic/i.test(en)) {
    return { nome: ["Porco, paleta, defumada", gorduraDaCarne(en), preparo(en, "f")].filter(Boolean).join(", ") };
  }
  return null;
}

// ---------------------------------------------------------------- entrada principal
/** @returns {{ nome: string } | { excluir: true }} */
export function padronizar(alimento, dicionario) {
  const en = alimento.nome_en.replace(/\s*\(Includes foods for USDA's Food Distribution Program\)/gi, "");
  let r = null;
  if (/^Beef,/.test(en) && !/cured|corned|pastrami|jerky|luncheon|bologna|breakfast strips|sandwich steaks|chopped|dried/i.test(en))
    r = carneVermelha(en, "Carne, bovina", CORTES_BOVINOS);
  else if (/^Pork, cured/.test(en)) r = suinoCurado(en);
  else if (/^Pork, fresh,|^Pork, ground|^Pork loin, fresh|^Pork, (Leg|Shoulder)/.test(en))
    r = carneVermelha(en, "Porco", CORTES_SUINOS, "m");
  else if (/^Lamb,/.test(en)) r = carneVermelha(en, "Cordeiro", CORTES_CORDEIRO, "m");
  else if (/^Veal,/.test(en)) r = carneVermelha(en, "Vitela", CORTES_VITELA);
  else if (AVES.some(([re]) => re.test(en))) r = ave(en);
  else if (/^Milk,/.test(en)) r = leite(en);
  else if (/^Yogurt,/.test(en)) r = iogurte(en);
  else if (/^Egg,/.test(en)) r = ovo(en);
  if (r?.excluir) return r;
  if (r?.nome) return { nome: limparNome(r.nome, alimento.categoria) };
  const montado = montarNome(alimento.nome_en, dicionario);
  return { nome: limparNome(montado.nome, alimento.categoria, montado.genero) };
}

/**
 * Quanto menor, mais representativa a versão (fica quando várias viram o mesmo nome):
 * carne nacional e sem classificação, sem salmoura, sem sal, sem fortificação, aparagem padrão.
 */
export function prioridade(en) {
  let p = 0;
  if (/imported|Australian|New Zealand/i.test(en)) p += 50;
  if (/Wagyu|grass-fed/i.test(en)) p += 40;
  if (/\b(choice|select|prime)\b/i.test(en)) p += 30;
  if (/with added solution|enhanced/i.test(en)) p += 30;
  if (/with salt|salt added|salted/i.test(en)) p += 20;
  if (/fortified|added vitamin|with added/i.test(en)) p += 10;
  if (/trimmed to 1\/4|trimmed to 1\/2/i.test(en)) p += 6;
  if (/trimmed to 1\/8/i.test(en)) p += 3;
  if (/heavy syrup|extra/i.test(en)) p += 4;
  if (/light syrup/i.test(en)) p += 2;
  if (/microwaved|steamed/i.test(en)) p += 2;
  if (/Includes foods for USDA/i.test(en)) p += 1;
  // Brasil: farinha de trigo enriquecida por lei; arroz e milho, não.
  const enriquecido = /\benriched\b/i.test(en) && !/unenriched/i.test(en);
  if (/^Rice|corn|Cornmeal|grits|Hominy/i.test(en) ? enriquecido : /unenriched/i.test(en)) p += 5;
  if (/\bbleached\b/i.test(en) && !/unbleached/i.test(en)) p += 2;
  if (/with calcium propionate/i.test(en)) p += 1;
  return p * 1000 + en.length;
}

/** Junta as versões que viram o mesmo nome: fica a de menor prioridade(). */
export function escolherRepresentantes(itens) {
  const porNome = new Map();
  for (const item of itens) {
    const atual = porNome.get(item.nome_pt);
    if (!atual || prioridade(item.nome_en) < prioridade(atual.nome_en)) porNome.set(item.nome_pt, item);
  }
  return [...porNome.values()];
}
