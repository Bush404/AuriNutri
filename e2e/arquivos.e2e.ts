import { expect, test } from "@playwright/test";

import { STORAGE_STATE } from "./env";
import { criarPaciente, escolherNoSelect, PDF, registrarConsentimento } from "./helpers";

test.use({ storageState: STORAGE_STATE });

// PNG 1×1 — só para exercitar o envio ao Storage de verdade (o PDF mínimo está em helpers).
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);
test("consentimento → foto de evolução e exame em PDF enviados ao Storage", async ({ page }) => {
  await criarPaciente(page);

  // Foto de evolução (bucket fotos-evolucao)
  await registrarConsentimento(page, "Fotos de evolução");
  await page.getByRole("tab", { name: "Evolução Fotográfica" }).click();
  await page.getByRole("button", { name: "Nova foto" }).click();
  let dialog = page.getByRole("dialog");
  // "À direita" só existe a partir da migration 0050 — o teste confere que ela está aplicada.
  await escolherNoSelect(page, /Ângulo/, "À direita");
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
