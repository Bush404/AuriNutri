import { expect, test, type Page } from "@playwright/test";

import { STORAGE_STATE } from "./env";
import { criarPaciente, escolherNoSelect } from "./helpers";

test.use({ storageState: STORAGE_STATE });

// PNG 1×1 e um PDF mínimo válido — só para exercitar o envio ao Storage de verdade.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);
const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj " +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF"
);

async function registrarConsentimento(page: Page, tipoLabel: string) {
  await page.getByRole("tab", { name: "Consentimentos" }).click();
  const card = page
    .locator("div")
    .filter({ hasText: tipoLabel })
    .filter({ has: page.getByRole("button", { name: "Registrar consentimento" }) })
    .last();
  await card.getByRole("button", { name: "Registrar consentimento" }).click();
  const dialog = page.getByRole("dialog");
  await escolherNoSelect(page, /Como foi obtido/, "Presencial");
  await dialog.getByRole("button", { name: "Registrar", exact: true }).click();
  await expect(dialog).toBeHidden();
}

test("consentimento → foto de evolução e exame em PDF enviados ao Storage", async ({ page }) => {
  await criarPaciente(page);

  // Foto de evolução (bucket fotos-evolucao)
  await registrarConsentimento(page, "Fotos de evolução");
  await page.getByRole("tab", { name: "Evolução Fotográfica" }).click();
  await page.getByRole("button", { name: "Nova foto" }).click();
  let dialog = page.getByRole("dialog");
  await escolherNoSelect(page, /Ângulo/, "Frente");
  await dialog.locator('input[type="file"]').setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
  await dialog.getByRole("button", { name: "Registrar foto" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Não foi possível registrar a foto")).toHaveCount(0);
  // A foto só é exibida ao clicar em "ver" (cada visualização gera URL assinada
  // temporária e fica auditada). Conferimos que a imagem veio do Storage de fato.
  await page.getByRole("button", { name: /^Ver foto/ }).or(page.locator("button:has(svg.lucide-eye)")).first().click();
  const foto = page.getByRole("dialog").locator("img");
  await expect(foto).toBeVisible();
  await expect.poll(() => foto.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();

  // Exame com arquivo (bucket profissional)
  await registrarConsentimento(page, "Exames laboratoriais");
  await page.getByRole("tab", { name: "Exames" }).click();
  await page.getByRole("button", { name: /Anexar PDF/ }).click();
  await page.getByRole("button", { name: "Novo exame" }).click();
  dialog = page.getByRole("dialog");
  await dialog.locator('input[type="file"]').setInputFiles({ name: "exame.pdf", mimeType: "application/pdf", buffer: PDF });
  await dialog.getByRole("button", { name: "Registrar exame" }).click();
  await expect(page.getByText("Exame e arquivo registrados.")).toBeVisible();
});
