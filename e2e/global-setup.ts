import { mkdirSync, writeFileSync } from "node:fs";
import { chromium, type FullConfig } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { AUTH_DIR, STORAGE_STATE, USER_FILE, loadEnvLocal, type TestUser } from "./env";

/**
 * Cria a conta descartável do teste (e-mail já confirmado, sem depender de SMTP)
 * e faz login pela tela real uma vez, salvando a sessão para os demais testes.
 */
export default async function globalSetup(config: FullConfig) {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no .env.local. " +
        "Coloque a service role key temporariamente para rodar os testes E2E (ver e2e/README.md)."
    );
  }

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const user: Omit<TestUser, "id"> = {
    email: `teste-e2e-${Date.now()}@aurinutri.invalid`,
    password: `E2e-${Math.random().toString(36).slice(2)}-${Date.now()}`,
  };
  const { data, error } = await admin.auth.admin.createUser({ ...user, email_confirm: true });
  if (error) throw new Error(`Falha ao criar usuário de teste: ${error.message}`);

  mkdirSync(AUTH_DIR, { recursive: true });
  writeFileSync(USER_FILE, JSON.stringify({ id: data.user.id, ...user }));

  const baseURL = config.projects[0].use.baseURL!;
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(user.email);
  await page.getByLabel("Senha").fill(user.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/dashboard", { timeout: 90_000 });
  await page.context().storageState({ path: STORAGE_STATE });
  await browser.close();
}
