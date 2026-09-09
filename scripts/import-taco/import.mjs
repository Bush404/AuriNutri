#!/usr/bin/env node
/**
 * Importa a Tabela Brasileira de Composição de Alimentos (TACO) para a
 * tabela `foods` como alimentos globais (is_global = true, user_id = null).
 *
 * Uso:  npm run import:taco
 * Documentação completa: scripts/import-taco/README.md
 *
 * IMPORTANTE: este script nunca inventa, estima ou zera valores ausentes.
 * "Tr" (traço) e "NA" (não analisado) são preservados como tal em
 * `valores_especiais`, e a coluna numérica correspondente fica NULL.
 *
 * FORMATO DO CSV (nomes de coluna, conforme dicionário de dados oficial):
 *   numero_alimento, descricao, categoria, umidade_pct, energia_kcal,
 *   proteina_g, lipideos_g, colesterol_mg, carboidrato_g, fibra_g, cinzas_g,
 *   calcio_mg, magnesio_mg, manganes_mg, fosforo_mg, ferro_mg, sodio_mg,
 *   potassio_mg, cobre_mg, zinco_mg, retinol_mcg, RE_mcg, RAE_mcg,
 *   tiamina_mg, riboflavina_mg, piridoxina_mg, niacina_mg, vitamina_c_mg
 * (colunas extras como base/preparo/qualificadores/energia_kj são ignoradas
 * se presentes; não são obrigatórias.)
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const CSV_PATH = path.join(__dirname, "data", "taco-4a-edicao.csv");
const BATCH_SIZE = 200;

const FONTE_DESCRICAO_TACO =
  "Tabela Brasileira de Composição de Alimentos (TACO) — NEPA/UNICAMP, 4ª edição ampliada e revisada.";

// Mapeia coluna do CSV (nomes oficiais do dicionário de dados) -> coluna no banco.
const COLUMN_MAP = {
  umidade_pct: "umidade_g",
  proteina_g: "proteinas_g",
  lipideos_g: "gorduras_g",
  colesterol_mg: "colesterol_mg",
  carboidrato_g: "carboidratos_g",
  fibra_g: "fibras_g",
  cinzas_g: "cinzas_g",
  calcio_mg: "calcio_mg",
  magnesio_mg: "magnesio_mg",
  manganes_mg: "manganes_mg",
  fosforo_mg: "fosforo_mg",
  ferro_mg: "ferro_mg",
  sodio_mg: "sodio_mg",
  potassio_mg: "potassio_mg",
  cobre_mg: "cobre_mg",
  zinco_mg: "zinco_mg",
  retinol_mcg: "retinol_mcg",
  RE_mcg: "re_mcg",
  RAE_mcg: "rae_mcg",
  tiamina_mg: "tiamina_mg",
  riboflavina_mg: "riboflavina_mg",
  piridoxina_mg: "piridoxina_mg",
  niacina_mg: "niacina_mg",
  vitamina_c_mg: "vitamina_c_mg",
};
// energia_kcal é tratado separadamente (nome de coluna igual nos dois lados).

/** Carrega .env.local manualmente (o script roda fora do runtime do Next). */
function loadEnvLocal() {
  const envPath = path.join(PROJECT_ROOT, ".env.local");
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, "utf-8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) continue;
    const key = line.slice(0, eqIndex).trim();
    const value = line.slice(eqIndex + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

/**
 * Interpreta uma célula do CSV, preservando o significado original de
 * valores não numéricos em vez de zerá-los.
 * @returns {{ value: number | null, flag?: "traco" | "nao_analisado" | "nao_informado" }}
 */
function parseNutrientCell(raw) {
  const cell = (raw ?? "").trim();

  if (cell === "") return { value: null, flag: "nao_informado" };
  if (/^tr$/i.test(cell)) return { value: null, flag: "traco" };
  if (/^na$/i.test(cell)) return { value: null, flag: "nao_analisado" };

  const normalized = cell.replace(",", ".");
  const parsed = Number(normalized);

  // A fonte usa por vezes um "sentinela" numérico muito próximo de zero
  // (ex: 0.00001) para representar traço em pipelines que exigem tipo
  // numérico estrito. Tratamos isso também como traço.
  if (Number.isFinite(parsed) && parsed > 0 && parsed < 0.0001) {
    return { value: null, flag: "traco" };
  }

  if (!Number.isFinite(parsed)) {
    return { value: null, flag: "nao_informado", invalid: true };
  }
  if (parsed < 0) {
    return { value: null, flag: "nao_informado", invalid: true };
  }

  return { value: parsed };
}

function validateAndTransformRow(row, rowIndex, issues) {
  const codigoRaw = (row.numero_alimento ?? "").trim();
  const nome = (row.descricao ?? "").trim();
  const categoria = (row.categoria ?? "").trim();

  if (!codigoRaw || !Number.isInteger(Number(codigoRaw))) {
    issues.push(`Linha ${rowIndex}: numero_alimento ausente ou inválido ("${codigoRaw}") — ignorada.`);
    return null;
  }
  if (!nome) {
    issues.push(`Linha ${rowIndex}: descricao ausente — ignorada.`);
    return null;
  }
  if (!categoria) {
    issues.push(`Linha ${rowIndex}: categoria ausente — ignorada.`);
    return null;
  }

  const record = {
    codigo_taco: Number(codigoRaw),
    nome,
    categoria,
    marca: null,
    fonte: "taco",
    fonte_descricao: FONTE_DESCRICAO_TACO,
    is_global: true,
    user_id: null,
    porcao_referencia_g: 100,
    valores_especiais: {},
  };

  // energia_kcal mapeado diretamente (mesmo nome nos dois lados)
  const energia = parseNutrientCell(row.energia_kcal);
  record.calorias_kcal = energia.value;
  if (energia.flag) record.valores_especiais.calorias_kcal = energia.flag;
  if (energia.invalid) {
    issues.push(`Linha ${rowIndex} (${nome}): valor inválido em "energia_kcal" — tratado como não informado.`);
  }

  for (const [csvColumn, dbColumn] of Object.entries(COLUMN_MAP)) {
    if (!(csvColumn in row)) continue; // coluna opcional ausente no CSV
    const { value, flag, invalid } = parseNutrientCell(row[csvColumn]);
    record[dbColumn] = value;
    if (flag) record.valores_especiais[dbColumn] = flag;
    if (invalid) {
      issues.push(
        `Linha ${rowIndex} (${nome}): valor inválido em "${csvColumn}" ("${row[csvColumn]}") — tratado como não informado.`
      );
    }
  }

  return record;
}

async function main() {
  loadEnvLocal();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "\n❌ Faltam variáveis de ambiente. Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.\n" +
        "   Veja scripts/import-taco/README.md para instruções.\n"
    );
    process.exit(1);
  }

  if (!existsSync(CSV_PATH)) {
    console.error(
      `\n❌ Arquivo não encontrado: ${CSV_PATH}\n` +
        "   Veja scripts/import-taco/README.md para instruções.\n" +
        "   Nenhum dado foi importado — nada foi alterado no banco.\n"
    );
    process.exit(1);
  }

  console.log(`\n📄 Lendo ${CSV_PATH}...`);
  const csvContent = readFileSync(CSV_PATH, "utf-8");

  let rows;
  try {
    rows = parse(csvContent, { columns: true, skip_empty_lines: true, trim: true });
  } catch (err) {
    console.error(`\n❌ Erro ao ler o CSV: ${err.message}\n`);
    process.exit(1);
  }

  console.log(`   ${rows.length} linhas encontradas no arquivo.`);

  const issues = [];
  const seenCodigos = new Set();
  const records = [];

  rows.forEach((row, index) => {
    const record = validateAndTransformRow(row, index + 2 /* +1 header +1 base 1 */, issues);
    if (!record) return;

    if (seenCodigos.has(record.codigo_taco)) {
      issues.push(`Linha ${index + 2}: código ${record.codigo_taco} duplicado no arquivo — ignorada.`);
      return;
    }
    seenCodigos.add(record.codigo_taco);
    records.push(record);
  });

  if (issues.length > 0) {
    console.log(`\n⚠️  ${issues.length} observação(ões) durante a validação:`);
    issues.slice(0, 50).forEach((issue) => console.log(`   - ${issue}`));
    if (issues.length > 50) console.log(`   ... e mais ${issues.length - 50}.`);
  }

  if (records.length === 0) {
    console.log("\nNenhum registro válido para importar. Encerrando sem alterar o banco.\n");
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`\n🚀 Importando ${records.length} alimentos válidos (upsert por código TACO)...`);

  let imported = 0;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("foods").upsert(batch, { onConflict: "codigo_taco" });

    if (error) {
      console.error(`\n❌ Erro ao importar lote ${i / BATCH_SIZE + 1}: ${error.message}\n`);
      process.exit(1);
    }
    imported += batch.length;
    console.log(`   ✓ ${imported}/${records.length} processados...`);
  }

  console.log(`\n✅ Importação concluída: ${imported} alimentos da TACO disponíveis para todos os nutricionistas.`);
  console.log(`   Fonte registrada: "${FONTE_DESCRICAO_TACO}"\n`);
}

main();
