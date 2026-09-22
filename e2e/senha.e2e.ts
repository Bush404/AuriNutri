import { expect, test } from "@playwright/test";

import { adminClient } from "./helpers";

// Sem sessão salva: fluxo de quem esqueceu a senha. Conta própria, descartável,
// para não trocar a senha da conta usada pelos outros testes.
test("redefinir senha pelo link do e-mail — resiste ao filtro de e-mail abrir o link antes", async ({ page, request }) => {
  const admin = adminClient();
  const email = `teste-e2e-senha-${Date.now()}@aurinutri.invalid`;
  const senhaAntiga = `Antiga-${Date.now()}-x`;
  const senhaNova = `Nova-${Date.now()}-y`;
  const { data: criado } = await admin.auth.admin.createUser({ email, password: senhaAntiga, email_confirm: true });

  try {
    // O mesmo token que vai no e-mail de "esqueci a senha" (modelo usa {{ .TokenHash }}).
    const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
    expect(error).toBeNull();
    expect(data.properties?.hashed_token).toBeTruthy();
    const link = `/confirmar?token_hash=${data.properties?.hashed_token}&type=recovery`;

    // Simula o Outlook/antivírus abrindo o link sozinho (só GET) — não pode gastar o token.
    expect((await request.get(link)).status()).toBe(200);
    expect((await request.get(link)).status()).toBe(200);

    await page.goto(link);
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page).toHaveURL(/\/redefinir-senha$/);
    await page.getByLabel("Nova senha", { exact: true }).fill(senhaNova);
    await page.getByLabel("Confirmar nova senha").fill(senhaNova);
    await page.getByRole("button", { name: "Salvar nova senha" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // O link só vale uma vez.
    await page.context().clearCookies();
    await page.goto(link);
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByText(/inválido ou já expirou/)).toBeVisible();

    // E a senha nova é a que vale.
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill(senhaNova);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  } finally {
    if (criado.user) await admin.auth.admin.deleteUser(criado.user.id);
  }
});
