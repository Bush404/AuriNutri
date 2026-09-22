import { expect, test } from "@playwright/test";

import { adminClient } from "./helpers";

// Sem sessão salva: aqui a própria criação de conta é o que está sendo testado.
test("cadastro de conta nova → login → dashboard", async ({ page }) => {
  const email = `teste-e2e-cadastro-${Date.now()}@aurinutri.invalid`;
  const senha = `Cadastro-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  const admin = adminClient();

  try {
    await page.goto("/cadastro");
    await page.getByLabel("Nome completo").fill("Nutricionista E2E");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(senha);
    await page.getByLabel("Confirmar senha").fill(senha);
    await page.getByRole("button", { name: "Criar conta" }).click();

    // Com confirmação de e-mail ligada no Supabase, a tela pede para checar o e-mail;
    // o teste faz a confirmação pelo admin (não há caixa de entrada para um .invalid).
    await Promise.race([
      page.waitForURL(/\/dashboard$/, { timeout: 30_000 }),
      page.getByText("Verifique seu e-mail").waitFor({ timeout: 30_000 }),
    ]);
    if (!page.url().includes("/dashboard")) {
      const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const user = data.users.find((u) => u.email === email);
      expect(user, "conta criada no Supabase").toBeTruthy();
      await admin.auth.admin.updateUserById(user!.id, { email_confirm: true });

      await page.goto("/login");
      await page.getByLabel("E-mail").fill(email);
      await page.getByLabel("Senha").fill(senha);
      await page.getByRole("button", { name: "Entrar" }).click();
    }
    await expect(page).toHaveURL(/\/dashboard$/);
  } finally {
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const user = data.users.find((u) => u.email === email);
    if (user) {
      await admin.from("patients").delete().eq("user_id", user.id);
      await admin.auth.admin.deleteUser(user.id);
    }
  }
});
