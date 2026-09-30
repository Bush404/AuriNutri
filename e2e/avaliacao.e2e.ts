import { expect, test } from "@playwright/test";

import { STORAGE_STATE } from "./env";
import { criarPaciente, textoVisivel } from "./helpers";

test.use({ storageState: STORAGE_STATE });

test("criar paciente, registrar avaliação antropométrica e conferir o IMC", async ({ page }) => {
  const { id } = await criarPaciente(page);

  await page.getByRole("tab", { name: "Antropometria Geral" }).click();
  await page.getByRole("link", { name: "Nova avaliação" }).click();
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
