#!/usr/bin/env node
/**
 * Fase 3, Bloco B — prova de que `anamnesis` é 1:N por paciente: cria duas
 * anamneses para o MESMO paciente e confirma que ambas persistem (a segunda
 * não sobrescreve a primeira, como acontecia antes da migration 0006).
 *
 * Cria um usuário e um paciente de teste descartáveis, insere dois
 * registros de anamnese (do jeito que a Server Action createAnamnesis faz —
 * respeitando RLS, não via service role), confere que os dois existem com
 * conteúdo distinto, e limpa tudo ao final.
 *
 * Uso:  node scripts/test-anamnesis-history.mjs
 * Precisa de SUPABASE_SERVICE_ROLE_KEY no .env.local (mesma chave usada
 * pelo npm run import:taco). Rodar só localmente.
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
  console.error(
    "\n❌ Faltam variáveis de ambiente. Defina NEXT_PUBLIC_SUPABASE_URL, " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY no .env.local.\n"
  );
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const results = [];
function record(label, passed, detail) {
  results.push({ label, passed });
  console.log(`${passed ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  console.log("\n== Teste: anamnesis 1:N (duas anamneses para o mesmo paciente) ==\n");

  const email = `teste-anamnesis-${Date.now()}@aurinutri.invalid`;
  const password = `Teste-${Math.random().toString(36).slice(2)}-${Date.now()}`;

  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (userError) throw new Error(`Falha ao criar usuário de teste: ${userError.message}`);
  const userId = userData.user.id;

  const client = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`Falha ao logar usuário de teste: ${signInError.message}`);

  let patientId;
  try {
    const { data: patient, error: patientError } = await client
      .from("patients")
      .insert({ nome: "Paciente de teste (anamnesis history)", user_id: userId })
      .select("id")
      .single();
    if (patientError) throw new Error(`Falha ao criar paciente de teste: ${patientError.message}`);
    patientId = patient.id;

    const { error: firstError } = await client
      .from("anamnesis")
      .insert({ patient_id: patientId, user_id: userId, queixa_principal: "Primeira consulta — queixa inicial" });
    record("Primeira anamnese criada", !firstError, firstError?.message);

    const { error: secondError } = await client
      .from("anamnesis")
      .insert({ patient_id: patientId, user_id: userId, queixa_principal: "Retorno — queixa atualizada" });
    record(
      "Segunda anamnese para o MESMO paciente criada (sem violar unicidade)",
      !secondError,
      secondError?.message
    );

    const { data: rows, error: listError } = await client
      .from("anamnesis")
      .select("queixa_principal, data_registro")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: true });

    record("Consegue listar as anamneses do paciente", !listError, listError?.message);
    record("Ambas as anamneses persistem (2 linhas)", (rows?.length ?? 0) === 2, `encontradas: ${rows?.length ?? 0}`);

    const first = rows?.[0]?.queixa_principal;
    const second = rows?.[1]?.queixa_principal;
    record(
      "A segunda NÃO sobrescreveu a primeira (conteúdos distintos)",
      first === "Primeira consulta — queixa inicial" && second === "Retorno — queixa atualizada",
      `[1] "${first}" / [2] "${second}"`
    );
  } finally {
    console.log("\nLimpando dados de teste...");
    if (patientId) await admin.from("patients").delete().eq("id", patientId); // cascade apaga as anamneses
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
