#!/usr/bin/env node
/**
 * Fase 3, Bloco C — confirma o comportamento de exclusão de paciente
 * definido em DECISIONS.md (D5): exclusão real e definitiva, some da
 * listagem e não pode mais ser lido nem pelo próprio dono.
 *
 * Cria um usuário e um paciente de teste, confirma que ele existe, exclui,
 * e confirma que deixou de existir de verdade (não é soft delete).
 *
 * Uso:  node scripts/test-patient-deletion.mjs
 * Precisa de SUPABASE_SERVICE_ROLE_KEY no .env.local. Rodar só localmente.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

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
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvLocal();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  console.error("\n❌ Faltam variáveis de ambiente no .env.local.\n");
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

const results = [];
function record(label, passed, detail) {
  results.push({ label, passed });
  console.log(`${passed ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  console.log("\n== Teste: exclusão de paciente (real e definitiva, por decisão D5) ==\n");

  const email = `teste-exclusao-paciente-${Date.now()}@aurinutri.invalid`;
  const password = `Teste-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  const { data: userData, error: userError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (userError) throw new Error(`Falha ao criar usuário de teste: ${userError.message}`);
  const userId = userData.user.id;

  const client = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`Falha ao logar usuário de teste: ${signInError.message}`);

  try {
    const { data: patient, error: patientError } = await client
      .from("patients")
      .insert({ nome: "Paciente de teste (exclusão)", user_id: userId })
      .select("id")
      .single();
    if (patientError) throw new Error(`Falha ao criar paciente de teste: ${patientError.message}`);
    const patientId = patient.id;

    const { data: beforeList } = await client.from("patients").select("id").eq("id", patientId);
    record("Paciente aparece na listagem antes da exclusão", (beforeList?.length ?? 0) === 1);

    const { error: deleteError } = await client.from("patients").delete().eq("id", patientId);
    record("Exclusão não retorna erro", !deleteError, deleteError?.message);

    const { data: afterList } = await client.from("patients").select("id").eq("id", patientId);
    record("Paciente some da listagem depois de excluído", (afterList?.length ?? 0) === 0);

    // Confirma com a service role (que ignora RLS) que a linha realmente
    // não existe mais — não é "invisível", é "não existe".
    const { data: adminCheck } = await admin.from("patients").select("id").eq("id", patientId);
    record(
      "A linha não existe mais fisicamente no banco (decisão D5, não é soft delete)",
      (adminCheck?.length ?? 0) === 0
    );
  } finally {
    console.log("\nLimpando dados de teste...");
    await admin.auth.admin.deleteUser(userId);
  }

  const failed = results.filter((r) => !r.passed);
  console.log(`\n${failed.length === 0 ? "✅ Todos os testes passaram." : `❌ ${failed.length} teste(s) falharam.`}\n`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`\n❌ Erro inesperado: ${err.message}\n`);
  process.exit(1);
});
