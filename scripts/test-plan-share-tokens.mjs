#!/usr/bin/env node
/**
 * Fase 4, Bloco D — testa o compartilhamento de plano por link:
 *   1. Um token de outro profissional não abre o plano (RLS + RPC isolados).
 *   2. Um token revogado deixa de funcionar.
 *   3. Um token expirado deixa de funcionar.
 *
 * Cria 2 profissionais de teste (A e B), cada um com paciente + plano.
 * Insere 3 tokens de teste pra A (válido, revogado, expirado) direto via
 * service role — não precisa gerar um PDF de verdade pra testar a lógica de
 * validação do token. Resolve cada token como um visitante anônimo faria de
 * verdade (RPC get_shared_plan_pdf com a anon key, sem sessão nenhuma).
 *
 * Uso:  node scripts/test-plan-share-tokens.mjs
 * Precisa de SUPABASE_SERVICE_ROLE_KEY no .env.local. Rodar só localmente.
 */
import { readFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const PROJECT_ROOT = process.cwd();

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
  const email = `teste-share-${tag}-${Date.now()}@aurinutri.invalid`;
  const password = `Teste-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`Falha ao criar usuário de teste (${tag}): ${error.message}`);

  const client = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`Falha ao logar usuário de teste (${tag}): ${signInError.message}`);

  return { id: data.user.id, client };
}

async function main() {
  console.log("\n== Teste: compartilhamento de plano por link (token) ==\n");

  const userA = await createTestUser("a");
  const userB = await createTestUser("b");

  let patientAId, planAId;
  try {
    const { data: patientA, error: patientAError } = await userA.client
      .from("patients")
      .insert({ nome: "Paciente A (share test)", user_id: userA.id })
      .select("id")
      .single();
    if (patientAError) throw new Error(`Falha ao criar paciente A: ${patientAError.message}`);
    patientAId = patientA.id;

    const { data: planA, error: planAError } = await userA.client
      .from("meal_plans")
      .insert({ patient_id: patientAId, user_id: userA.id, nome: "Plano A (share test)" })
      .select("id")
      .single();
    if (planAError) throw new Error(`Falha ao criar plano A: ${planAError.message}`);
    planAId = planA.id;

    const tokenValido = randomUUID().replace(/-/g, "");
    const tokenRevogado = randomUUID().replace(/-/g, "");
    const tokenExpirado = randomUUID().replace(/-/g, "");

    const umDiaMs = 24 * 60 * 60 * 1000;
    const { data: insertedTokens, error: insertError } = await admin
      .from("plan_share_tokens")
      .insert([
        {
          meal_plan_id: planAId,
          user_id: userA.id,
          token: tokenValido,
          storage_path: `${userA.id}/${planAId}.pdf`,
          signed_url: "https://example.invalid/fake-signed-url-valido.pdf",
          expires_at: new Date(Date.now() + 90 * umDiaMs).toISOString(),
        },
        {
          meal_plan_id: planAId,
          user_id: userA.id,
          token: tokenRevogado,
          storage_path: `${userA.id}/${planAId}.pdf`,
          signed_url: "https://example.invalid/fake-signed-url-revogado.pdf",
          expires_at: new Date(Date.now() + 90 * umDiaMs).toISOString(),
          revoked_at: new Date().toISOString(),
        },
        {
          meal_plan_id: planAId,
          user_id: userA.id,
          token: tokenExpirado,
          storage_path: `${userA.id}/${planAId}.pdf`,
          signed_url: "https://example.invalid/fake-signed-url-expirado.pdf",
          expires_at: new Date(Date.now() - umDiaMs).toISOString(),
        },
      ])
      .select("id");
    if (insertError) throw new Error(`Falha ao inserir tokens de teste: ${insertError.message}`);

    // Resolve cada token como um visitante anônimo faria de verdade — sem
    // sessão nenhuma, exatamente como a rota pública /compartilhado/[token].
    const anonimo = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: validoResult } = await anonimo.rpc("get_shared_plan_pdf", { p_token: tokenValido });
    record(
      "Token válido resolve o plano certo",
      Array.isArray(validoResult) && validoResult.length === 1 && validoResult[0].plano_nome === "Plano A (share test)",
      JSON.stringify(validoResult)
    );

    const { data: revogadoResult } = await anonimo.rpc("get_shared_plan_pdf", { p_token: tokenRevogado });
    record(
      "Token revogado NÃO abre o plano",
      Array.isArray(revogadoResult) && revogadoResult.length === 0,
      `retornou: ${JSON.stringify(revogadoResult)}`
    );

    const { data: expiradoResult } = await anonimo.rpc("get_shared_plan_pdf", { p_token: tokenExpirado });
    record(
      "Token expirado NÃO abre o plano",
      Array.isArray(expiradoResult) && expiradoResult.length === 0,
      `retornou: ${JSON.stringify(expiradoResult)}`
    );

    const { data: tokenInexistente } = await anonimo.rpc("get_shared_plan_pdf", { p_token: "token-que-nao-existe" });
    record(
      "Token inexistente/adivinhado NÃO abre nada",
      Array.isArray(tokenInexistente) && tokenInexistente.length === 0
    );

    // "Outro profissional não abre o plano" — B (autenticado, mas dono de
    // NADA relacionado ao plano de A) não consegue nem ENXERGAR a linha do
    // token de A na tabela normal (RLS), que é como ele gerenciaria/revogaria
    // links pela própria conta.
    const { data: bTentandoVerTokenDeA, error: bError } = await userB.client
      .from("plan_share_tokens")
      .select("id")
      .eq("id", insertedTokens[0].id);
    record(
      "Usuário B não enxerga o token de A na própria tabela (RLS)",
      !bError && (bTentandoVerTokenDeA?.length ?? 0) === 0,
      bError?.message ?? `linhas visíveis para B: ${bTentandoVerTokenDeA?.length ?? 0}`
    );
  } finally {
    console.log("\nLimpando dados de teste...");
    await admin.auth.admin.deleteUser(userA.id);
    await admin.auth.admin.deleteUser(userB.id);
  }

  const failed = results.filter((r) => !r.passed);
  console.log(`\n${failed.length === 0 ? "✅ Todos os testes passaram." : `❌ ${failed.length} teste(s) falharam.`}\n`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`\n❌ Erro inesperado: ${err.message}\n`);
  process.exit(1);
});
