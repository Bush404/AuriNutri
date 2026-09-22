import { expect, test } from "@playwright/test";

import { STORAGE_STATE } from "./env";
import { criarPaciente, textoVisivel } from "./helpers";

test.use({ storageState: STORAGE_STATE });

test("criar paciente, registrar avaliação antropométrica e conferir o IMC", async ({ page }) => {
  await criarPaciente(page);

  await page.getByRole("tab", { name: "Antropometria Geral" }).click();
  await page.getByRole("button", { name: "Nova avaliação" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Peso (kg)").fill("70");
  await dialog.getByLabel("Altura (cm)").fill("175");
  await dialog.getByRole("button", { name: "Salvar avaliação" }).click();
  await expect(dialog).toBeHidden();

  // IMC = 70 / 1,75² = 22,857… → coluna gerada no banco com 2 casas.
  await expect(textoVisivel(page, "22.86")).toBeVisible();
});
