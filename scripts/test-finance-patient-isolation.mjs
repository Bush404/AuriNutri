#!/usr/bin/env node
/**
 * Fase 9, Bloco C — confirma que dado financeiro de paciente (patient_billings
 * e payments) de um profissional não é visível nem editável por outro
 * profissional, via RLS. Mesmo padrão de test-appointments-isolation.mjs.
 *
 * Cria 2 contas de teste descartáveis (A e B), cada uma com seu próprio
 * paciente. A cria uma cobrança avulsa com uma parcela. Confirma que:
 *   1. A enxerga a própria cobrança e o próprio pagamento.
 *   2. B NÃO enxerga a cobrança de A (select vazio, sem erro).
 *   3. B NÃO enxerga o pagamento de A (select vazio, sem erro).
 *   4. B não consegue marcar o pagamento de A como recebido (0 linhas afetadas).
 *   5. B não consegue excluir (soft delete, via RPC) a cobrança de A.
 *   6. A cobrança e o pagamento de A continuam intactos depois das tentativas de B.
 *
 * Uso:  node scripts/test-finance-patient-isolation.mjs
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
  const email = `teste-financeiro-${tag}-${Date.now()}@aurinutri.invalid`;
  const password = `Teste-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`Falha ao criar usuário de teste (${tag}): ${error.message}`);

  const client = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`Falha ao logar usuário de teste (${tag}): ${signInError.message}`);

  return { id: data.user.id, client };
}

async function main() {
  console.log("\n== Teste: isolamento de dado financeiro de paciente entre profissionais (RLS) ==\n");

  const userA = await createTestUser("a");
  const userB = await createTestUser("b");

  let patientAId, billingId, paymentId;
  try {
    const { data: patientA, error: patientAError } = await userA.client
      .from("patients")
      .insert({ nome: "Paciente de teste (financeiro A)", user_id: userA.id })
      .select("id")
      .single();
    if (patientAError) throw new Error(`Falha ao criar paciente de A: ${patientAError.message}`);
    patientAId = patientA.id;

    const { data: billing, error: billingError } = await userA.client
      .from("patient_billings")
      .insert({
        patient_id: patientAId,
        user_id: userA.id,
        tipo: "avulso",
        descricao: "Consulta de teste",
        valor_total: 150,
        data_inicio: new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .single();
    if (billingError) throw new Error(`Falha ao criar cobrança de A: ${billingError.message}`);
    billingId = billing.id;

    const { data: payment, error: paymentError } = await userA.client
      .from("payments")
      .insert({
        billing_id: billingId,
        user_id: userA.id,
        valor: 150,
        data_vencimento: new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .single();
    if (paymentError) throw new Error(`Falha ao criar pagamento de A: ${paymentError.message}`);
    paymentId = payment.id;

    const { data: ownBilling, error: ownBillingError } = await userA.client
      .from("patient_billings")
      .select("id")
      .eq("id", billingId);
    const { data: ownPayment, error: ownPaymentError } = await userA.client
      .from("payments")
      .select("id")
      .eq("id", paymentId);
    record(
      "A enxerga a própria cobrança e o próprio pagamento",
      !ownBillingError && !ownPaymentError && ownBilling?.length === 1 && ownPayment?.length === 1,
      ownBillingError?.message ?? ownPaymentError?.message
    );

    const { data: otherBillingView, error: otherBillingError } = await userB.client
      .from("patient_billings")
      .select("id")
      .eq("id", billingId);
    record(
      "B NÃO enxerga a cobrança de A",
      !otherBillingError && (otherBillingView?.length ?? 0) === 0,
      otherBillingError?.message ?? `linhas visíveis para B: ${otherBillingView?.length ?? 0}`
    );

    const { data: otherPaymentView, error: otherPaymentError } = await userB.client
      .from("payments")
      .select("id")
      .eq("id", paymentId);
    record(
      "B NÃO enxerga o pagamento de A",
      !otherPaymentError && (otherPaymentView?.length ?? 0) === 0,
      otherPaymentError?.message ?? `linhas visíveis para B: ${otherPaymentView?.length ?? 0}`
    );

    const { data: updateResult, error: updateError } = await userB.client
      .from("payments")
      .update({ data_pagamento: new Date().toISOString().slice(0, 10), forma_pagamento: "pix" })
      .eq("id", paymentId)
      .select("id");
    record(
      "B não consegue marcar o pagamento de A como recebido (0 linhas afetadas)",
      !updateError && (updateResult?.length ?? 0) === 0,
      updateError?.message ?? `linhas afetadas: ${updateResult?.length ?? 0}`
    );

    const { data: deleteRpcResult, error: deleteRpcError } = await userB.client.rpc("soft_delete_patient_billing", {
      billing_id: billingId,
    });
    record(
      "B não consegue excluir (RPC) a cobrança de A",
      !deleteRpcError && deleteRpcResult === false,
      deleteRpcError?.message ?? `retorno da função: ${deleteRpcResult}`
    );

    const { data: stillIntactBilling } = await admin
      .from("patient_billings")
      .select("deleted_at")
      .eq("id", billingId)
      .single();
    const { data: stillIntactPayment } = await admin
      .from("payments")
      .select("data_pagamento, forma_pagamento")
      .eq("id", paymentId)
      .single();
    record(
      "Cobrança e pagamento de A continuam intactos após as tentativas de B",
      stillIntactBilling?.deleted_at === null && stillIntactPayment?.data_pagamento === null,
      JSON.stringify({ billing: stillIntactBilling, payment: stillIntactPayment })
    );
  } finally {
    console.log("\nLimpando dados de teste...");
    if (patientAId) await admin.from("patients").delete().eq("id", patientAId); // cascade apaga cobrança e pagamento
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
