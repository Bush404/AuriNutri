import { expect, test } from "@playwright/test";

import { STORAGE_STATE } from "./env";
import { adicionarRefeicao, criarPaciente, criarPlano, escolherAlimento, textoVisivel, unico } from "./helpers";

test.use({ storageState: STORAGE_STATE });

test("criar receita e usá-la num plano alimentar", async ({ page }) => {
  const nomeReceita = unico("Receita E2E");

  // Etapa 1 — identificação
  await page.goto("/receitas/novo");
  await page.getByLabel("Nome da receita").fill(nomeReceita);
  await page.getByRole("button", { name: "Avançar" }).click();
  await expect(page).toHaveURL(/\/receitas\/[0-9a-f-]{36}\/editar/);

  // Etapa 2 — ingredientes
  const ingrediente = await escolherAlimento(page, "arroz", /arroz/i);
  await page.getByLabel("Quantidade em gramas").fill("200");
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(page.getByLabel("Quantidade em gramas")).toHaveValue("");
  await expect(textoVisivel(page, ingrediente)).toBeVisible();
  await page.getByRole("button", { name: "Avançar" }).click();

  // Etapa 3 — modo de preparo (opcional)
  await expect(page.getByLabel("Modo de preparo")).toBeVisible();
  await page.getByRole("button", { name: "Avançar" }).click();

  // Etapa 4 — resultado
  await page.getByLabel("Peso da preparação pronta (g)").fill("400");
  await page.getByLabel("Número de porções").fill("2");
  await page.getByRole("button", { name: "Concluir receita" }).click();
  await expect(page).toHaveURL(/\/receitas$/);

  // Usar no plano
  const paciente = await criarPaciente(page);
  await criarPlano(page, paciente.id);
  await adicionarRefeicao(page, "Almoço");
  await page.getByRole("tab", { name: "Receita" }).click();
  await page.getByRole("combobox", { name: "Receita" }).fill(nomeReceita);
  await page.getByRole("option").filter({ hasText: nomeReceita }).first().click();
  await page.getByLabel("Quantidade de porções").fill("1");
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(page.getByLabel("Quantidade de porções")).toHaveValue("");
  await expect(textoVisivel(page, nomeReceita)).toBeVisible();
});
