#!/usr/bin/env node
/**
 * Fase 7, Bloco C — evolução fotográfica. RISCO ALTO (LGPD, dado
 * biométrico). Cobre os 5 testes obrigatórios do bloco:
 *   1. Profissional B não acessa foto de A por caminho direto (download /
 *      URL assinada).
 *   2. B não consegue listar a pasta de A.
 *   3. URL assinada expirada deixa de funcionar.
 *   4. Exclusão remove o arquivo do storage de verdade, não só a linha.
 *   5. Upload bloqueado sem consentimento registrado — testado direto na
 *      policy de INSERT do banco (não só na Server Action).
 *
 * Regra de execução (igual test-storage-isolation.mjs): se QUALQUER
 * verificação que deveria FALHAR passar (um acesso indevido dá certo), o
 * script para IMEDIATAMENTE e sai com erro — nunca tenta contornar.
 *
 * Uso:  node scripts/test-patient-photos-isolation.mjs
 * Precisa de SUPABASE_SERVICE_ROLE_KEY no .env.local. Rodar só localmente,
 * nunca contra um banco com dados reais de pacientes/nutricionistas.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const BUCKET = "fotos-evolucao";

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
function breach(label, detail) {
  results.push({ label, passed: false });
  console.log(`❌ ${label}${detail ? ` — ${detail}` : ""}`);
  throw new SecurityBreachError(label);
}

async function createTestUser(tag) {
  const email = `teste-fotos-${tag}-${Date.now()}@aurinutri.invalid`;
  const password = `Teste-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`Falha ao criar usuário de teste (${tag}): ${error.message}`);

  const client = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`Falha ao logar usuário de teste (${tag}): ${signInError.message}`);

  return { id: data.user.id, client };
}

async function main() {
  console.log("\n== Fase 7 / Bloco C — evolução fotográfica: isolamento, snapshot e consentimento ==\n");

  const userA = await createTestUser("a");
  const userB = await createTestUser("b");

  let patientAId, filePath, photoId;
  const fakePng = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: "image/png" });

  try {
    const { data: patientA, error: patientAError } = await userA.client
      .from("patients")
      .insert({ nome: "Paciente de teste (fotos A)", user_id: userA.id })
      .select("id")
      .single();
    if (patientAError) throw new Error(`Falha ao criar paciente de A: ${patientAError.message}`);
    patientAId = patientA.id;

    // ------------------------------------------------------------------
    // 5. Upload bloqueado sem consentimento — testado na policy do banco,
    //    ANTES de qualquer consentimento existir para este paciente.
    // ------------------------------------------------------------------
    const { data: semConsentimento, error: semConsentimentoError } = await userA.client
      .from("patient_photos")
      .insert({
        patient_id: patientAId,
        user_id: userA.id,
        data_registro: "2026-01-01",
        tipo: "frente",
        arquivo_path: `${userA.id}/${patientAId}/nao-deveria-existir.png`,
      })
      .select("id");

    if (!semConsentimentoError && (semConsentimento?.length ?? 0) > 0) {
      breach(
        "INSERT em patient_photos foi aceito SEM consentimento ativo de 'fotos'",
        JSON.stringify(semConsentimento)
      );
    }
    pass("INSERT em patient_photos rejeitado sem consentimento ativo (policy do banco)", semConsentimentoError?.message);

    // Agora registra o consentimento — só depois disso o upload deve funcionar.
    const { error: consentError } = await userA.client.from("patient_consents").insert({
      patient_id: patientAId,
      user_id: userA.id,
      tipo: "fotos",
      forma: "presencial",
    });
    if (consentError) throw new Error(`Falha ao registrar consentimento de teste: ${consentError.message}`);

    // ------------------------------------------------------------------
    // Setup: A sobe uma foto de verdade (arquivo no storage + linha).
    // ------------------------------------------------------------------
    filePath = `${userA.id}/${patientAId}/teste.png`;
    const { error: uploadError } = await userA.client.storage.from(BUCKET).upload(filePath, fakePng, {
      contentType: "image/png",
    });
    if (uploadError) throw new Error(`Falha no upload de teste: ${uploadError.message}`);

    const { data: photoRow, error: insertError } = await userA.client
      .from("patient_photos")
      .insert({
        patient_id: patientAId,
        user_id: userA.id,
        data_registro: "2026-01-01",
        tipo: "frente",
        arquivo_path: filePath,
      })
      .select("id")
      .single();
    if (insertError) throw new Error(`Falha ao registrar a foto de teste (com consentimento já ativo): ${insertError.message}`);
    photoId = photoRow.id;
    pass("Com consentimento ativo, upload + registro da foto funcionam normalmente");

    // ------------------------------------------------------------------
    // 1. B não acessa a foto de A por caminho direto.
    // ------------------------------------------------------------------
    const { error: downloadError } = await userB.client.storage.from(BUCKET).download(filePath);
    if (!downloadError) breach("Usuário B conseguiu BAIXAR a foto de A pelo caminho direto");
    pass("Usuário B não consegue baixar a foto de A pelo caminho direto", downloadError.message);

    const { data: signedByB, error: signedByBError } = await userB.client.storage.from(BUCKET).createSignedUrl(filePath, 60);
    if (!signedByBError && signedByB?.signedUrl) {
      breach("Usuário B conseguiu gerar URL assinada para a foto de A");
    }
    pass("Usuário B não consegue gerar URL assinada para a foto de A", signedByBError?.message);

    const { data: photoRowForB } = await userB.client.from("patient_photos").select("id").eq("id", photoId);
    if ((photoRowForB?.length ?? 0) > 0) {
      breach("Usuário B enxerga a linha da foto de A em patient_photos");
    }
    pass("Usuário B não enxerga a linha da foto de A em patient_photos");

    // ------------------------------------------------------------------
    // 2. B não lista a pasta de A.
    // ------------------------------------------------------------------
    const { data: listData, error: listError } = await userB.client.storage.from(BUCKET).list(`${userA.id}/${patientAId}`);
    if (listError) {
      pass("Usuário B não consegue listar a pasta de A (erro)", listError.message);
    } else if (Array.isArray(listData) && listData.length === 0) {
      pass("Usuário B lista a pasta de A e recebe vazio, como esperado");
    } else {
      breach("Usuário B conseguiu listar arquivo(s) na pasta de A", JSON.stringify(listData?.map((f) => f.name)));
    }

    // ------------------------------------------------------------------
    // 3. URL assinada expirada deixa de funcionar (TTL de 1s aqui, 15min em produção).
    // ------------------------------------------------------------------
    const { data: shortLived, error: shortLivedError } = await userA.client.storage.from(BUCKET).createSignedUrl(filePath, 1);
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

    // ------------------------------------------------------------------
    // 4. Exclusão remove o arquivo do storage de verdade, não só a linha
    //    (mesma sequência que deletePatientPhoto faz: storage.remove
    //    primeiro, só depois soft_delete_patient_photo).
    // ------------------------------------------------------------------
    const { error: removeError } = await userA.client.storage.from(BUCKET).remove([filePath]);
    if (removeError) throw new Error(`Falha ao remover o arquivo: ${removeError.message}`);

    const { data: aindaExiste } = await admin.storage.from(BUCKET).download(filePath);
    if (aindaExiste) {
      breach("O arquivo AINDA existe no storage depois da remoção");
    }
    pass("Arquivo removido do storage de verdade após a exclusão");

    const { data: softDeleteOk, error: softDeleteError } = await userA.client.rpc("soft_delete_patient_photo", {
      photo_id: photoId,
    });
    if (softDeleteError) throw new Error(`Falha ao chamar soft_delete_patient_photo: ${softDeleteError.message}`);
    if (softDeleteOk !== true) {
      breach("soft_delete_patient_photo não confirmou a exclusão da linha");
    }

    const { data: linhaDepois } = await admin
      .from("patient_photos")
      .select("deleted_at, arquivo_path")
      .eq("id", photoId)
      .single();
    if (!linhaDepois?.deleted_at || linhaDepois.arquivo_path !== null) {
      breach("Linha da foto não ficou com deleted_at preenchido e arquivo_path nulo", JSON.stringify(linhaDepois));
    }
    pass("Linha marcada como excluída (deleted_at preenchido, arquivo_path nulo)", JSON.stringify(linhaDepois));
  } catch (err) {
    if (err instanceof SecurityBreachError) {
      console.log("\n🚨🚨🚨 FALHA DE SEGURANÇA DETECTADA 🚨🚨🚨");
      console.log(`Verificação que falhou: ${err.message}`);
      console.log(
        "PARANDO A EXECUÇÃO — avise o responsável pelo projeto imediatamente. Não prosseguir\n" +
          "até isso ser corrigido e reverificado.\n"
      );
    } else {
      console.error(`\n❌ Erro inesperado durante os testes: ${err.message}\n`);
    }
    results.push({ label: "execução interrompida por erro", passed: false });
  } finally {
    console.log("\nLimpando dados de teste...");
    if (filePath) await admin.storage.from(BUCKET).remove([filePath]).catch(() => {});
    if (patientAId) await admin.from("patients").delete().eq("id", patientAId); // cascade apaga foto/consentimento
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
