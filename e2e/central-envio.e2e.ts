import { expect, test } from "@playwright/test";

import { STORAGE_STATE } from "./env";
import { adicionarAlimentoNaRefeicao, adicionarRefeicao, criarPaciente, criarPlano, escolherNoSelect, unico } from "./helpers";

test.use({ storageState: STORAGE_STATE });

test("enviar plano e material da biblioteca pela Central de Envio — links abrem sem login", async ({ page, browser }) => {
  const tituloMaterial = unico("Material E2E");

  // Material da biblioteca, escrito direto no sistema
  await page.goto("/biblioteca");
  await page.getByRole("button", { name: "Novo material" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("tab", { name: "Escrever" }).click();
  await dialog.getByLabel("Nome").fill(tituloMaterial);
  await escolherNoSelect(page, /Tipo/, "Orientação");
  await dialog.getByLabel("Tags").fill("e2e");
  await dialog.getByLabel("Texto livre").fill("Beba água ao longo do dia.");
  await dialog.getByRole("button", { name: "Salvar material" }).click();
  await expect(dialog).toBeHidden();

  // Paciente com plano ativo
  const paciente = await criarPaciente(page);
  await criarPlano(page, paciente.id);
  await adicionarRefeicao(page);
  await adicionarAlimentoNaRefeicao(page, "arroz", /arroz/i, 100);

  // Central de Envio
  await page.goto(`/pacientes/${paciente.id}`);
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  const central = page.getByRole("dialog");
  await central.getByText("Plano Alimentar", { exact: true }).click();
  await central.getByText("Material da biblioteca", { exact: true }).click();

  await central.getByRole("button", { name: "Gerar link do plano" }).click();
  await expect(central.getByText("✓ Link do plano pronto")).toBeVisible();

  await central.getByPlaceholder("Buscar material pelo nome...").fill(tituloMaterial);
  await central.getByRole("button", { name: new RegExp(tituloMaterial) }).click();
  await central.getByRole("button", { name: "Gerar PDF e link" }).click();
  await expect(central.getByText("✓ Link pronto")).toBeVisible();

  // A mensagem final leva os dois links; cada um abre o PDF sem sessão (como o paciente).
  const mensagem = await central.locator("textarea").inputValue();
  const links = [...new Set(mensagem.match(/https?:\/\/\S+\/compartilhado\/[^\s)]+/g) ?? [])];
  expect(links).toHaveLength(2);

  const anonimo = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  for (const link of links) {
    const resposta = await anonimo.request.get(new URL(link).pathname);
    expect(resposta.status(), link).toBe(200);
    expect(resposta.headers()["content-type"]).toContain("application/pdf");
  }
  await anonimo.close();
});
