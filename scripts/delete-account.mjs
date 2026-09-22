#!/usr/bin/env node
/**
 * Exclusão completa de uma conta de profissional (ex.: pedido de exclusão pela LGPD).
 *
 *   npm run delete-account -- email@da.conta            → mostra o que será apagado (não apaga)
 *   npm run delete-account -- email@da.conta --confirmar → apaga de verdade
 *
 * Ordem: (1) arquivos da conta nos 5 buckets de Storage — o banco não apaga arquivos
 * sozinho; todo arquivo fica sob a pasta `<user_id>/` (garantido pelas policies);
 * (2) a conta em auth.users — a cascata leva pacientes, planos, receitas, agenda,
 * financeiro, biblioteca, tokens e o audit_log (migrations 0035 + 0036); (3) confere
 * que não sobrou nenhuma linha nem arquivo.
 *
 * Precisa de SUPABASE_SERVICE_ROLE_KEY no .env.local (mesmo fluxo do import:taco).
 * Sem volta: não existe backup deste lado.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

const BUCKETS = ["profissional", "planos", "receitas", "fotos-evolucao", "documentos"];
// Toda tabela com user_id (as 28 do teste de isolamento + as que ficaram fora dele).
const TABELAS = [
  "patients", "anamnesis", "anthropometric_assessments", "foods", "recipes", "recipe_ingredients",
  "meal_plans", "meals", "meal_items", "meal_templates", "meal_template_items", "meal_item_substitutions",
  "appointments", "tasks", "patient_consents", "lab_exams", "lab_markers", "patient_photos",
  "expenses", "expense_occurrences", "patient_billings", "payments", "library_materials", "feedback",
  "document_share_tokens", "plan_share_tokens", "rate_limit_counters", "audit_log",
];

const [email, flag] = process.argv.slice(2);
const confirmar = flag === "--confirmar";
if (!email) {
  console.error("Uso: npm run delete-account -- email@da.conta [--confirmar]");
  process.exit(1);
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no .env.local.");
  process.exit(1);
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function listarArquivos(bucket, prefixo) {
  const arquivos = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.storage.from(bucket).list(prefixo, { limit: 1000, offset });
    if (error) throw new Error(`Falha ao listar ${bucket}/${prefixo}: ${error.message}`);
    for (const item of data) {
      const caminho = `${prefixo}/${item.name}`;
      if (item.id === null) arquivos.push(...(await listarArquivos(bucket, caminho))); // subpasta
      else arquivos.push(caminho);
    }
    if (data.length < 1000) break;
  }
  return arquivos;
}

async function contarLinhas(userId) {
  const restantes = {};
  for (const tabela of TABELAS) {
    const { count, error } = await admin.from(tabela).select("*", { count: "exact", head: true }).eq("user_id", userId);
    if (error) continue; // tabela sem user_id ou inexistente neste banco
    if (count) restantes[tabela] = count;
  }
  const { count: perfil } = await admin.from("profiles").select("*", { count: "exact", head: true }).eq("id", userId);
  if (perfil) restantes.profiles = perfil;
  return restantes;
}

async function listarTodosArquivos(userId) {
  const porBucket = {};
  for (const bucket of BUCKETS) porBucket[bucket] = await listarArquivos(bucket, userId);
  return porBucket;
}

const { data: lista, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listError) throw listError;
const user = lista.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (!user) {
  console.error(`Nenhuma conta com o e-mail ${email}.`);
  process.exit(1);
}

const linhas = await contarLinhas(user.id);
const arquivos = await listarTodosArquivos(user.id);
const totalArquivos = Object.values(arquivos).reduce((s, a) => s + a.length, 0);

console.log(`Conta: ${user.email} (${user.id}), criada em ${user.created_at}`);
console.log("Registros no banco:", Object.keys(linhas).length ? linhas : "nenhum");
console.log(`Arquivos no Storage: ${totalArquivos}`, Object.fromEntries(Object.entries(arquivos).map(([b, a]) => [b, a.length])));

if (!confirmar) {
  console.log("\nNada foi apagado. Para apagar de verdade, rode de novo com --confirmar no final.");
  process.exit(0);
}

for (const [bucket, caminhos] of Object.entries(arquivos)) {
  for (let i = 0; i < caminhos.length; i += 100) {
    const { error } = await admin.storage.from(bucket).remove(caminhos.slice(i, i + 100));
    if (error) throw new Error(`Falha ao apagar arquivos de ${bucket}: ${error.message}`);
  }
}

const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
if (deleteError) {
  console.error(`❌ Arquivos apagados, mas a conta não: ${deleteError.message}`);
  console.error("   Confira se as migrations 0035 e 0036 foram aplicadas no Supabase.");
  process.exit(1);
}

const sobraLinhas = await contarLinhas(user.id);
const sobraArquivos = Object.values(await listarTodosArquivos(user.id)).reduce((s, a) => s + a.length, 0);
if (Object.keys(sobraLinhas).length || sobraArquivos) {
  console.error("❌ A conta foi excluída, mas sobrou:", sobraLinhas, `arquivos: ${sobraArquivos}`);
  process.exit(1);
}
console.log(`\n✅ Conta ${user.email} excluída. Conferido: 0 registros no banco, 0 arquivos no Storage.`);
