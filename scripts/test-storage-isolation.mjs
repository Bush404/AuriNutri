#!/usr/bin/env node
/**
 * Fase 2, Bloco C — prova automatizada do isolamento de arquivos entre
 * profissionais no bucket privado 'profissional'.
 *
 * Cria 2 contas de teste descartáveis (A e B) e verifica:
 *   1. B não acessa o arquivo de A pelo caminho direto (download / signed URL)
 *   2. B não lista o conteúdo da pasta de A (deve vir vazio)
 *   3. B não sobrescreve o arquivo de A
 *   4. uma URL assinada expirada para de funcionar
 *
 * Regra de execução: se qualquer verificação que deveria FALHAR passar (ou
 * seja, se um acesso indevido for bem-sucedido), o script para IMEDIATAMENTE,
 * imprime um alerta de falha de segurança e sai com código de erro — não
 * tenta contornar nem seguir para as próximas verificações.
 *
 * Uso:  node scripts/test-storage-isolation.mjs
 * Precisa de SUPABASE_SERVICE_ROLE_KEY no .env.local (mesma chave usada pelo
 * npm run import:taco). Rodar só localmente, nunca contra um banco com dados
 * reais de pacientes/nutricionistas.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const BUCKET = "profissional";

/** Carrega .env.local manualmente (o script roda fora do runtime do Next). */
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
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  console.error(
    "\n❌ Faltam variáveis de ambiente. Defina NEXT_PUBLIC_SUPABASE_URL, " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY no .env.local.\n"
  );
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Lançada quando um acesso que deveria ser negado é, na verdade, bem-sucedido. */
class SecurityBreachError extends Error {}

const results = [];

function pass(label, detail) {
  results.push({ label, passed: true });
  console.log(`✅ ${label}${detail ? ` — ${detail}` : ""}`);
}

/** Registra e imediatamente aborta a execução — usado só para falhas de segurança reais. */
function breach(label, detail) {
  results.push({ label, passed: false });
  console.log(`❌ ${label}${detail ? ` — ${detail}` : ""}`);
  throw new SecurityBreachError(label);
}

async function createTestUser(tag) {
  const email = `teste-isolamento-${tag}-${Date.now()}@aurinutri.invalid`;
  const password = `Teste-${Math.random().toString(36).slice(2)}-${Date.now()}`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`Falha ao criar usuário de teste (${tag}): ${error.message}`);

  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`Falha ao logar usuário de teste (${tag}): ${signInError.message}`);

  return { id: data.user.id, client };
}

async function main() {
  console.log("\n== Fase 2 / Bloco C — teste de isolamento do bucket 'profissional' ==\n");
  console.log("Criando 2 contas de teste descartáveis (A e B)...\n");

  const userA = await createTestUser("a");
  const userB = await createTestUser("b");

  const filePath = `${userA.id}/logo.png`;
  // Cabeçalho mínimo de um PNG válido — suficiente para passar pela validação de tipo.
  const fakeFile = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: "image/png" });
  const overwriteFile = new Blob([new Uint8Array([137, 80, 78, 71, 0, 0, 0, 0])], { type: "image/png" });

  try {
    // Setup: A envia o próprio logo (pré-condição dos testes abaixo).
    const { error: ownUploadError } = await userA.client.storage.from(BUCKET).upload(filePath, fakeFile, {
      contentType: "image/png",
      upsert: true,
    });
    if (ownUploadError) throw new Error(`Setup falhou: A não conseguiu enviar o próprio arquivo — ${ownUploadError.message}`);
    pass("Setup: usuário A enviou o próprio logo");

    // 1. B tenta acessar o arquivo de A pelo caminho direto (download).
    const { error: downloadError } = await userB.client.storage.from(BUCKET).download(filePath);
    if (!downloadError) breach("Usuário B conseguiu BAIXAR o arquivo de A pelo caminho direto");
    pass("Usuário B não consegue baixar o arquivo de A pelo caminho direto", downloadError.message);

    // 1b. B tenta gerar uma URL assinada para o arquivo de A (outra forma de "acesso direto").
    const { data: signedUrlData, error: signedUrlError } = await userB.client.storage
      .from(BUCKET)
      .createSignedUrl(filePath, 60);
    if (!signedUrlError && signedUrlData?.signedUrl) {
      breach("Usuário B conseguiu gerar URL assinada para o arquivo de A");
    }
    pass("Usuário B não consegue gerar URL assinada para o arquivo de A", signedUrlError?.message);

    // 2. B tenta listar a pasta de A → deve vir vazio (RLS filtra as linhas, não retorna erro).
    const { data: listData, error: listError } = await userB.client.storage.from(BUCKET).list(userA.id);
    if (listError) {
      pass("Usuário B não consegue listar a pasta de A (erro)", listError.message);
    } else if (Array.isArray(listData) && listData.length === 0) {
      pass("Usuário B lista a pasta de A e recebe vazio, como esperado");
    } else {
      breach(
        "Usuário B conseguiu listar arquivo(s) na pasta de A",
        JSON.stringify(listData?.map((f) => f.name))
      );
    }

    // 3. B tenta sobrescrever o arquivo de A (mesmo path, upsert:true).
    const { error: overwriteError } = await userB.client.storage.from(BUCKET).upload(filePath, overwriteFile, {
      contentType: "image/png",
      upsert: true,
    });
    if (!overwriteError) breach("Usuário B conseguiu SOBRESCREVER o arquivo de A");
    pass("Usuário B não consegue sobrescrever o arquivo de A", overwriteError.message);

    // Confere que o arquivo de A realmente não mudou (defesa em profundidade da checagem acima).
    const { data: verifyBlob, error: verifyError } = await admin.storage.from(BUCKET).download(filePath);
    if (verifyError) throw new Error(`Não foi possível verificar a integridade do arquivo de A: ${verifyError.message}`);
    const verifyBytes = new Uint8Array(await verifyBlob.arrayBuffer());
    const originalBytes = new Uint8Array(await fakeFile.arrayBuffer());
    const unchanged = verifyBytes.length === originalBytes.length && verifyBytes.every((b, i) => b === originalBytes[i]);
    if (!unchanged) breach("O conteúdo do arquivo de A foi alterado, mesmo com o upload de B tendo retornado erro");
    pass("Conteúdo do arquivo de A permanece intacto");

    // 4. Uma URL assinada expirada não deve mais funcionar (gerada pelo próprio dono, TTL de 1s).
    const { data: shortLivedData, error: shortLivedError } = await userA.client.storage
      .from(BUCKET)
      .createSignedUrl(filePath, 1);
    if (shortLivedError || !shortLivedData?.signedUrl) {
      throw new Error(`Não foi possível gerar a URL assinada de curta duração para o teste: ${shortLivedError?.message}`);
    }
    console.log("   Aguardando 3s para a URL assinada expirar...");
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const expiredResponse = await fetch(shortLivedData.signedUrl);
    if (expiredResponse.ok) {
      breach("URL assinada expirada AINDA retornou o arquivo", `HTTP ${expiredResponse.status}`);
    }
    pass("URL assinada expirada não funciona mais", `HTTP ${expiredResponse.status}`);
  } catch (err) {
    if (err instanceof SecurityBreachError) {
      console.log("\n🚨🚨🚨 FALHA DE SEGURANÇA DETECTADA 🚨🚨🚨");
      console.log(`Verificação que falhou: ${err.message}`);
      console.log(
        "Isso significa que a policy de storage NÃO está isolando os usuários como deveria.\n" +
          "PARANDO A EXECUÇÃO — avise o responsável pelo projeto imediatamente. Não prosseguir\n" +
          "para novos blocos/fases até isso ser corrigido e reverificado.\n"
      );
    } else {
      console.error(`\n❌ Erro inesperado durante os testes: ${err.message}\n`);
    }
    throw err;
  } finally {
    console.log("\nLimpando dados de teste...");
    await admin.storage.from(BUCKET).remove([filePath]);
    await admin.auth.admin.deleteUser(userA.id);
    await admin.auth.admin.deleteUser(userB.id);
  }

  const failed = results.filter((r) => !r.passed);
  console.log(`\n${failed.length === 0 ? "✅ Todos os testes passaram." : `❌ ${failed.length} teste(s) falharam.`}\n`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(() => {
  process.exit(2);
});
