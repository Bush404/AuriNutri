#!/usr/bin/env node
/**
 * Fase 11, Bloco A — verifica que a função check_rate_limit (migration 0034)
 * realmente conta e bloqueia depois do limite, e que o contador é isolado
 * por usuário (A estourar o limite não afeta B).
 *
 * Uso:  node scripts/test-rate-limit.mjs
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

async function createTestUser(tag) {
  const email = `teste-ratelimit-${tag}-${Date.now()}@aurinutri.invalid`;
  const password = `Teste-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`Falha ao criar usuário de teste (${tag}): ${error.message}`);

  const client = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`Falha ao logar usuário de teste (${tag}): ${signInError.message}`);

  return { id: data.user.id, client };
}

async function main() {
  console.log("\n== Fase 11, Bloco A — verificação de check_rate_limit ==\n");

  const userA = await createTestUser("a");
  const userB = await createTestUser("b");

  try {
    const acao = "teste_rate_limit";
    const maxTentativas = 3;
    const janelaSegundos = 60;

    for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
      const { data, error } = await userA.client.rpc("check_rate_limit", {
        p_acao: acao,
        p_max_tentativas: maxTentativas,
        p_janela_segundos: janelaSegundos,
      });
      record(`Tentativa ${tentativa}/${maxTentativas} de A é permitida`, !error && data === true, error?.message ?? `retorno: ${data}`);
    }

    const { data: quartaTentativa, error: quartaError } = await userA.client.rpc("check_rate_limit", {
      p_acao: acao,
      p_max_tentativas: maxTentativas,
      p_janela_segundos: janelaSegundos,
    });
    record("Tentativa extra de A (acima do limite) é BLOQUEADA", !quartaError && quartaTentativa === false, `retorno: ${quartaTentativa}`);

    const { data: primeiraTentativaB, error: bError } = await userB.client.rpc("check_rate_limit", {
      p_acao: acao,
      p_max_tentativas: maxTentativas,
      p_janela_segundos: janelaSegundos,
    });
    record(
      "B tem seu próprio contador — não é afetado pelo limite estourado de A",
      !bError && primeiraTentativaB === true,
      bError?.message ?? `retorno: ${primeiraTentativaB}`
    );

    const { data: outraAcaoA, error: outraAcaoError } = await userA.client.rpc("check_rate_limit", {
      p_acao: "outra_acao_teste",
      p_max_tentativas: maxTentativas,
      p_janela_segundos: janelaSegundos,
    });
    record(
      "A continua liberado numa AÇÃO diferente (contador é por ação, não global)",
      !outraAcaoError && outraAcaoA === true,
      outraAcaoError?.message ?? `retorno: ${outraAcaoA}`
    );
  } finally {
    console.log("\nLimpando dados de teste...");
    await admin.from("rate_limit_counters").delete().in("user_id", [userA.id, userB.id]);
    await admin.auth.admin.deleteUser(userA.id);
    await admin.auth.admin.deleteUser(userB.id);
  }

  const failed = results.filter((r) => !r.passed);
  console.log(`\n${failed.length === 0 ? "✅ Todos os testes passaram." : `❌ ${failed.length} teste(s) falharam.`}\n`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`\n❌ Erro inesperado: ${err.message}\n`);
  process.exit(2);
});
