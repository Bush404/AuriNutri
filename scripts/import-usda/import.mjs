#!/usr/bin/env node
/**
 * Importa os alimentos da USDA revisados na planilha (Fase 18).
 *
 * Lê scripts/import-usda/revisao-usda.xlsx (só as linhas com Incluir = "S", com o
 * nome e a categoria que a nutricionista deixou) e os nutrientes/medidas de
 * candidatos.json, e grava em `foods` como alimentos globais (fonte "usda", sem
 * dono) + as medidas caseiras traduzidas em `food_measures` (fonte "usda").
 *
 * Precisa da migration 0048 aplicada e da SUPABASE_SERVICE_ROLE_KEY no .env.local
 * (como a importação da TACO). Idempotente: upsert pelo código USDA (FDC ID).
 *
 *   npm run import:usda              → só simula (mostra o que faria)
 *   npm run import:usda -- --gravar  → grava no banco
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";
import { medidasDoAlimento } from "./medidas.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "..", "..");
const PLANILHA = path.join(AQUI, "revisao-usda.xlsx");
const CANDIDATOS = path.join(AQUI, "candidatos.json");
const LOTE = 300;
const GRAVAR = process.argv.includes("--gravar");

const FONTE_DESCRICAO_USDA =
  "USDA FoodData Central — SR Legacy (abril/2018), U.S. Department of Agriculture, Agricultural Research Service.";

const COLUNAS_NUTRIENTES = [
  "calorias_kcal", "proteinas_g", "carboidratos_g", "gorduras_g", "fibras_g",
  "umidade_g", "cinzas_g", "colesterol_mg", "calcio_mg", "magnesio_mg", "manganes_mg",
  "fosforo_mg", "ferro_mg", "sodio_mg", "potassio_mg", "cobre_mg", "zinco_mg",
  "retinol_mcg", "re_mcg", "rae_mcg", "tiamina_mg", "riboflavina_mg", "piridoxina_mg",
  "niacina_mg", "vitamina_c_mg", "gordura_saturada_g", "gordura_monoinsaturada_g",
  "gordura_poliinsaturada_g",
];

/** Carrega .env.local manualmente (o script roda fora do runtime do Next). */
function carregarEnvLocal() {
  const arquivo = path.join(RAIZ, ".env.local");
  if (!existsSync(arquivo)) return;
  for (const linha of readFileSync(arquivo, "utf-8").split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const arredondar = (v, casas) => (v === undefined || v === null ? null : Math.round(v * 10 ** casas) / 10 ** casas);

async function lerPlanilha() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(PLANILHA);
  const aba = wb.getWorksheet("Alimentos");
  const linhas = [];
  aba.eachRow((linha, r) => {
    if (r === 1) return;
    const fdc = Number(linha.getCell(5).value);
    if (!fdc) return;
    linhas.push({
      incluir: String(linha.getCell(1).value ?? "S").trim().toUpperCase() !== "N",
      categoria: String(linha.getCell(2).value ?? "").trim(),
      nome: String(linha.getCell(3).value ?? "").trim(),
      fdc,
    });
  });
  return linhas;
}

async function main() {
  carregarEnvLocal();
  const planilha = await lerPlanilha();
  const candidatos = new Map(JSON.parse(readFileSync(CANDIDATOS, "utf-8")).map((a) => [a.fdc_id, a]));

  const alimentos = [];
  const medidasPorCodigo = new Map();
  const problemas = [];
  for (const l of planilha.filter((x) => x.incluir)) {
    const c = candidatos.get(l.fdc);
    if (!c) {
      problemas.push(`Código ${l.fdc} (${l.nome}) não está em candidatos.json — rode gerar-candidatos.mjs.`);
      continue;
    }
    if (!l.nome || !l.categoria) {
      problemas.push(`Código ${l.fdc}: nome ou categoria vazios na planilha — ignorado.`);
      continue;
    }
    const registro = {
      nome: l.nome,
      categoria: l.categoria,
      marca: null,
      fonte: "usda",
      fonte_descricao: FONTE_DESCRICAO_USDA,
      is_global: true,
      user_id: null,
      codigo_usda: l.fdc,
      porcao_referencia_g: 100,
      valores_especiais: c.valores_especiais ?? {},
    };
    for (const col of COLUNAS_NUTRIENTES) registro[col] = arredondar(c.nutrientes[col], col.endsWith("_g") || col === "calorias_kcal" ? 2 : 3);
    alimentos.push(registro);
    medidasPorCodigo.set(l.fdc, medidasDoAlimento(c.porcoes));
  }

  const totalMedidas = [...medidasPorCodigo.values()].reduce((s, m) => s + m.length, 0);
  const fora = planilha.length - planilha.filter((x) => x.incluir).length;
  console.log(`📄 Planilha: ${planilha.length} alimentos (${fora} marcados N).`);
  console.log(`🥗 A importar: ${alimentos.length} alimentos e ${totalMedidas} medidas caseiras.`);
  if (problemas.length) {
    console.warn(`⚠️  ${problemas.length} problema(s):`);
    for (const p of problemas.slice(0, 20)) console.warn(`   - ${p}`);
  }

  if (!GRAVAR) {
    console.log("\nℹ️  Só simulação. Para gravar no banco: npm run import:usda -- --gravar");
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) {
    console.error("❌ Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no .env.local.");
    process.exit(1);
  }
  const supabase = createClient(url, chave, { auth: { autoRefreshToken: false, persistSession: false } });

  // Categorias: avisa se alguma não existe na TACO (a busca e a lista de compras agrupam por elas).
  const { data: catTaco } = await supabase.from("foods").select("categoria").eq("fonte", "taco").limit(2000);
  const conhecidas = new Set((catTaco ?? []).map((c) => c.categoria));
  const novas = [...new Set(alimentos.map((a) => a.categoria))].filter((c) => !conhecidas.has(c));
  if (conhecidas.size && novas.length) console.warn(`⚠️  Categorias que não existem na TACO: ${novas.join("; ")}`);

  console.log(`\n🚀 Gravando ${alimentos.length} alimentos (upsert pelo código USDA)...`);
  for (let i = 0; i < alimentos.length; i += LOTE) {
    const { error } = await supabase.from("foods").upsert(alimentos.slice(i, i + LOTE), { onConflict: "codigo_usda" });
    if (error) throw new Error(`Lote ${i / LOTE + 1}: ${error.message}`);
    process.stdout.write(".");
  }

  // Ids dos alimentos USDA no banco (paginado: o Supabase devolve no máximo 1000 por vez).
  const idPorCodigo = new Map();
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase
      .from("foods")
      .select("id, codigo_usda")
      .eq("fonte", "usda")
      .range(de, de + 999);
    if (error) throw error;
    for (const f of data) idPorCodigo.set(Number(f.codigo_usda), f.id);
    if (data.length < 1000) break;
  }

  const medidas = [];
  for (const [codigo, lista] of medidasPorCodigo) {
    const foodId = idPorCodigo.get(codigo);
    if (!foodId) continue;
    for (const m of lista) medidas.push({ food_id: foodId, user_id: null, nome: m.nome, gramas: m.gramas, fonte: "usda" });
  }
  console.log(`\n🚀 Gravando ${medidas.length} medidas caseiras da USDA...`);
  const { error: apagarError } = await supabase.from("food_measures").delete().eq("fonte", "usda");
  if (apagarError) throw apagarError;
  for (let i = 0; i < medidas.length; i += 500) {
    const { error } = await supabase.from("food_measures").insert(medidas.slice(i, i + 500));
    if (error) throw error;
  }

  const naoNaPlanilha = [...idPorCodigo.keys()].filter((c) => !alimentos.some((a) => a.codigo_usda === c));
  if (naoNaPlanilha.length) {
    console.warn(`\n⚠️  ${naoNaPlanilha.length} alimento(s) USDA no banco foram marcados N ou saíram da lista.`);
    console.warn("   Eles não foram apagados (podem estar em planos). Para removê-los, fale com o desenvolvimento.");
  }
  const { count } = await supabase.from("foods").select("id", { count: "exact", head: true }).eq("fonte", "usda");
  console.log(`\n✅ Pronto: ${count} alimentos da USDA no banco.`);
}

main().catch((erro) => {
  console.error(`\n❌ ${erro.message ?? erro}`);
  process.exit(1);
});
