#!/usr/bin/env node
/**
 * Backup manual de segurança antes de migrations arriscadas (Fase 3 em diante).
 *
 * O plano gratuito do Supabase não permite baixar o backup automático do
 * dashboard, então este script exporta o CONTEÚDO de cada tabela (todas as
 * linhas, de todos os usuários — usa a service role key, que ignora RLS)
 * para arquivos .json locais. Não é um dump binário do Postgres (não captura
 * schema/triggers/índices — isso já está versionado em supabase/migrations/),
 * mas é suficiente para inspecionar ou restaurar dados manualmente se uma
 * migration corromper ou apagar algo por engano.
 *
 * Uso:  node scripts/backup-database.mjs
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
const TABLES = [
  "profiles",
  "patients",
  "anamnesis",
  "anthropometric_assessments",
  "foods",
  "meal_plans",
  "meals",
  "meal_items",
];

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

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(PROJECT_ROOT, "backups", timestamp);
  mkdirSync(outDir, { recursive: true });

  console.log(`\n== Backup manual do banco — ${timestamp} ==\n`);

  let totalRows = 0;
  for (const table of TABLES) {
    const { data, error, count } = await admin.from(table).select("*", { count: "exact" });

    if (error) {
      console.error(`❌ ${table}: falhou — ${error.message}`);
      process.exit(1);
    }

    const filePath = path.join(outDir, `${table}.json`);
    writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    totalRows += count ?? data.length;
    console.log(`✅ ${table}: ${data.length} linha(s) salvas em backups/${timestamp}/${table}.json`);
  }

  console.log(`\n✅ Backup completo. ${totalRows} linha(s) no total.`);
  console.log(`📁 Pasta: ${outDir}\n`);
}

main().catch((err) => {
  console.error(`\n❌ Erro inesperado: ${err.message}\n`);
  process.exit(1);
});
