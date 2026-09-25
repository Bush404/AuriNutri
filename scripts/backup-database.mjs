#!/usr/bin/env node
/**
 * Backup manual completo: todas as tabelas, as contas de login e os arquivos
 * do Storage.
 *
 * O plano gratuito do Supabase não permite baixar nem restaurar o backup
 * automático do dashboard, então este script exporta o CONTEÚDO de cada tabela
 * (todas as linhas, de todos os usuários — usa a service role key, que ignora
 * RLS) para arquivos .json locais, e baixa cada arquivo de cada bucket. Não é
 * um dump binário do Postgres (schema/triggers/índices já estão versionados em
 * supabase/migrations/), mas é suficiente para inspecionar ou restaurar dados
 * manualmente se uma migration corromper ou apagar algo por engano.
 *
 * Serve enquanto o AuriNutri só tem dados de teste. Antes do primeiro paciente
 * real, o projeto passa para o plano pago do Supabase (backup diário
 * automático) — ver docs/ROADMAP_2.md, Fase 12. Guardar cópias com dados de
 * saúde reais num computador pessoal é risco de LGPD.
 *
 * Uso:  npm run backup:db
 * Precisa de SUPABASE_SERVICE_ROLE_KEY no .env.local (mesma chave usada pelo
 * npm run import:taco). Remova a chave do .env.local depois de rodar.
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

// Todas as tabelas de dados do produto (schema completo em supabase/migrations/).
// `rate_limit_counters` fica de fora de propósito: é só um contador temporário.
// Ao criar uma tabela nova numa migration, acrescente-a aqui.
const TABLES = [
  "profiles",
  "patients",
  "anamnesis",
  "anamnesis_templates",
  "anthropometric_assessments",
  "foods",
  "meal_plans",
  "meals",
  "meal_items",
  "meal_item_substitutions",
  "meal_templates",
  "meal_template_items",
  "plan_share_tokens",
  "document_share_tokens",
  "recipes",
  "recipe_ingredients",
  "appointments",
  "tasks",
  "patient_consents",
  "lab_exams",
  "lab_markers",
  "lab_reference_ranges",
  "patient_photos",
  "expenses",
  "expense_occurrences",
  "patient_billings",
  "payments",
  "library_materials",
  "feedback",
  "audit_log",
];

// Buckets do Storage (criados nas migrations 0004, 0010, 0015, 0020, 0023).
const BUCKETS = ["profissional", "planos", "receitas", "documentos", "fotos-evolucao"];

// O Supabase devolve no máximo 1000 linhas por consulta — busca em páginas.
const PAGE_SIZE = 1000;

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

loadEnvLocal();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "\n❌ Faltam variáveis de ambiente. Defina NEXT_PUBLIC_SUPABASE_URL e " +
      "SUPABASE_SERVICE_ROLE_KEY no .env.local.\n"
  );
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function fetchAllRows(table) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from(table)
      .select("*")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

async function fetchAllUsers() {
  const users = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) throw new Error(`contas de login: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < PAGE_SIZE) return users;
  }
}

/** Lista todos os arquivos de um bucket, entrando em cada pasta. */
async function listAllFiles(bucket, prefix = "") {
  const files = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await admin.storage
      .from(bucket)
      .list(prefix, { limit: PAGE_SIZE, offset });
    if (error) throw new Error(`bucket ${bucket}: ${error.message}`);
    for (const item of data) {
      const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
      // Pastas vêm sem id; arquivos têm id.
      if (item.id === null) files.push(...(await listAllFiles(bucket, itemPath)));
      else files.push(itemPath);
    }
    if (data.length < PAGE_SIZE) return files;
  }
}

/** O Storage às vezes responde "Gateway Timeout" num arquivo isolado — tenta de novo. */
async function downloadWithRetry(bucket, filePath, attempts = 4) {
  for (let attempt = 1; ; attempt++) {
    const { data, error } = await admin.storage.from(bucket).download(filePath);
    if (!error) return data;
    if (attempt === attempts) throw new Error(`${bucket}/${filePath}: ${error.message}`);
    await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
  }
}

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(PROJECT_ROOT, "backups", timestamp);
  mkdirSync(outDir, { recursive: true });

  console.log(`\n== Backup manual completo — ${timestamp} ==\n`);

  let totalRows = 0;
  for (const table of TABLES) {
    const rows = await fetchAllRows(table);
    writeFileSync(path.join(outDir, `${table}.json`), JSON.stringify(rows, null, 2), "utf-8");
    totalRows += rows.length;
    console.log(`✅ ${table}: ${rows.length} linha(s)`);
  }

  const users = await fetchAllUsers();
  writeFileSync(path.join(outDir, "auth_users.json"), JSON.stringify(users, null, 2), "utf-8");
  console.log(`✅ contas de login: ${users.length}`);

  let totalFiles = 0;
  for (const bucket of BUCKETS) {
    const files = await listAllFiles(bucket);
    for (const filePath of files) {
      const data = await downloadWithRetry(bucket, filePath);
      const target = path.join(outDir, "storage", bucket, ...filePath.split("/"));
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, Buffer.from(await data.arrayBuffer()));
    }
    totalFiles += files.length;
    console.log(`✅ arquivos em ${bucket}: ${files.length}`);
  }

  console.log(
    `\n✅ Backup completo: ${totalRows} linha(s), ${users.length} conta(s), ${totalFiles} arquivo(s).`
  );
  console.log(`📁 Pasta: ${outDir}\n`);
}

main().catch((err) => {
  console.error(`\n❌ Backup incompleto — ${err.message}\n`);
  process.exit(1);
});
