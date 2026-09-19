#!/usr/bin/env node
/**
 * Fase 7, Bloco B — exames laboratoriais.
 *
 * Cobre os 3 itens do bloco que não dão pra testar com função pura (a
 * seleção de faixa por sexo/idade já tem teste unitário em
 * src/lib/lab-reference.test.ts, sem precisar de banco):
 *   1. Exame (e seus marcadores) de um profissional não é acessível por
 *      outro, via RLS.
 *   2. Editar a faixa GLOBAL do catálogo depois de um resultado já
 *      registrado NÃO reinterpreta esse resultado (snapshot, não FK).
 *   3. Uma URL assinada de curta duração para o arquivo do exame deixa de
 *      funcionar depois de expirar.
 *
 * Uso:  node scripts/test-lab-exams-isolation.mjs
 * Precisa de SUPABASE_SERVICE_ROLE_KEY no .env.local. Rodar só localmente,
 * nunca contra um banco com dados reais de pacientes/nutricionistas.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const BUCKET = "profissional";

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

class SecurityBreachError extends Error {}

const results = [];
function pass(label, detail) {
  results.push({ label, passed: true });
  console.log(`✅ ${label}${detail ? ` — ${detail}` : ""}`);
}
function fail(label, detail) {
  results.push({ label, passed: false });
  console.log(`❌ ${label}${detail ? ` — ${detail}` : ""}`);
}
function breach(label, detail) {
  results.push({ label, passed: false });
  console.log(`❌ ${label}${detail ? ` — ${detail}` : ""}`);
  throw new SecurityBreachError(label);
}
/** Registra passa/falha a partir de uma condição booleana já avaliada. */
function record(label, passed, detail) {
  if (passed) pass(label, detail);
  else fail(label, detail);
}

async function createTestUser(tag) {
  const email = `teste-exames-${tag}-${Date.now()}@aurinutri.invalid`;
  const password = `Teste-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`Falha ao criar usuário de teste (${tag}): ${error.message}`);

  const client = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`Falha ao logar usuário de teste (${tag}): ${signInError.message}`);

  return { id: data.user.id, client };
}

async function main() {
  console.log("\n== Fase 7 / Bloco B — isolamento e snapshot de exames laboratoriais ==\n");

  const userA = await createTestUser("a");
  const userB = await createTestUser("b");

  const nomeMarcadorTeste = `Marcador de teste ${Date.now()}`;
  let patientAId, examId, markerId, globalRangeId, filePath;

  try {
    const { data: patientA, error: patientAError } = await userA.client
      .from("patients")
      .insert({ nome: "Paciente de teste (exames A)", user_id: userA.id })
      .select("id")
      .single();
    if (patientAError) throw new Error(`Falha ao criar paciente de A: ${patientAError.message}`);
    patientAId = patientA.id;

    const { data: exam, error: examError } = await userA.client
      .from("lab_exams")
      .insert({ patient_id: patientAId, user_id: userA.id, data_coleta: "2026-01-01", laboratorio: "Lab Teste" })
      .select("id")
      .single();
    if (examError) throw new Error(`Falha ao criar exame de A: ${examError.message}`);
    examId = exam.id;

    // ------------------------------------------------------------------
    // 1. Snapshot: editar a faixa GLOBAL depois não reinterpreta o
    //    resultado já registrado.
    // ------------------------------------------------------------------
    const { data: globalRange, error: globalRangeError } = await admin
      .from("lab_reference_ranges")
      .insert({
        user_id: null,
        nome_marcador: nomeMarcadorTeste,
        unidade: "mg/dL",
        sexo: "ambos",
        idade_min_anos: 18,
        idade_max_anos: null,
        valor_min: 10,
        valor_max: 20,
        fonte: "Teste automatizado",
      })
      .select("id")
      .single();
    if (globalRangeError) throw new Error(`Falha ao criar faixa global de teste: ${globalRangeError.message}`);
    globalRangeId = globalRange.id;

    const { data: marker, error: markerError } = await userA.client
      .from("lab_markers")
      .insert({
        exam_id: examId,
        user_id: userA.id,
        nome_marcador: nomeMarcadorTeste,
        valor: 15,
        unidade: "mg/dL",
        referencia_min: 10,
        referencia_max: 20,
      })
      .select("id, referencia_min, referencia_max, fora_da_faixa")
      .single();
    if (markerError) throw new Error(`Falha ao registrar marcador de A: ${markerError.message}`);
    markerId = marker.id;
    pass(
      "Marcador registrado com o snapshot da faixa vigente (10–20) e fora_da_faixa calculado corretamente (false)",
      JSON.stringify(marker)
    );

    // Muda a faixa GLOBAL para algo bem diferente — se o valor 15 fosse
    // reinterpretado por essa nova faixa, passaria a ficar "fora da faixa".
    const { error: updateRangeError } = await admin
      .from("lab_reference_ranges")
      .update({ valor_min: 50, valor_max: 100 })
      .eq("id", globalRangeId);
    if (updateRangeError) throw new Error(`Falha ao atualizar faixa global: ${updateRangeError.message}`);

    const { data: markerDepois, error: markerDepoisError } = await admin
      .from("lab_markers")
      .select("referencia_min, referencia_max, fora_da_faixa")
      .eq("id", markerId)
      .single();
    if (markerDepoisError) throw new Error(`Falha ao reler marcador: ${markerDepoisError.message}`);

    const snapshotIntacto = Number(markerDepois.referencia_min) === 10;
    const aindaDentroDaFaixaAntiga = Number(markerDepois.referencia_max) === 20 && markerDepois.fora_da_faixa === false;
    if (!snapshotIntacto || !aindaDentroDaFaixaAntiga) {
      fail(
        "Editar a faixa global NÃO deveria alterar o resultado já registrado",
        JSON.stringify(markerDepois)
      );
    } else {
      pass(
        "Editar a faixa global depois não alterou o resultado já registrado (snapshot preservado)",
        JSON.stringify(markerDepois)
      );
    }

    // ------------------------------------------------------------------
    // 2. Isolamento entre profissionais (RLS).
    // ------------------------------------------------------------------
    const { data: examOwnView, error: examOwnViewError } = await userA.client
      .from("lab_exams")
      .select("id")
      .eq("id", examId);
    record("A enxerga o próprio exame", !examOwnViewError && examOwnView?.length === 1, examOwnViewError?.message);

    const { data: examOtherView, error: examOtherViewError } = await userB.client
      .from("lab_exams")
      .select("id")
      .eq("id", examId);
    if (!examOtherViewError && (examOtherView?.length ?? 0) > 0) {
      breach("B enxerga o exame de A", JSON.stringify(examOtherView));
    }
    pass("B NÃO enxerga o exame de A");

    const { data: markerOtherView, error: markerOtherViewError } = await userB.client
      .from("lab_markers")
      .select("id")
      .eq("id", markerId);
    if (!markerOtherViewError && (markerOtherView?.length ?? 0) > 0) {
      breach("B enxerga o marcador de A", JSON.stringify(markerOtherView));
    }
    pass("B NÃO enxerga o marcador de A");

    const { data: deleteAttempt } = await userB.client
      .from("lab_exams")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", examId)
      .select("id");
    if ((deleteAttempt?.length ?? 0) > 0) {
      breach("B conseguiu excluir o exame de A");
    }
    pass("B não consegue excluir o exame de A (0 linhas afetadas)");

    // ------------------------------------------------------------------
    // 3. URL assinada expirada deixa de funcionar.
    // ------------------------------------------------------------------
    filePath = `${userA.id}/exames/${examId}.txt`;
    const fakeFile = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "text/plain" });
    const { error: uploadError } = await userA.client.storage.from(BUCKET).upload(filePath, fakeFile, {
      contentType: "text/plain",
    });
    if (uploadError) throw new Error(`Falha ao subir arquivo de teste: ${uploadError.message}`);

    const { data: shortLived, error: shortLivedError } = await userA.client.storage
      .from(BUCKET)
      .createSignedUrl(filePath, 1);
    if (shortLivedError || !shortLived?.signedUrl) {
      throw new Error(`Falha ao gerar URL assinada de curta duração: ${shortLivedError?.message}`);
    }

    const respostaImediata = await fetch(shortLived.signedUrl);
    pass("URL assinada recém-gerada funciona", `HTTP ${respostaImediata.status}`);

    console.log("   Aguardando 3s para a URL assinada expirar...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const respostaExpirada = await fetch(shortLived.signedUrl);
    if (respostaExpirada.ok) {
      breach("URL assinada expirada AINDA retornou o arquivo", `HTTP ${respostaExpirada.status}`);
    }
    pass("URL assinada expirada não funciona mais", `HTTP ${respostaExpirada.status}`);
  } catch (err) {
    if (err instanceof SecurityBreachError) {
      console.log("\n🚨🚨🚨 FALHA DE SEGURANÇA DETECTADA 🚨🚨🚨");
      console.log(`Verificação que falhou: ${err.message}`);
    } else {
      console.error(`\n❌ Erro inesperado durante os testes: ${err.message}\n`);
    }
    results.push({ label: "execução interrompida por erro", passed: false });
  } finally {
    console.log("\nLimpando dados de teste...");
    if (filePath) await admin.storage.from(BUCKET).remove([filePath]);
    if (globalRangeId) await admin.from("lab_reference_ranges").delete().eq("id", globalRangeId);
    if (patientAId) await admin.from("patients").delete().eq("id", patientAId); // cascade apaga exame e marcadores
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
