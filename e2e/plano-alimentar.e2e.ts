import { expect, test } from "@playwright/test";

import { STORAGE_STATE } from "./env";
import { adicionarAlimentoNaRefeicao, adicionarRefeicao, criarPaciente, criarPlano, unico } from "./helpers";

test.use({ storageState: STORAGE_STATE });

// Fluxo central do produto, do cadastro do paciente ao alimento da TACO.
test("cadastrar paciente, criar plano, adicionar refeição e alimento TACO", async ({ page }) => {
  const paciente = await criarPaciente(page);
  await expect(page.getByText(paciente.nome).first()).toBeVisible();
  await criarPlano(page, paciente.id);
  await adicionarRefeicao(page);
  await adicionarAlimentoNaRefeicao(page, "arroz", /arroz/i, 100);
});

test("criar alimento próprio, montar plano, conferir macros e gerar PDF", async ({ page }) => {
  const nomeAlimento = unico("Alimento E2E");

  await page.goto("/alimentos");
  await page.getByRole("button", { name: "Novo alimento" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome do alimento").fill(nomeAlimento);
  await dialog.getByRole("combobox", { name: /Categoria/ }).click();
  await page.getByRole("option").first().click();
  await dialog.getByLabel("Porção de referência (g)").fill("100");
  await dialog.getByLabel("Calorias (kcal)").fill("200");
  await dialog.getByLabel("Proteínas (g)").fill("10");
  await dialog.getByLabel("Carboidratos (g)").fill("20");
  await dialog.getByLabel("Gorduras (g)").fill("5");
  await dialog.getByRole("button", { name: "Cadastrar alimento" }).click();
  await expect(dialog).toBeHidden();

  const paciente = await criarPaciente(page);
  const planId = await criarPlano(page, paciente.id);
  await adicionarRefeicao(page);
  // 150 g de um alimento com 200 kcal / 10 P / 20 C / 5 G por 100 g.
  await adicionarAlimentoNaRefeicao(page, nomeAlimento, nomeAlimento, 150);

  const totais = page
    .locator("div", { has: page.getByText("Total diário do plano") })
    .filter({ hasText: "Carboidratos" })
    .last();
  await expect(totais).toContainText("Calorias300kcal");
  await expect(totais).toContainText("Proteínas15.0g");
  await expect(totais).toContainText("Carboidratos30.0g");
  await expect(totais).toContainText("Gorduras7.5g");

  // O botão "Baixar PDF" aponta para esta rota; conferimos que ela devolve um PDF de verdade.
  await expect(page.getByRole("link", { name: "Baixar PDF" })).toHaveAttribute("href", `/planos/${planId}/pdf`);
  const resposta = await page.request.get(`/planos/${planId}/pdf`);
  expect(resposta.status()).toBe(200);
  expect(resposta.headers()["content-type"]).toContain("application/pdf");
  expect((await resposta.body()).subarray(0, 4).toString()).toBe("%PDF");
});
