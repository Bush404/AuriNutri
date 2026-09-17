#!/usr/bin/env node
/**
 * Fase 3, Bloco C — testa a trilha de auditoria (audit_log):
 *   1. Uma alteração em dado clínico (anamnesis) gera linha em audit_log,
 *      com a ação certa (insert/update) e o conteúdo certo.
 *   2. Um profissional NÃO enxerga o audit_log de outro (RLS).
 *
 * Cria 2 contas de teste descartáveis (A e B). A cria um paciente e uma
 * anamnese, depois edita essa anamnese — confere que as duas ações geraram
 * linha em audit_log com o conteúdo esperado, e que A consegue ler o
 * próprio log. B tenta ler o mesmo registro e deve receber lista vazia.
 * Limpa tudo ao final.
 *
 * Uso:  node scripts/test-audit-log.mjs
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
  const email = `teste-audit-${tag}-${Date.now()}@aurinutri.invalid`;
  const password = `Teste-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`Falha ao criar usuário de teste (${tag}): ${error.message}`);

  const client = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`Falha ao logar usuário de teste (${tag}): ${signInError.message}`);

  return { id: data.user.id, client };
}

async function main() {
  console.log("\n== Teste: audit_log (registra alteração clínica + isolamento entre profissionais) ==\n");

  const userA = await createTestUser("a");
  const userB = await createTestUser("b");

  let patientId, anamnesisId;
  try {
    const { data: patient, error: patientError } = await userA.client
      .from("patients")
      .insert({ nome: "Paciente de teste (audit log)", user_id: userA.id })
      .select("id")
      .single();
    if (patientError) throw new Error(`Falha ao criar paciente: ${patientError.message}`);
    patientId = patient.id;

    const { data: anamnese, error: createError } = await userA.client
      .from("anamnesis")
      .insert({ patient_id: patientId, user_id: userA.id, queixa_principal: "Versão 1" })
      .select("id")
      .single();
    if (createError) throw new Error(`Falha ao criar anamnese: ${createError.message}`);
    anamnesisId = anamnese.id;

    const { error: updateError } = await userA.client
      .from("anamnesis")
      .update({ queixa_principal: "Versão 2" })
      .eq("id", anamnesisId);
    if (updateError) throw new Error(`Falha ao atualizar anamnese: ${updateError.message}`);

    const { data: ownLogs, error: ownLogsError } = await userA.client
      .from("audit_log")
      .select("acao, dados_novos")
      .eq("tabela", "anamnesis")
      .eq("registro_id", anamnesisId)
      .order("timestamp", { ascending: true });

    record("Usuário A consegue ler o próprio audit_log", !ownLogsError, ownLogsError?.message);
    record("audit_log tem 1 linha de insert + 1 de update", (ownLogs?.length ?? 0) === 2, `encontradas: ${ownLogs?.length ?? 0}`);
    record(
      "Linha de insert registrou o conteúdo certo",
      ownLogs?.[0]?.acao === "insert" && ownLogs?.[0]?.dados_novos?.queixa_principal === "Versão 1",
      JSON.stringify(ownLogs?.[0])
    );
    record(
      "Linha de update registrou o conteúdo certo",
      ownLogs?.[1]?.acao === "update" && ownLogs?.[1]?.dados_novos?.queixa_principal === "Versão 2",
      JSON.stringify(ownLogs?.[1])
    );

    const { data: otherLogs, error: otherLogsError } = await userB.client
      .from("audit_log")
      .select("id")
      .eq("registro_id", anamnesisId);

    record(
      "Usuário B NÃO enxerga o audit_log de A",
      !otherLogsError && (otherLogs?.length ?? 0) === 0,
      otherLogsError?.message ?? `linhas visíveis para B: ${otherLogs?.length ?? 0}`
    );
  } finally {
    console.log("\nLimpando dados de teste...");
    if (patientId) await admin.from("patients").delete().eq("id", patientId); // cascade apaga a anamnese
    if (anamnesisId) {
      await admin.from("audit_log").delete().eq("tabela", "anamnesis").eq("registro_id", anamnesisId);
    }
    if (patientId) {
      await admin.from("audit_log").delete().eq("tabela", "patients").eq("registro_id", patientId);
    }
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
