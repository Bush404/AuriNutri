/**
 * Gera a lista de candidatos da USDA (Fase 18): lê a base SR Legacy (FoodData Central,
 * abril/2018, domínio público) baixada em scripts/import-usda/fonte/ e grava
 * scripts/import-usda/candidatos.json com os alimentos que fazem sentido no Brasil,
 * já com os nutrientes nas mesmas colunas da TACO e as medidas caseiras em gramas.
 *
 * Uso:
 *   1. Baixe e descompacte em scripts/import-usda/fonte/:
 *      https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
 *   2. node scripts/import-usda/gerar-candidatos.mjs
 *
 * Fica de fora: comida de restaurante e fast-food americanos, alimentos indígenas do
 * Alasca, papinhas, pratos prontos, produtos de marca, caça e as variações de
 * classificação comercial da carne bovina americana (choice/select/prime).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const FONTE = path.join(AQUI, "fonte", "FoodData_Central_sr_legacy_food_csv_2018-04");

function lerCsv(arquivo) {
  const texto = fs.readFileSync(path.join(FONTE, arquivo), "utf8");
  const linhas = texto.split(/\r?\n/).filter(Boolean);
  const parse = (linha) => {
    const campos = [];
    let atual = "";
    let aspas = false;
    for (let i = 0; i < linha.length; i++) {
      const ch = linha[i];
      if (ch === '"') {
        if (aspas && linha[i + 1] === '"') {
          atual += '"';
          i++;
        } else aspas = !aspas;
      } else if (ch === "," && !aspas) {
        campos.push(atual);
        atual = "";
      } else atual += ch;
    }
    campos.push(atual);
    return campos;
  };
  const [cabecalho, ...resto] = linhas.map(parse);
  return resto.map((campos) => Object.fromEntries(cabecalho.map((c, i) => [c, campos[i]])));
}

// Grupo da USDA → categoria da TACO (as mesmas 15 da base oficial).
const CATEGORIA_TACO = {
  "Spices and Herbs": "Miscelâneas",
  "Vegetables and Vegetable Products": "Verduras, hortaliças e derivados",
  Beverages: "Bebidas (alcoólicas e não alcoólicas)",
  "Fats and Oils": "Gorduras e óleos",
  "Sausages and Luncheon Meats": "Carnes e derivados",
  "Poultry Products": "Carnes e derivados",
  "Pork Products": "Carnes e derivados",
  "Beef Products": "Carnes e derivados",
  "Lamb, Veal, and Game Products": "Carnes e derivados",
  "Breakfast Cereals": "Cereais e derivados",
  "Cereal Grains and Pasta": "Cereais e derivados",
  "Baked Products": "Cereais e derivados",
  "Legumes and Legume Products": "Leguminosas e derivados",
  "Finfish and Shellfish Products": "Pescados e frutos do mar",
  "Fruits and Fruit Juices": "Frutas e derivados",
  "Nut and Seed Products": "Nozes e sementes",
  Sweets: "Produtos açucarados",
  Snacks: "Outros alimentos industrializados",
  "Soups, Sauces, and Gravies": "Outros alimentos industrializados",
  "Dairy and Egg Products": "Leite e derivados", // ovos e manteiga são separados abaixo
};

const GRUPOS_FORA = new Set([
  "American Indian/Alaska Native Foods",
  "Restaurant Foods",
  "Fast Foods",
  "Baby Foods",
  "Meals, Entrees, and Side Dishes",
]);

// Marcas em caixa mista (as em CAIXA ALTA são pegas pela regra geral).
const MARCAS =
  /\b(Oscar Mayer|Powerade|Gatorade|Pillsbury|Kraft|Kellogg|Post|Nabisco|Keebler|Quaker|General Mills|Malt-O-Meal|Ralston|Hormel|Campbell|Tyson|Banquet|Stouffer|Lean Cuisine|Healthy Choice|Sara Lee|Entenmann|Hostess|Little Debbie|Snapple|Ocean Spray|Dannon|Yoplait|Mission|Rice-A-Roni|Archway|Mott'?s|Glaceau|Vitaminwater|SoBe|Arizona|Lipton|Nestle|Hershey|Mars|Ovaltine|Silk|Kashi|Barilla|Guerrero|La Choy|Morningstar|Boca|Gardenburger|Worthington|Loma Linda|Smucker|Jell-O|Cool Whip|Eggo|Bisquick|Betty Crocker|Duncan Hines|Martha White|Mrs\. ?Smith|Marie Callender|Cheerios|Wheaties|Chex|Special K|Fruit Loops|Pop-Tarts|Tostitos|Doritos|Cheetos|Fritos|Lay'?s|Pringles|Ruffles|Sunchips|Goldfish|Ritz|Triscuit|Wheat Thins|Oreo|Twinkies|Snickers|Twix|Butterfinger|Reese|Glutino|Udi'?s|Schar|Van'?s|George Weston|Arrowhead|Andrea'?s|Ready Crust|Continental Mills|Crunchmaster|Dove|Gamesa|Goya|Heinz|Interstate Brands|Krusteaz|La Moderna|La Ricura|Mary'?s Gone|Monster|Muscle Milk|Natreon|New england brand|Dutch brand|Spam|Keikitos|Hain|Incaparina|Propel|Reddi Wip|Rudi'?s|Sage Valley)\b/i;

const FRASES_FORA =
  /single brand|fast food|school lunch|restaurant|USDA Commodity|babyfood|infant formula|military|\bMRE\b|Game meat|Alaska Native|Native American|Navajo|Apache|Hopi|Shoshone|Ojibwe|Inupiat|Yupik|ready-to-eat meal/i;

// Classificação comercial americana da carne bovina: fica só "all grades".
const GRAU_BOVINO = /\b(choice|select|prime)\b/i;

function temMarcaEmCaixaAlta(descricao) {
  const limpa = descricao.replace(/\b(USDA|NFS|UHT|DHA|ARA|II|III|IV)\b/g, "");
  return /\b[A-Z][A-Z'&.\-]{2,}\b/.test(limpa);
}

// Nutriente da USDA → coluna da tabela foods (mesmas da TACO).
const NUTRIENTES = {
  1008: "calorias_kcal",
  1003: "proteinas_g",
  1005: "carboidratos_g",
  1004: "gorduras_g",
  1079: "fibras_g",
  1051: "umidade_g",
  1007: "cinzas_g",
  1253: "colesterol_mg",
  1087: "calcio_mg",
  1090: "magnesio_mg",
  1101: "manganes_mg",
  1091: "fosforo_mg",
  1089: "ferro_mg",
  1093: "sodio_mg",
  1092: "potassio_mg",
  1098: "cobre_mg",
  1095: "zinco_mg",
  1105: "retinol_mcg",
  1106: "rae_mcg",
  1165: "tiamina_mg",
  1166: "riboflavina_mg",
  1175: "piridoxina_mg",
  1167: "niacina_mg",
  1162: "vitamina_c_mg",
  1258: "gordura_saturada_g",
  1292: "gordura_monoinsaturada_g",
  1293: "gordura_poliinsaturada_g",
};
// re_mcg (equivalentes de retinol) não existe na SR Legacy: fica "nao_informado".
const COLUNAS = [...Object.values(NUTRIENTES), "re_mcg"];

const categorias = Object.fromEntries(lerCsv("food_category.csv").map((c) => [c.id, c.description]));
const unidades = Object.fromEntries(lerCsv("measure_unit.csv").map((u) => [u.id, u.name]));

const motivos = {};
const contarFora = (motivo) => (motivos[motivo] = (motivos[motivo] ?? 0) + 1);

const escolhidos = new Map();
for (const f of lerCsv("food.csv")) {
  const grupo = categorias[f.food_category_id];
  const d = f.description;
  if (GRUPOS_FORA.has(grupo)) contarFora(`grupo: ${grupo}`);
  else if (FRASES_FORA.test(d)) contarFora("restaurante/fast-food/caça/indígena");
  else if (MARCAS.test(d) || temMarcaEmCaixaAlta(d)) contarFora("produto de marca");
  else if (grupo === "Beef Products" && GRAU_BOVINO.test(d) && !/all grades/i.test(d)) contarFora("carne bovina: grau comercial");
  else {
    let categoria = CATEGORIA_TACO[grupo] ?? "Outros alimentos industrializados";
    if (grupo === "Dairy and Egg Products" && /^Egg/i.test(d)) categoria = "Ovos e derivados";
    if (grupo === "Dairy and Egg Products" && /^Butter/i.test(d)) categoria = "Gorduras e óleos";
    escolhidos.set(f.fdc_id, { fdc_id: Number(f.fdc_id), nome_en: d, grupo_usda: grupo, categoria, nutrientes: {}, porcoes: [] });
  }
}

for (const n of lerCsv("food_nutrient.csv")) {
  const alimento = escolhidos.get(n.fdc_id);
  const coluna = NUTRIENTES[n.nutrient_id];
  if (alimento && coluna && n.amount !== "") alimento.nutrientes[coluna] = Number(n.amount);
}

for (const p of lerCsv("food_portion.csv")) {
  const alimento = escolhidos.get(p.fdc_id);
  if (!alimento || !p.gram_weight) continue;
  const unidade = p.measure_unit_id === "9999" ? "" : unidades[p.measure_unit_id] ?? "";
  const descricao = [p.amount, unidade, p.portion_description, p.modifier].filter(Boolean).join(" ").trim();
  alimento.porcoes.push({ descricao_en: descricao, gramas: Number(p.gram_weight) });
}

const lista = [...escolhidos.values()]
  // Sem energia não dá para usar num plano.
  .filter((a) => {
    if (a.nutrientes.calorias_kcal === undefined) {
      contarFora("sem energia (kcal)");
      return false;
    }
    return true;
  })
  .map((a) => ({
    ...a,
    // Ausente na USDA = a fonte não informa (nunca vira 0).
    valores_especiais: Object.fromEntries(COLUNAS.filter((c) => a.nutrientes[c] === undefined).map((c) => [c, "nao_informado"])),
  }))
  .sort((a, b) => a.categoria.localeCompare(b.categoria, "pt-BR") || a.nome_en.localeCompare(b.nome_en));

fs.writeFileSync(path.join(AQUI, "candidatos.json"), JSON.stringify(lista, null, 1));

const porCategoria = {};
for (const a of lista) porCategoria[a.categoria] = (porCategoria[a.categoria] ?? 0) + 1;
console.log(`Candidatos: ${lista.length} de ${escolhidos.size + Object.values(motivos).reduce((s, n) => s + n, 0)}`);
console.log("Por categoria:", porCategoria);
console.log("Fora:", motivos);
