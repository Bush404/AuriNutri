/**
 * Gera a planilha de revisão da USDA (Fase 18): scripts/import-usda/revisao-usda.xlsx.
 * A nutricionista marca o que entra (coluna "Incluir"), corrige nomes e categorias,
 * e o importador lê a mesma planilha de volta.
 *
 * Uso: node scripts/import-usda/gerar-candidatos.mjs && node scripts/import-usda/gerar-planilha.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { carregarDicionario } from "./montar-nome.mjs";
import { escolherRepresentantes, padronizar } from "./padronizar.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SAIDA = path.join(AQUI, "revisao-usda.xlsx");

const CATEGORIAS = [
  "Bebidas (alcoólicas e não alcoólicas)",
  "Carnes e derivados",
  "Cereais e derivados",
  "Frutas e derivados",
  "Gorduras e óleos",
  "Leguminosas e derivados",
  "Leite e derivados",
  "Miscelâneas",
  "Nozes e sementes",
  "Outros alimentos industrializados",
  "Ovos e derivados",
  "Pescados e frutos do mar",
  "Produtos açucarados",
  "Verduras, hortaliças e derivados",
];

/**
 * Revisão já feita na planilha anterior: o que a nutricionista mudou é preservado.
 * Incluir e Categoria vêm sempre da planilha; o nome só é substituído pela tradução
 * nova se ela não editou (nome igual ao que tinha sido gerado — coluna oculta
 * "Nome gerado", ou, na primeira vez, o arquivo opcional de nomes anteriores).
 */
async function lerRevisaoAnterior() {
  if (!fs.existsSync(SAIDA)) return new Map();
  const anteriores = process.env.NOMES_ANTERIORES
    ? JSON.parse(fs.readFileSync(process.env.NOMES_ANTERIORES, "utf8"))
    : {};
  const wbAntigo = new ExcelJS.Workbook();
  await wbAntigo.xlsx.readFile(SAIDA);
  const abaAntiga = wbAntigo.getWorksheet("Alimentos");
  const revisao = new Map();
  abaAntiga.eachRow((linha, r) => {
    if (r === 1) return;
    const fdc = Number(linha.getCell(5).value);
    if (!fdc) return;
    const nome = String(linha.getCell(3).value ?? "").trim();
    const gerado = String(linha.getCell(12).value ?? anteriores[fdc] ?? "").trim();
    revisao.set(fdc, {
      incluir: String(linha.getCell(1).value ?? "S").trim().toUpperCase() === "N" ? "N" : "S",
      categoria: String(linha.getCell(2).value ?? "").trim(),
      nomeEditado: gerado && nome && nome !== gerado ? nome : null,
    });
  });
  return revisao;
}

const dicionario = carregarDicionario();
const revisao = await lerRevisaoAnterior();
const preservados = { incluir: 0, categoria: 0, nome: 0 };
// Nome no padrão brasileiro/TACO; variações que viram o mesmo nome ficam em uma só.
const padronizados = [];
for (const a of JSON.parse(fs.readFileSync(path.join(AQUI, "candidatos.json"), "utf8"))) {
  const r = padronizar(a, dicionario);
  if (!r.excluir) padronizados.push({ ...a, nome_pt: r.nome });
}
const candidatos = escolherRepresentantes(padronizados)
  .map((a) => {
    const nomeGerado = a.nome_pt;
    const anterior = revisao.get(a.fdc_id);
    if (anterior?.incluir === "N") preservados.incluir++;
    if (anterior?.categoria && anterior.categoria !== a.categoria) preservados.categoria++;
    if (anterior?.nomeEditado) preservados.nome++;
    return {
      ...a,
      incluir: anterior?.incluir ?? "S",
      categoria: anterior?.categoria || a.categoria,
      nome_gerado: nomeGerado,
      nome_pt: anterior?.nomeEditado ?? nomeGerado,
    };
  })
  .sort((a, b) => a.categoria.localeCompare(b.categoria, "pt-BR") || a.nome_pt.localeCompare(b.nome_pt, "pt-BR"));

const FONTE = { name: "Arial", size: 10 };
const VERDE = "FF07583F";
const AMARELO = "FFFFF6D5";

const wb = new ExcelJS.Workbook();
wb.creator = "AuriNutri";
wb.calcProperties.fullCalcOnLoad = true;

// ---------- Aba 1: como revisar ----------
const guia = wb.addWorksheet("Como revisar", { properties: { tabColor: { argb: VERDE } } });
guia.getColumn(1).width = 110;
const linhasGuia = [
  ["Revisão dos alimentos da USDA para o AuriNutri", { bold: true, size: 14, color: { argb: VERDE } }],
  [""],
  ["De onde vêm: USDA FoodData Central, base SR Legacy (abril/2018). Domínio público, uso comercial livre — só pede a citação da fonte."],
  ["Já ficaram de fora: comida de restaurante e fast-food americanos, alimentos indígenas do Alasca, papinhas, pratos prontos, produtos de marca, caça e as classificações comerciais da carne americana."],
  ["Valores por 100 g, como na TACO. Os nutrientes que a USDA não informa ficam marcados como \"não informado\" (nunca viram zero)."],
  [""],
  ["O que fazer na aba \"Alimentos\" (as células amarelas são as que você pode mudar):", { bold: true }],
  ["1. Coluna INCLUIR: deixe \"S\" para entrar no AuriNutri ou troque para \"N\" para ficar de fora. Todos começam com \"S\"."],
  ["2. Coluna NOME EM PORTUGUÊS: corrija o nome se precisar. Mantenha o padrão da TACO: \"Alimento, detalhe, preparo\" (ex.: \"Batata, inglesa, cozida\")."],
  ["3. Coluna CATEGORIA: troque pela lista se o alimento estiver no grupo errado."],
  ["4. Não mexa nas colunas cinzas (nome original, código e nutrientes) — o importador usa o código para achar o alimento."],
  [""],
  ["Dica: use o filtro do cabeçalho (setinha) para ver uma categoria por vez, ou procure com Ctrl+F."],
  ["Dica: se um mesmo termo estiver errado em muitos alimentos (ex.: um corte de carne), me avise — eu corrijo no dicionário e ele muda em todos de uma vez."],
  [""],
  ["Exemplo de linha preenchida:", { bold: true }],
  ["S  |  Carnes e derivados  |  Carne bovina, moída, 95% carne magra / 5% gordura, crua  |  Beef, ground, 95% lean meat / 5% fat, raw  |  171790  |  137 kcal ..."],
];
for (const [texto, estilo] of linhasGuia) {
  const linha = guia.addRow([texto]);
  linha.font = { ...FONTE, ...(estilo ?? {}) };
  linha.alignment = { wrapText: true, vertical: "top" };
}

// ---------- Aba 2: alimentos ----------
const aba = wb.addWorksheet("Alimentos", {
  views: [{ state: "frozen", xSplit: 3, ySplit: 1 }],
  properties: { tabColor: { argb: "FFA5D51F" } },
});
aba.columns = [
  { header: "Incluir (S/N)", key: "incluir", width: 12 },
  { header: "Categoria", key: "categoria", width: 34 },
  { header: "Nome em português", key: "nome_pt", width: 70 },
  { header: "Nome original (USDA)", key: "nome_en", width: 60 },
  { header: "Código USDA (FDC)", key: "fdc_id", width: 14 },
  { header: "Energia (kcal)", key: "kcal", width: 11 },
  { header: "Proteína (g)", key: "prot", width: 11 },
  { header: "Carboidrato (g)", key: "carb", width: 13 },
  { header: "Gordura (g)", key: "gord", width: 11 },
  { header: "Fibra (g)", key: "fibra", width: 10 },
  { header: "Medidas caseiras", key: "medidas", width: 12 },
  // Oculta: o nome que o tradutor gerou — permite saber o que foi editado à mão.
  { header: "Nome gerado", key: "nome_gerado", width: 10, hidden: true },
];

for (const a of candidatos) {
  const n = a.nutrientes;
  aba.addRow({
    incluir: a.incluir,
    categoria: a.categoria,
    nome_pt: a.nome_pt,
    nome_gerado: a.nome_gerado,
    nome_en: a.nome_en,
    fdc_id: a.fdc_id,
    kcal: n.calorias_kcal ?? null,
    prot: n.proteinas_g ?? null,
    carb: n.carboidratos_g ?? null,
    gord: n.gorduras_g ?? null,
    fibra: n.fibras_g ?? null,
    medidas: a.porcoes.length,
  });
}

const ultima = candidatos.length + 1;
aba.getRow(1).eachCell((c) => {
  c.font = { ...FONTE, bold: true, color: { argb: "FFFFFFFF" } };
  c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
  c.alignment = { vertical: "middle", wrapText: true };
});
aba.getRow(1).height = 30;
aba.autoFilter = { from: "A1", to: `K${ultima}` };

for (let r = 2; r <= ultima; r++) {
  const linha = aba.getRow(r);
  linha.font = FONTE;
  for (const col of [1, 2, 3]) {
    linha.getCell(col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMARELO } };
  }
  for (const col of [4, 5, 6, 7, 8, 9, 10, 11]) linha.getCell(col).font = { ...FONTE, color: { argb: "FF66756E" } };
  linha.getCell(1).alignment = { horizontal: "center" };
  linha.getCell(1).dataValidation = {
    type: "list",
    allowBlank: false,
    formulae: ['"S,N"'],
    showErrorMessage: true,
    errorTitle: "Use S ou N",
    error: "Digite S para incluir ou N para deixar de fora.",
  };
  linha.getCell(2).dataValidation = {
    type: "list",
    allowBlank: false,
    formulae: [`Categorias!$A$2:$A$${CATEGORIAS.length + 1}`],
    showErrorMessage: true,
    errorTitle: "Categoria",
    error: "Escolha uma categoria da lista (as mesmas da TACO).",
  };
  for (const col of [6, 7, 8, 9, 10]) linha.getCell(col).numFmt = "0.0";
}

// ---------- Aba 3: resumo (fórmulas, recalcula ao abrir) ----------
const resumo = wb.addWorksheet("Resumo");
resumo.columns = [
  { header: "Categoria", key: "c", width: 40 },
  { header: "Candidatos", key: "t", width: 12 },
  { header: "Vão entrar (S)", key: "s", width: 14 },
  { header: "Ficam de fora (N)", key: "n", width: 16 },
];
CATEGORIAS.forEach((cat, i) => {
  const r = i + 2;
  resumo.addRow({
    c: cat,
    t: { formula: `COUNTIF(Alimentos!$B$2:$B$${ultima},A${r})` },
    s: { formula: `COUNTIFS(Alimentos!$B$2:$B$${ultima},A${r},Alimentos!$A$2:$A$${ultima},"S")` },
    n: { formula: `COUNTIFS(Alimentos!$B$2:$B$${ultima},A${r},Alimentos!$A$2:$A$${ultima},"N")` },
  });
});
const rt = CATEGORIAS.length + 2;
resumo.addRow({
  c: "Total",
  t: { formula: `SUM(B2:B${rt - 1})` },
  s: { formula: `SUM(C2:C${rt - 1})` },
  n: { formula: `SUM(D2:D${rt - 1})` },
});
resumo.eachRow((linha, r) => {
  linha.font = { ...FONTE, bold: r === 1 || r === rt, color: r === 1 ? { argb: "FFFFFFFF" } : undefined };
  if (r === 1) linha.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } }));
});

// ---------- Aba 4: lista de categorias (para a validação) ----------
const cats = wb.addWorksheet("Categorias");
cats.getColumn(1).width = 40;
cats.addRow(["Categorias (as mesmas da TACO)"]).font = { ...FONTE, bold: true };
for (const c of CATEGORIAS) cats.addRow([c]).font = FONTE;

await wb.xlsx.writeFile(SAIDA);
console.log(`Planilha gerada: ${SAIDA} (${candidatos.length} alimentos)`);
console.log(`Revisão preservada: ${preservados.incluir} marcados N, ${preservados.categoria} categorias trocadas, ${preservados.nome} nomes editados à mão.`);
