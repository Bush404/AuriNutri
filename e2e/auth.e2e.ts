import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

import { USER_FILE, type TestUser } from "./env";

function testUser(): TestUser {
  return JSON.parse(readFileSync(USER_FILE, "utf8")) as TestUser;
}

// Sem sessão salva: aqui o próprio login é o que está sendo testado.
test.describe("Autenticação", () => {
  test("rota protegida sem login redireciona para /login mantendo o destino", async ({ page }) => {
    await page.goto("/pacientes");
    await expect(page).toHaveURL(/\/login\?redirectTo=%2Fpacientes/);
  });

  test("senha errada mostra erro e não entra", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(testUser().email);
    await page.getByLabel("Senha").fill("senha-errada-123");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("Não foi possível entrar")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("login correto leva ao destino pedido", async ({ page }) => {
    const user = testUser();
    await page.goto("/login?redirectTo=%2Fpacientes");
    await page.getByLabel("E-mail").fill(user.email);
    await page.getByLabel("Senha").fill(user.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/pacientes$/);
  });
});
