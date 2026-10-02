import { expect, test } from "@playwright/test";

import { STORAGE_STATE } from "./env";
import { adicionarAlimentoNaRefeicao, criarPaciente, criarPlano, textoVisivel, unico } from "./helpers";

test.use({ storageState: STORAGE_STATE });

// Fase 17, Bloco G: plano novo já vem com 3 refeições; um plano favoritado vira
// modelo e começa o plano de outro paciente, com refeições e alimentos.
test("favoritar plano como modelo e começar o plano de outro paciente a partir dele", async ({ page }) => {
  const nomeModelo = unico("Modelo E2E");
  const pacienteA = await criarPaciente(page);
  await criarPlano(page, pacienteA.id, nomeModelo);

  for (const refeicao of ["Café da manhã", "Almoço", "Jantar"]) {
    await expect(page.getByText(refeicao, { exact: true }).first()).toBeVisible();
  }
  await page.getByRole("button", { name: /^Abrir/ }).first().click();
  const alimento = await adicionarAlimentoNaRefeicao(page, "banana", /banana/i, 86);

  // Lista do paciente A: kcal na linha e estrela de modelo.
  await page.getByRole("link", { name: /Voltar para/ }).click();
  await expect(page.getByRole("listitem").filter({ hasText: nomeModelo })).toContainText("kcal");
  await page.getByRole("button", { name: `Favoritar ${nomeModelo} como modelo` }).click();
  await expect(page.getByRole("button", { name: `Tirar ${nomeModelo} dos modelos` })).toBeVisible();

  // Paciente B: novo plano a partir do modelo.
  const pacienteB = await criarPaciente(page);
  await page.goto(`/pacientes/${pacienteB.id}`);
  await page.getByRole("tab", { name: "Planos alimentares" }).click();
  await page.getByRole("button", { name: "Criar plano alimentar" }).click();
  const dialog = page.getByRole("dialog", { name: "Novo plano alimentar" });
  await dialog.getByRole("radio", { name: "De um modelo" }).click();
  await dialog.getByLabel("Buscar modelo").fill(nomeModelo);
  await dialog.getByRole("radio", { name: new RegExp(nomeModelo) }).click();
  await expect(dialog.getByLabel("Nome do plano")).toHaveValue(nomeModelo);
  await dialog.getByRole("button", { name: "Criar e montar refeições" }).click();
  await expect(page).toHaveURL(/\/planos\/[0-9a-f-]{36}$/);
  await expect(page.getByText(`Paciente: ${pacienteB.nome}`)).toBeVisible();
  await page.getByRole("button", { name: /^Abrir/ }).first().click();
  await expect(textoVisivel(page, alimento)).toBeVisible();
});
