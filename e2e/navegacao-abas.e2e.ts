import { expect, test } from "@playwright/test";

import { STORAGE_STATE } from "./env";
import { criarPaciente, criarPlano } from "./helpers";

test.use({ storageState: STORAGE_STATE });

// Pedido da responsável pelo produto (Fase 13): voltar de um plano ou de uma
// anamnese cai na mesma aba do paciente, não em "Informações gerais".
test("voltar de um plano ou de uma anamnese mantém a aba do paciente", async ({ page }) => {
  const paciente = await criarPaciente(page);
  await criarPlano(page, paciente.id, "Plano navegação E2E");

  // "Voltar para <paciente>" dentro do plano abre a aba Planos alimentares.
  await page.getByRole("link", { name: /Voltar para/ }).click();
  await expect(page.getByRole("tab", { name: "Planos alimentares" })).toHaveAttribute("aria-selected", "true");

  // O card inteiro do plano abre o plano; o voltar do navegador volta à aba.
  await page.getByText("Plano navegação E2E").first().click();
  await expect(page).toHaveURL(/\/planos\//);
  await page.goBack();
  await expect(page.getByRole("tab", { name: "Planos alimentares" })).toHaveAttribute("aria-selected", "true");

  // Anamnese: abrir o formulário e voltar pelo navegador fecha e fica na aba.
  await page.getByRole("tab", { name: "Anamnese" }).click();
  await expect(page).toHaveURL(/aba=anamnese/);
  await page.getByRole("button", { name: "Adicionar nova anamnese" }).click();
  await expect(page.getByRole("button", { name: "Registrar anamnese" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("button", { name: "Registrar anamnese" })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Anamnese" })).toHaveAttribute("aria-selected", "true");
});
