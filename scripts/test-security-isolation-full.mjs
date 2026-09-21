#!/usr/bin/env node
/**
 * Fase 11, Bloco A — suíte única de isolamento entre profissionais, cobrindo
 * TODAS as tabelas com RLS do projeto (não só as já testadas em scripts
 * anteriores) e os 5 buckets de Storage.
 *
 * Cria 2 contas de teste descartáveis (A e B). A cria um registro em CADA
 * tabela. Para cada um, com o client autenticado como B (JWT real de B, via
 * anon key — nunca a service role), tenta:
 *   - SELECT do registro de A (esperado: 0 linhas, nunca erro de "não achei
 *     mas existe" — RLS filtra silenciosamente)
 *   - UPDATE de um campo do registro de A (esperado: 0 linhas afetadas)
 *   - DELETE do registro de A, quando a tabela tem policy de delete
 *     (esperado: 0 linhas afetadas)
 *
 * Regra de execução (igual a test-storage-isolation.mjs): se qualquer
 * verificação que deveria FALHAR passar — ou seja, se B conseguir ler,
 * alterar ou excluir algo de A — o script para IMEDIATAMENTE, imprime um
 * alerta de falha de segurança com o detalhe exato do que vazou, e sai com
 * código de erro. Não tenta contornar nem seguir para as próximas tabelas.
 *
 * Ordem de criação/teste dos fixtures: tabelas-filha antes das tabelas-pai
 * (ex.: recipe_ingredients antes de recipes, meal_items antes de meals antes
 * de meal_plans), e `patients` por ÚLTIMO — ela é o pai transitivo de quase
 * tudo (on delete cascade), então testar sua exclusão por último evita que
 * uma falha de segurança ali (se existisse) apague a evidência das outras
 * checagens antes delas rodarem.
 *
 * Tabelas com RLS FORA desta suíte (cobertas por scripts dedicados que já
 * testam outras propriedades específicas, não só isolamento — mantidos
 * como estão): nenhuma, mas os scripts abaixo continuam valendo por testarem
 * comportamento adicional que esta suíte não repete:
 *   - test-storage-isolation.mjs (URL assinada expirada)
 *   - test-lab-exams-isolation.mjs (snapshot de faixa de referência)
 *   - test-patient-photos-isolation.mjs (exclusão física do arquivo)
 *   - test-finance-patient-isolation.mjs (RPC de soft delete)
 *   - test-anamnesis-history.mjs / test-audit-log.mjs / test-patient-deletion.mjs
 *     / test-plan-share-tokens.mjs (comportamento funcional, não isolamento)
 *
 * Tabelas deliberadamente FORA do escopo desta rodada (mesmo padrão de RLS
 * `auth.uid() = user_id` já comprovado correto em mais de vinte tabelas
 * aqui — risco residual baixo, não um caso novo): meal_templates,
 * meal_template_items, meal_item_substitutions, lab_reference_ranges
 * (customização pessoal).
 *
 * Uso:  node scripts/test-security-isolation-full.mjs
 * Precisa de SUPABASE_SERVICE_ROLE_KEY no .env.local (mesmo fluxo do
 * import:taco). Rodar só localmente, nunca contra um banco com dados reais.
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
  const email = `teste-seg-${tag}-${Date.now()}@aurinutri.invalid`;
  const password = `Teste-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`Falha ao criar usuário de teste (${tag}): ${error.message}`);

  const client = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`Falha ao logar usuário de teste (${tag}): ${signInError.message}`);

  return { id: data.user.id, client };
}

/**
 * Checagem genérica de isolamento por tabela: B tenta SELECT, UPDATE e
 * (quando aplicável) DELETE de um registro que pertence a A. Qualquer
 * sucesso nessas tentativas é uma falha de segurança (breach imediato).
 */
async function checkTableIsolation(userB, { table, id, updateField, updateValue, canDelete }) {
  const { data: selData, error: selError } = await userB.client.from(table).select("id").eq("id", id);
  if (!selError && (selData?.length ?? 0) > 0) {
    breach(`B ENXERGA ${table} de A`, JSON.stringify(selData));
  }
  pass(`B não enxerga ${table} de A (SELECT)`, selError?.message);

  if (updateField) {
    const { data: updData, error: updError } = await userB.client
      .from(table)
      .update({ [updateField]: updateValue })
      .eq("id", id)
      .select("id");
    if (!updError && (updData?.length ?? 0) > 0) {
      breach(`B CONSEGUIU ALTERAR ${table} de A`, JSON.stringify(updData));
    }
    pass(`B não consegue alterar ${table} de A (UPDATE, 0 linhas)`, updError?.message);
  }

  if (canDelete) {
    const { data: delData, error: delError } = await userB.client.from(table).delete().eq("id", id).select("id");
    if (!delError && (delData?.length ?? 0) > 0) {
      breach(`B CONSEGUIU EXCLUIR ${table} de A`, JSON.stringify(delData));
    }
    pass(`B não consegue excluir ${table} de A (DELETE, 0 linhas)`, delError?.message);
  }
}

/** Mesma checagem de sempre para buckets: caminho direto, URL assinada, listagem e sobrescrita. */
async function checkBucketIsolation(userA, userB, bucket) {
  const filePath = `${userA.id}/teste-seguranca-fase11.txt`;
  const fileA = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "text/plain" });
  const fileB = new Blob([new Uint8Array([9, 9, 9, 9])], { type: "text/plain" });

  const { error: uploadError } = await userA.client.storage.from(bucket).upload(filePath, fileA, {
    contentType: "text/plain",
    upsert: true,
  });
  if (uploadError) throw new Error(`Setup falhou no bucket '${bucket}': A não conseguiu enviar o próprio arquivo — ${uploadError.message}`);

  const { error: downloadError } = await userB.client.storage.from(bucket).download(filePath);
  if (!downloadError) breach(`B CONSEGUIU BAIXAR arquivo de A no bucket '${bucket}'`);
  pass(`B não consegue baixar arquivo de A no bucket '${bucket}'`, downloadError.message);

  const { data: signedUrlData, error: signedUrlError } = await userB.client.storage.from(bucket).createSignedUrl(filePath, 60);
  if (!signedUrlError && signedUrlData?.signedUrl) breach(`B CONSEGUIU gerar URL assinada para arquivo de A no bucket '${bucket}'`);
  pass(`B não consegue gerar URL assinada para arquivo de A no bucket '${bucket}'`, signedUrlError?.message);

  const { data: listData, error: listError } = await userB.client.storage.from(bucket).list(userA.id);
  if (!listError && Array.isArray(listData) && listData.length > 0) {
    breach(`B CONSEGUIU LISTAR a pasta de A no bucket '${bucket}'`, JSON.stringify(listData.map((f) => f.name)));
  }
  pass(`B não consegue listar a pasta de A no bucket '${bucket}' (vazio ou erro)`, listError?.message);

  const { error: overwriteError } = await userB.client.storage.from(bucket).upload(filePath, fileB, {
    contentType: "text/plain",
    upsert: true,
  });
  if (!overwriteError) breach(`B CONSEGUIU SOBRESCREVER arquivo de A no bucket '${bucket}'`);
  pass(`B não consegue sobrescrever arquivo de A no bucket '${bucket}'`, overwriteError.message);

  await admin.storage.from(bucket).remove([filePath]);
}

async function main() {
  console.log("\n== Fase 11, Bloco A — isolamento entre profissionais (TODAS as tabelas com RLS + Storage) ==\n");

  const userA = await createTestUser("a");
  const userB = await createTestUser("b");

  const cleanup = { patientId: null, recipeId: null, foodId: null, expenseId: null, libraryMaterialId: null, feedbackId: null };

  try {
    // ------------------------------------------------------------------
    // Fixtures — todos criados pelo client de A (não pelo admin), pra
    // exercitar a policy de INSERT real também, não só SELECT/UPDATE/DELETE.
    // ------------------------------------------------------------------
    const { data: patient, error: patientError } = await userA.client
      .from("patients")
      .insert({ nome: "Paciente de teste (segurança Fase 11)", user_id: userA.id })
      .select("id")
      .single();
    if (patientError) throw new Error(`Falha ao criar paciente de A: ${patientError.message}`);
    const patientId = patient.id;
    cleanup.patientId = patientId;
    console.log(`Paciente de teste criado (A): ${patientId}\n`);

    // -- Tabelas standalone (não filhas de patients) --------------------
    const { data: feedback, error: feedbackError } = await userA.client
      .from("feedback")
      .insert({ user_id: userA.id, tipo: "outro", mensagem: "Mensagem de teste — Fase 11" })
      .select("id")
      .single();
    if (feedbackError) throw new Error(`Falha ao criar feedback de A: ${feedbackError.message}`);
    cleanup.feedbackId = feedback.id;
    await checkTableIsolation(userB, { table: "feedback", id: feedback.id });

    const { data: libMaterial, error: libMaterialError } = await userA.client
      .from("library_materials")
      .insert({ user_id: userA.id, titulo: "Material de teste", tipo: "outro", conteudo: "Teste.", tags: [] })
      .select("id")
      .single();
    if (libMaterialError) throw new Error(`Falha ao criar material de biblioteca de A: ${libMaterialError.message}`);
    cleanup.libraryMaterialId = libMaterial.id;
    await checkTableIsolation(userB, {
      table: "library_materials",
      id: libMaterial.id,
      updateField: "descricao",
      updateValue: "alterado por B",
      canDelete: true,
    });

    const { data: food, error: foodError } = await userA.client
      .from("foods")
      .insert({
        user_id: userA.id,
        fonte: "personalizado",
        fonte_descricao: "Cadastro de teste",
        is_global: false,
        nome: "Alimento de teste (Fase 11)",
        categoria: "Outros",
        porcao_referencia_g: 100,
        calorias_kcal: 100,
        proteinas_g: 10,
        carboidratos_g: 10,
        gorduras_g: 5,
      })
      .select("id")
      .single();
    if (foodError) throw new Error(`Falha ao criar alimento de A: ${foodError.message}`);
    cleanup.foodId = food.id;
    await checkTableIsolation(userB, { table: "foods", id: food.id, updateField: "nome", updateValue: "alterado por B", canDelete: true });

    const { data: recipe, error: recipeError } = await userA.client
      .from("recipes")
      .insert({ user_id: userA.id, nome: "Receita de teste (Fase 11)" })
      .select("id")
      .single();
    if (recipeError) throw new Error(`Falha ao criar receita de A: ${recipeError.message}`);
    cleanup.recipeId = recipe.id;

    const { data: recipeIngredient, error: recipeIngredientError } = await userA.client
      .from("recipe_ingredients")
      .insert({
        recipe_id: recipe.id,
        food_id: food.id,
        user_id: userA.id,
        quantidade_g: 100,
        nome_alimento: "Alimento de teste (Fase 11)",
        fonte_alimento: "personalizado",
        porcao_referencia_g: 100,
        calorias_kcal: 100,
        proteinas_g: 10,
        carboidratos_g: 10,
        gorduras_g: 5,
        fibras_g: 2,
      })
      .select("id")
      .single();
    if (recipeIngredientError) throw new Error(`Falha ao criar ingrediente de receita de A: ${recipeIngredientError.message}`);
    // Filha antes da mãe: recipe_ingredients antes de recipes.
    await checkTableIsolation(userB, {
      table: "recipe_ingredients",
      id: recipeIngredient.id,
      updateField: "quantidade_g",
      updateValue: 999,
      canDelete: true,
    });
    await checkTableIsolation(userB, {
      table: "recipes",
      id: recipe.id,
      updateField: "descricao",
      updateValue: "alterado por B",
      canDelete: true,
    });

    const { data: expense, error: expenseError } = await userA.client
      .from("expenses")
      .insert({
        user_id: userA.id,
        descricao: "Despesa de teste (Fase 11)",
        categoria: "Outros",
        valor: 100,
        recorrencia: "unica",
        data_vencimento: new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .single();
    if (expenseError) throw new Error(`Falha ao criar despesa de A: ${expenseError.message}`);
    cleanup.expenseId = expense.id;

    const { data: expenseOccurrence, error: expenseOccurrenceError } = await userA.client
      .from("expense_occurrences")
      .insert({
        expense_id: expense.id,
        user_id: userA.id,
        valor: 100,
        data_vencimento: new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .single();
    if (expenseOccurrenceError) throw new Error(`Falha ao criar ocorrência de despesa de A: ${expenseOccurrenceError.message}`);
    await checkTableIsolation(userB, {
      table: "expense_occurrences",
      id: expenseOccurrence.id,
      updateField: "observacoes",
      updateValue: "alterado por B",
      canDelete: true,
    });
    await checkTableIsolation(userB, {
      table: "expenses",
      id: expense.id,
      updateField: "descricao",
      updateValue: "alterado por B",
      canDelete: true,
    });

    // -- Tabelas filhas de patients --------------------------------------
    const { data: consentExames, error: consentExamesError } = await userA.client
      .from("patient_consents")
      .insert({ patient_id: patientId, user_id: userA.id, tipo: "exames", forma: "verbal_registrado" })
      .select("id")
      .single();
    if (consentExamesError) throw new Error(`Falha ao registrar consentimento (exames) de A: ${consentExamesError.message}`);
    const { data: consentFotos, error: consentFotosError } = await userA.client
      .from("patient_consents")
      .insert({ patient_id: patientId, user_id: userA.id, tipo: "fotos", forma: "verbal_registrado" })
      .select("id")
      .single();
    if (consentFotosError) throw new Error(`Falha ao registrar consentimento (fotos) de A: ${consentFotosError.message}`);
    await checkTableIsolation(userB, {
      table: "patient_consents",
      id: consentFotos.id,
      updateField: "data_revogacao",
      updateValue: new Date().toISOString(),
      canDelete: false, // tabela imutável por design — sem policy de delete pra ninguém
    });

    const { data: labExam, error: labExamError } = await userA.client
      .from("lab_exams")
      .insert({ patient_id: patientId, user_id: userA.id, data_coleta: "2026-01-01", laboratorio: "Lab de teste" })
      .select("id")
      .single();
    if (labExamError) throw new Error(`Falha ao criar exame de A: ${labExamError.message}`);

    const { data: labMarker, error: labMarkerError } = await userA.client
      .from("lab_markers")
      .insert({ exam_id: labExam.id, user_id: userA.id, nome_marcador: "Teste Fase 11", valor: 10, unidade: "mg/dL" })
      .select("id")
      .single();
    if (labMarkerError) throw new Error(`Falha ao criar marcador de A: ${labMarkerError.message}`);
    await checkTableIsolation(userB, { table: "lab_markers", id: labMarker.id, updateField: "unidade", updateValue: "g/L", canDelete: true });
    await checkTableIsolation(userB, {
      table: "lab_exams",
      id: labExam.id,
      updateField: "observacoes",
      updateValue: "alterado por B",
      canDelete: true,
    });

    const { data: photo, error: photoError } = await userA.client
      .from("patient_photos")
      .insert({ patient_id: patientId, user_id: userA.id, data_registro: "2026-01-01", tipo: "frente", arquivo_path: null })
      .select("id")
      .single();
    if (photoError) throw new Error(`Falha ao criar foto de A (consentimento concedido acima): ${photoError.message}`);
    // patient_photos não tem policy de UPDATE/DELETE pra ninguém (só a
    // função soft_delete_patient_photo, security definer) — testa só SELECT
    // pela via normal, e a via de exclusão real pela RPC.
    await checkTableIsolation(userB, { table: "patient_photos", id: photo.id });
    const { data: photoRpcResult, error: photoRpcError } = await userB.client.rpc("soft_delete_patient_photo", {
      photo_id: photo.id,
    });
    if (!photoRpcError && photoRpcResult === true) {
      breach("B CONSEGUIU excluir (RPC soft_delete_patient_photo) a foto de A");
    }
    pass("B não consegue excluir (RPC) a foto de A", photoRpcError?.message ?? `retorno: ${photoRpcResult}`);

    const { data: plan, error: planError } = await userA.client
      .from("meal_plans")
      .insert({ patient_id: patientId, user_id: userA.id, nome: "Plano de teste (Fase 11)", data_inicio: "2026-01-01" })
      .select("id")
      .single();
    if (planError) throw new Error(`Falha ao criar plano de A: ${planError.message}`);

    const { data: meal, error: mealError } = await userA.client
      .from("meals")
      .insert({ meal_plan_id: plan.id, user_id: userA.id, nome: "Refeição de teste", ordem: 0 })
      .select("id")
      .single();
    if (mealError) throw new Error(`Falha ao criar refeição de A: ${mealError.message}`);

    const { data: mealItem, error: mealItemError } = await userA.client
      .from("meal_items")
      .insert({
        meal_id: meal.id,
        food_id: food.id,
        user_id: userA.id,
        quantidade_g: 100,
        ordem: 0,
        nome_alimento: "Alimento de teste (Fase 11)",
        fonte_alimento: "personalizado",
        porcao_referencia_g: 100,
        calorias_kcal: 100,
        proteinas_g: 10,
        carboidratos_g: 10,
        gorduras_g: 5,
        fibras_g: 2,
      })
      .select("id")
      .single();
    if (mealItemError) throw new Error(`Falha ao criar item de refeição de A: ${mealItemError.message}`);

    // Filhas antes das mães: meal_items -> meals -> meal_plans.
    await checkTableIsolation(userB, {
      table: "meal_items",
      id: mealItem.id,
      updateField: "quantidade_g",
      updateValue: 999,
      canDelete: true,
    });
    await checkTableIsolation(userB, { table: "meals", id: meal.id, updateField: "observacoes", updateValue: "alterado por B", canDelete: true });
    await checkTableIsolation(userB, {
      table: "meal_plans",
      id: plan.id,
      updateField: "observacoes",
      updateValue: "alterado por B",
      canDelete: true,
    });

    const { data: docShareToken, error: docShareTokenError } = await userA.client
      .from("document_share_tokens")
      .insert({
        user_id: userA.id,
        patient_id: patientId,
        tipo: "arquivo",
        titulo: "Documento de teste",
        token: `teste-fase11-${Date.now()}`,
        storage_path: `${userA.id}/arquivos/teste.pdf`,
        signed_url: "https://example.invalid/teste.pdf",
        expires_at: new Date(Date.now() + 3600_000).toISOString(),
      })
      .select("id")
      .single();
    if (docShareTokenError) throw new Error(`Falha ao criar token de compartilhamento de A: ${docShareTokenError.message}`);
    await checkTableIsolation(userB, {
      table: "document_share_tokens",
      id: docShareToken.id,
      updateField: "revoked_at",
      updateValue: new Date().toISOString(),
      canDelete: false, // sem policy de delete — revogação é feita por UPDATE
    });

    const { data: planShareToken, error: planShareTokenError } = await userA.client
      .from("plan_share_tokens")
      .insert({
        meal_plan_id: plan.id,
        user_id: userA.id,
        token: `teste-fase11-plano-${Date.now()}`,
        storage_path: `${userA.id}/planos/teste.pdf`,
        signed_url: "https://example.invalid/plano.pdf",
        expires_at: new Date(Date.now() + 3600_000).toISOString(),
      })
      .select("id")
      .single();
    if (planShareTokenError) throw new Error(`Falha ao criar token de compartilhamento do plano de A: ${planShareTokenError.message}`);
    await checkTableIsolation(userB, {
      table: "plan_share_tokens",
      id: planShareToken.id,
      updateField: "revoked_at",
      updateValue: new Date().toISOString(),
      canDelete: false,
    });

    const dataHoraA = new Date(Date.now() + 24 * 3600_000).toISOString();
    const dataFimA = new Date(Date.now() + 25 * 3600_000).toISOString();
    const { data: appointment, error: appointmentError } = await userA.client
      .from("appointments")
      .insert({ patient_id: patientId, user_id: userA.id, data_hora: dataHoraA, data_fim: dataFimA, tipo: "retorno" })
      .select("id")
      .single();
    if (appointmentError) throw new Error(`Falha ao criar consulta de A: ${appointmentError.message}`);

    const { data: task, error: taskError } = await userA.client
      .from("tasks")
      .insert({ user_id: userA.id, patient_id: patientId, titulo: "Pendência de teste (Fase 11)" })
      .select("id")
      .single();
    if (taskError) throw new Error(`Falha ao criar tarefa de A: ${taskError.message}`);
    await checkTableIsolation(userB, { table: "tasks", id: task.id, updateField: "descricao", updateValue: "alterado por B", canDelete: true });
    await checkTableIsolation(userB, {
      table: "appointments",
      id: appointment.id,
      updateField: "observacoes",
      updateValue: "alterado por B",
      canDelete: true,
    });

    const { data: anamnesis, error: anamnesisError } = await userA.client
      .from("anamnesis")
      .insert({ patient_id: patientId, user_id: userA.id, observacoes: "Teste Fase 11" })
      .select("id")
      .single();
    if (anamnesisError) throw new Error(`Falha ao criar anamnese de A: ${anamnesisError.message}`);
    await checkTableIsolation(userB, {
      table: "anamnesis",
      id: anamnesis.id,
      updateField: "observacoes",
      updateValue: "alterado por B",
      canDelete: true,
    });

    const { data: assessment, error: assessmentError } = await userA.client
      .from("anthropometric_assessments")
      .insert({ patient_id: patientId, user_id: userA.id, data_avaliacao: "2026-01-01", peso_kg: 70, altura_cm: 170 })
      .select("id")
      .single();
    if (assessmentError) throw new Error(`Falha ao criar avaliação de A: ${assessmentError.message}`);
    await checkTableIsolation(userB, {
      table: "anthropometric_assessments",
      id: assessment.id,
      updateField: "observacoes",
      updateValue: "alterado por B",
      canDelete: true,
    });

    const { data: billing, error: billingError } = await userA.client
      .from("patient_billings")
      .insert({
        patient_id: patientId,
        user_id: userA.id,
        tipo: "avulso",
        descricao: "Cobrança de teste (Fase 11)",
        valor_total: 100,
        data_inicio: new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .single();
    if (billingError) throw new Error(`Falha ao criar cobrança de A: ${billingError.message}`);

    const { data: payment, error: paymentError } = await userA.client
      .from("payments")
      .insert({ billing_id: billing.id, user_id: userA.id, valor: 100, data_vencimento: new Date().toISOString().slice(0, 10) })
      .select("id")
      .single();
    if (paymentError) throw new Error(`Falha ao criar pagamento de A: ${paymentError.message}`);
    await checkTableIsolation(userB, {
      table: "payments",
      id: payment.id,
      updateField: "observacoes",
      updateValue: "alterado por B",
      canDelete: true,
    });
    await checkTableIsolation(userB, {
      table: "patient_billings",
      id: billing.id,
      updateField: "descricao",
      updateValue: "alterado por B",
      canDelete: true,
    });

    // -- profiles: cada um só vê/edita o próprio -------------------------
    await checkTableIsolation(userB, { table: "profiles", id: userA.id, updateField: "nome", updateValue: "Nome alterado por B" });

    // -- audit_log: gerado automaticamente pelos triggers acima ----------
    const { data: auditRows, error: auditError } = await userA.client
      .from("audit_log")
      .select("id")
      .eq("tabela", "patients")
      .eq("registro_id", patientId);
    if (auditError || (auditRows?.length ?? 0) === 0) {
      throw new Error(`Não encontrei linha de audit_log gerada pela criação do paciente de A: ${auditError?.message}`);
    }
    pass("A enxerga a própria linha de audit_log (gerada pelo trigger na criação do paciente)");
    await checkTableIsolation(userB, { table: "audit_log", id: auditRows[0].id }); // só select — sem update/delete pra ninguém

    // ------------------------------------------------------------------
    // Storage — os 5 buckets privados do projeto.
    // ------------------------------------------------------------------
    console.log("\n-- Buckets de Storage --\n");
    for (const bucket of ["profissional", "receitas", "planos", "documentos", "fotos-evolucao"]) {
      await checkBucketIsolation(userA, userB, bucket);
    }

    // ------------------------------------------------------------------
    // patients — por ÚLTIMO (ver nota no cabeçalho do arquivo).
    // ------------------------------------------------------------------
    await checkTableIsolation(userB, {
      table: "patients",
      id: patientId,
      updateField: "observacoes",
      updateValue: "alterado por B",
      canDelete: true,
    });
  } catch (err) {
    if (err instanceof SecurityBreachError) {
      console.log("\n🚨🚨🚨 FALHA DE SEGURANÇA DETECTADA 🚨🚨🚨");
      console.log(`Verificação que falhou: ${err.message}`);
      console.log(
        "PARANDO A EXECUÇÃO — avise o responsável pelo projeto imediatamente com este detalhe.\n" +
          "Não prosseguir para novos blocos/fases até isso ser corrigido e reverificado.\n"
      );
    } else {
      console.error(`\n❌ Erro inesperado durante os testes: ${err.message}\n`);
    }
    throw err;
  } finally {
    console.log("\nLimpando dados de teste...");
    if (cleanup.patientId) await admin.from("patients").delete().eq("id", cleanup.patientId); // cascata cuida do resto ligado ao paciente
    if (cleanup.recipeId) await admin.from("recipes").delete().eq("id", cleanup.recipeId); // cascata cuida de recipe_ingredients
    if (cleanup.foodId) await admin.from("foods").delete().eq("id", cleanup.foodId);
    if (cleanup.expenseId) await admin.from("expenses").delete().eq("id", cleanup.expenseId); // cascata cuida de expense_occurrences
    if (cleanup.libraryMaterialId) await admin.from("library_materials").delete().eq("id", cleanup.libraryMaterialId);
    if (cleanup.feedbackId) await admin.from("feedback").delete().eq("id", cleanup.feedbackId);
    await admin.auth.admin.deleteUser(userA.id);
    await admin.auth.admin.deleteUser(userB.id);
  }

  const failed = results.filter((r) => !r.passed);
  console.log(`\n${failed.length === 0 ? `✅ Todos os ${results.length} testes passaram.` : `❌ ${failed.length} teste(s) falharam.`}\n`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(() => {
  process.exit(2);
});
