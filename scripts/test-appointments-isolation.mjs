#!/usr/bin/env node
/**
 * Fase 5, Bloco C — confirma que um agendamento de um profissional não é
 * visível (nem editável, nem excluível) por outro profissional, via RLS.
 *
 * Cria 2 contas de teste descartáveis (A e B), cada uma com seu próprio
 * paciente. A cria um agendamento. Confirma que:
 *   1. A enxerga o próprio agendamento.
 *   2. B NÃO enxerga o agendamento de A (select vazio, sem erro — RLS filtra
 *      silenciosamente, não revela que o registro existe).
 *   3. B não consegue atualizar o agendamento de A (0 linhas afetadas).
 *   4. B não consegue "excluir" (soft delete) o agendamento de A.
 *   5. O agendamento de A continua intacto depois das tentativas de B.
 *
 * Uso:  node scripts/test-appointments-isolation.mjs
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
  const email = `teste-agenda-${tag}-${Date.now()}@aurinutri.invalid`;
  const password = `Teste-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`Falha ao criar usuário de teste (${tag}): ${error.message}`);

  const client = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`Falha ao logar usuário de teste (${tag}): ${signInError.message}`);

  return { id: data.user.id, client };
}

async function main() {
  console.log("\n== Teste: isolamento de appointments entre profissionais (RLS) ==\n");

  const userA = await createTestUser("a");
  const userB = await createTestUser("b");

  let patientAId, appointmentId;
  try {
    const { data: patientA, error: patientAError } = await userA.client
      .from("patients")
      .insert({ nome: "Paciente de teste (agenda A)", user_id: userA.id })
      .select("id")
      .single();
    if (patientAError) throw new Error(`Falha ao criar paciente de A: ${patientAError.message}`);
    patientAId = patientA.id;

    const dataHora = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data: appointment, error: appointmentError } = await userA.client
      .from("appointments")
      .insert({
        patient_id: patientAId,
        user_id: userA.id,
        data_hora: dataHora,
        duracao_min: 60,
        tipo: "retorno",
      })
      .select("id, observacoes")
      .single();
    if (appointmentError) throw new Error(`Falha ao criar agendamento de A: ${appointmentError.message}`);
    appointmentId = appointment.id;

    const { data: ownView, error: ownViewError } = await userA.client
      .from("appointments")
      .select("id")
      .eq("id", appointmentId);
    record("A enxerga o próprio agendamento", !ownViewError && ownView?.length === 1, ownViewError?.message);

    const { data: otherView, error: otherViewError } = await userB.client
      .from("appointments")
      .select("id")
      .eq("id", appointmentId);
    record(
      "B NÃO enxerga o agendamento de A",
      !otherViewError && (otherView?.length ?? 0) === 0,
      otherViewError?.message ?? `linhas visíveis para B: ${otherView?.length ?? 0}`
    );

    const { data: updateResult, error: updateError } = await userB.client
      .from("appointments")
      .update({ observacoes: "invadido por B" })
      .eq("id", appointmentId)
      .select("id");
    record(
      "B não consegue atualizar o agendamento de A (0 linhas afetadas)",
      !updateError && (updateResult?.length ?? 0) === 0,
      updateError?.message ?? `linhas afetadas: ${updateResult?.length ?? 0}`
    );

    const { data: deleteResult, error: deleteError } = await userB.client
      .from("appointments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", appointmentId)
      .select("id");
    record(
      "B não consegue excluir (soft delete) o agendamento de A",
      !deleteError && (deleteResult?.length ?? 0) === 0,
      deleteError?.message ?? `linhas afetadas: ${deleteResult?.length ?? 0}`
    );

    const { data: stillIntact } = await admin
      .from("appointments")
      .select("observacoes, deleted_at")
      .eq("id", appointmentId)
      .single();
    record(
      "Agendamento de A continua intacto após as tentativas de B",
      stillIntact?.observacoes !== "invadido por B" && stillIntact?.deleted_at === null,
      JSON.stringify(stillIntact)
    );
  } finally {
    console.log("\nLimpando dados de teste...");
    if (patientAId) await admin.from("patients").delete().eq("id", patientAId); // cascade apaga o agendamento
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
