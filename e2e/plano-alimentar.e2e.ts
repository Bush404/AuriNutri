import { expect, test } from "@playwright/test";

import { STORAGE_STATE } from "./env";

test.use({ storageState: STORAGE_STATE });

// Fluxo central do produto, do cadastro do paciente ao cálculo de macros.
test("cadastrar paciente, criar plano, adicionar refeição e alimento TACO", async ({ page }) => {
  const nomePaciente = `Paciente E2E ${Date.now()}`;

  await page.goto("/pacientes/novo");
  await page.getByLabel("Nome completo").fill(nomePaciente);
  await page.getByRole("button", { name: "Cadastrar paciente" }).click();
  await expect(page).toHaveURL(/\/pacientes\/[0-9a-f-]{36}$/);
  await expect(page.getByText(nomePaciente).first()).toBeVisible();

  await page.getByRole("tab", { name: "Planos alimentares" }).click();
  await page.getByRole("button", { name: "Criar plano alimentar" }).click();
  await page.getByLabel("Nome do plano").fill("Plano E2E");
  await page.getByRole("button", { name: "Criar e montar refeições" }).click();
  await expect(page).toHaveURL(/\/planos\/[0-9a-f-]{36}$/);

  await page.getByRole("button", { name: "Adicionar refeição" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome da refeição").fill("Café da manhã");
  await dialog.locator('button[type="submit"]').click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Café da manhã").first()).toBeVisible();

  await page.getByRole("combobox", { name: "Alimento" }).fill("arroz");
  // Espera o resultado da busca (ao focar, a lista mostra sugestões antes de filtrar).
  const opcao = page.getByRole("option").filter({ hasText: /arroz/i }).first();
  await expect(opcao).toBeVisible();
  const nomeAlimento = (await opcao.innerText()).split("\n")[0].trim();
  await opcao.click();
  await page.getByLabel("Quantidade em gramas").fill("100");
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();

  // O item entra na refeição e o formulário é limpo para o próximo. (A refeição
  // renderiza tabela e cartões de celular; só um dos dois fica visível.)
  await expect(page.getByLabel("Quantidade em gramas")).toHaveValue("");
  await expect(page.getByText(nomeAlimento, { exact: true }).filter({ visible: true }).first()).toBeVisible();
});
