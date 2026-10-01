import { expect, test } from "@playwright/test";

import { STORAGE_STATE } from "./env";
import { criarPaciente, escolherNoSelect, PDF, registrarConsentimento, textoVisivel, unico } from "./helpers";

test.use({ storageState: STORAGE_STATE });

test("criar paciente, registrar avaliação antropométrica e conferir o IMC", async ({ page }) => {
  const { id } = await criarPaciente(page);

  await page.getByRole("tab", { name: "Antropometria Geral" }).click();
  await page.getByRole("button", { name: "Nova avaliação" }).click();
  await page.getByRole("menuitem", { name: "Adultos e idosos" }).click();
  await expect(page).toHaveURL(new RegExp(`/pacientes/${id}/avaliacoes/nova$`));

  await page.getByLabel("Peso (kg)").fill("70");
  await page.getByLabel("Altura (cm)").fill("175");
  await page.getByRole("button", { name: "Salvar avaliação" }).click();

  await expect(page).toHaveURL(new RegExp(`/pacientes/${id}\\?aba=avaliacoes$`));
  // IMC = 70 / 1,75² = 22,857… → coluna gerada no banco com 2 casas.
  await expect(textoVisivel(page, "22.86")).toBeVisible();
});

test("protocolo de dobras: paciente sem sexo pede a base e o % de gordura é gravado", async ({ page }) => {
  const { id } = await criarPaciente(page);
  await page.goto(`/pacientes/${id}/avaliacoes/nova`);

  await page.getByLabel("Peso (kg)").fill("80");
  await page.getByLabel("Altura (cm)").fill("175");

  // Paciente criado sem sexo: a base das fórmulas nunca é assumida.
  await page.getByRole("radio", { name: "Guedes" }).click();
  await expect(page.getByText("Escolha a base (masculino ou feminino) para as fórmulas.")).toBeVisible();
  await page.getByRole("combobox", { name: "Base para as fórmulas" }).click();
  await page.getByRole("option", { name: "Masculino" }).click();

  // Guedes homem: log10(tríceps 10 + suprailíaca 12 + abdominal 18) → 15,3% (Brozek).
  await page.getByLabel("Tricipital").fill("10");
  await page.getByLabel("Suprailíaca").fill("12");
  await page.getByLabel("Abdominal").fill("18");
  await expect(textoVisivel(page, "15,3%")).toBeVisible();

  await page.getByRole("button", { name: "Salvar avaliação" }).click();
  await expect(page).toHaveURL(new RegExp(`/pacientes/${id}\\?aba=avaliacoes$`));
  await expect(textoVisivel(page, "15.34%")).toBeVisible();
});

test("criança: curvas da OMS, relatório anexado e evolução física", async ({ page }) => {
  // Menina de ~3 anos.
  const nascimento = new Date();
  nascimento.setUTCFullYear(nascimento.getUTCFullYear() - 3);
  await page.goto("/pacientes/novo");
  await page.getByLabel("Nome completo").fill(unico("Criança E2E"));
  await page.getByLabel("Data de nascimento").fill(nascimento.toISOString().slice(0, 10));
  await escolherNoSelect(page, "Sexo", "Feminino");
  await page.getByRole("button", { name: "Cadastrar paciente" }).click();
  await expect(page).toHaveURL(/\/pacientes\/[0-9a-f-]{36}$/);
  const id = page.url().split("/").pop()!;

  await page.getByRole("tab", { name: "Antropometria Geral" }).click();
  await page.getByRole("button", { name: "Nova avaliação" }).click();
  await page.getByRole("menuitem", { name: /Crianças e adolescentes/ }).click();
  await expect(page).toHaveURL(new RegExp(`/pacientes/${id}/avaliacoes/nova\\?tipo=crianca$`));

  // Mediana da OMS para meninas de 36 meses: 13,85 kg.
  await page.getByLabel("Peso (kg)").fill("13.85");
  await page.getByLabel("Altura (cm)").fill("95.1");
  await expect(page.getByText("Peso adequado para a idade")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Peso por estatura" })).toBeVisible();
  await page.getByRole("button", { name: "Salvar avaliação" }).click();
  await expect(page).toHaveURL(new RegExp(`/pacientes/${id}\\?aba=avaliacoes$`));
  await expect(textoVisivel(page, "criança")).toBeVisible();

  // Relatório externo com peso: exige consentimento de exames.
  await registrarConsentimento(page, "Exames laboratoriais");
  await page.getByRole("tab", { name: "Antropometria Geral" }).click();
  await page.getByRole("button", { name: "Nova avaliação" }).click();
  await page.getByRole("menuitem", { name: /Anexar relatório externo/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator('input[type="file"]').setInputFiles({ name: "bioimpedancia.pdf", mimeType: "application/pdf", buffer: PDF });
  await dialog.getByLabel("Título").fill("Bioimpedância E2E");
  await dialog.getByLabel("Peso (kg)").fill("14.2");
  await dialog.getByRole("button", { name: "Anexar" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(/Bioimpedância E2E/)).toBeVisible();

  // Evolução física: o peso da avaliação e o do relatório, lado a lado na tabela.
  await page.getByRole("button", { name: "Ver tabela" }).click();
  await expect(textoVisivel(page, "13,9")).toBeVisible();
  await expect(textoVisivel(page, "14,2")).toBeVisible();
});
