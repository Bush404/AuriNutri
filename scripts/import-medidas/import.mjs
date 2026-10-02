#!/usr/bin/env node
/**
 * Importa as medidas caseiras do IBGE (POF 2008–2009, "Tabela de medidas
 * referidas para os alimentos consumidos no Brasil") para `food_measures`,
 * ligadas aos alimentos da TACO pelo código TACO (Fase 17, Bloco D).
 *
 * Uso:  npm run import:medidas
 * Precisa da TACO já importada (npm run import:taco) e da migration 0045.
 *
 * A ligação TACO → IBGE está pronta em medidas-ibge-taco.json (gerada e
 * revisada à mão — ver README.md). Pode rodar de novo quantas vezes quiser:
 * apaga as medidas do IBGE e grava de novo; as medidas criadas pelos
 * profissionais (user_id preenchido) nunca são tocadas, e os planos guardam
 * a própria cópia da medida, então também não mudam.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const DADOS = path.join(__dirname, "medidas-ibge-taco.json");

/** Carrega .env.local manualmente (o script roda fora do runtime do Next). */
function loadEnvLocal() {
  const envPath = path.join(PROJECT_ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  for (const rawLine of readFileSync(envPath, "utf-8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!(key in process.env)) process.env[key] = line.slice(eq + 1).trim();
  }
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) {
    console.error("❌ Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no .env.local.");
    process.exit(1);
  }
  const supabase = createClient(url, chave, { auth: { autoRefreshToken: false, persistSession: false } });

  /** @type {{codigo_taco: number, taco: string, medidas: {nome: string, gramas: number}[]}[]} */
  const ligacoes = JSON.parse(readFileSync(DADOS, "utf-8"));

  const { data: foods, error: foodsError } = await supabase
    .from("foods")
    .select("id, codigo_taco")
    .eq("is_global", true)
    .not("codigo_taco", "is", null);
  if (foodsError) throw foodsError;
  const idPorCodigo = new Map(foods.map((f) => [Number(f.codigo_taco), f.id]));

  const linhas = [];
  const semAlimento = [];
  for (const l of ligacoes) {
    const foodId = idPorCodigo.get(l.codigo_taco);
    if (!foodId) {
      semAlimento.push(`${l.codigo_taco} ${l.taco}`);
      continue;
    }
    for (const m of l.medidas)
      linhas.push({ food_id: foodId, user_id: null, nome: m.nome, gramas: m.gramas, fonte: "ibge" });
  }
  if (semAlimento.length) {
    console.warn(`⚠️  ${semAlimento.length} código(s) TACO não encontrados no banco (rode npm run import:taco antes):`);
    for (const s of semAlimento) console.warn(`   - ${s}`);
  }

  console.log(
    `\n🚀 Gravando ${linhas.length} medidas do IBGE para ${ligacoes.length - semAlimento.length} alimentos da TACO...`,
  );
  const { error: apagarError } = await supabase.from("food_measures").delete().eq("fonte", "ibge");
  if (apagarError) throw apagarError;
  for (let i = 0; i < linhas.length; i += 500) {
    const { error } = await supabase.from("food_measures").insert(linhas.slice(i, i + 500));
    if (error) throw error;
  }

  const { count } = await supabase
    .from("food_measures")
    .select("id", { count: "exact", head: true })
    .eq("fonte", "ibge");
  console.log(`✅ Pronto: ${count} medidas do IBGE no banco.`);
}

main().catch((e) => {
  console.error("❌ Falhou:", e.message ?? e);
  process.exit(1);
});
