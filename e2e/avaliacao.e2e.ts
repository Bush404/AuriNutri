import { expect, test, type Page } from "@playwright/test";

import { STORAGE_STATE } from "./env";
import { criarPaciente, escolherNoSelect, PDF, registrarConsentimento, textoVisivel, unico } from "./helpers";

test.use({ storageState: STORAGE_STATE });

async function novaAvaliacao(page: Page, tipo: string | RegExp) {
  await page.getByRole("tab", { name: "Antropometria Geral" }).click();
  await page.getByRole("button", { name: "Nova avaliação antropométrica" }).click();
  await page.getByRole("dialog").getByRole("button", { name: tipo }).click();
}

/** A avaliação é criada ao escolher o tipo e abre na página dela, salvando sozinha. */
const paginaDaAvaliacao = (id: string) => new RegExp(`/pacientes/${id}/avaliacoes/[0-9a-f-]{36}$`);

test("avaliação de adulto: IMC na tela e PDF do relatório", async ({ page }) => {
  const { id } = await criarPaciente(page);

  await novaAvaliacao(page, "Antropometria de adultos e idosos");
  await expect(page).toHaveURL(paginaDaAvaliacao(id));

  await page.getByLabel("Peso (kg)").fill("70");
  await page.getByLabel("Altura (cm)").fill("175");
  // IMC = 70 / 1,75² = 22,857…
  await expect(textoVisivel(page, /22,86 kg\/m²/)).toBeVisible();
  await page.getByRole("button", { name: "Salvar e voltar" }).click();

  await expect(page).toHaveURL(new RegExp(`/pacientes/${id}\\?aba=avaliacoes$`));
  await expect(page.getByText(/Avaliação de adulto - Realizado em/)).toBeVisible();

  const [relatorio] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Relatório" }).click(),
  ]);
  expect(relatorio.suggestedFilename()).toMatch(/^relatorio-antropometrico-.*\.pdf$/);
});

test("protocolo de dobras: paciente sem sexo pede a base e o % de gordura é gravado", async ({ page }) => {
  const { id } = await criarPaciente(page);
  await novaAvaliacao(page, "Antropometria de adultos e idosos");
  await expect(page).toHaveURL(paginaDaAvaliacao(id));

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

  await page.getByRole("button", { name: "Salvar e voltar" }).click();
  await expect(page).toHaveURL(new RegExp(`/pacientes/${id}\\?aba=avaliacoes$`));

  // Reabrindo, o % calculado no servidor continua lá.
  await page.getByRole("listitem").getByRole("link", { name: "Editar", exact: true }).click();
  await expect(textoVisivel(page, "15,3%")).toBeVisible();
});

test("criança: curvas da OMS, relatório anexado e PDF de evolução", async ({ page }) => {
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

  await novaAvaliacao(page, "Antropometria de crianças e adolescentes");
  await expect(page).toHaveURL(paginaDaAvaliacao(id));

  // Mediana da OMS para meninas de 36 meses: 13,85 kg.
  await page.getByLabel("Peso (kg)").fill("13.85");
  await page.getByLabel("Altura (cm)").fill("95.1");
  await expect(page.getByText("Peso adequado para a idade")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Peso por estatura" })).toBeVisible();
  await page.getByRole("button", { name: "Salvar e voltar" }).click();
  await expect(page).toHaveURL(new RegExp(`/pacientes/${id}\\?aba=avaliacoes$`));
  await expect(page.getByText(/Avaliação infantil - Realizado em/)).toBeVisible();

  // Relatório externo com peso: exige consentimento de exames.
  await registrarConsentimento(page, "Exames laboratoriais");
  await novaAvaliacao(page, /Anexar relatório externo/);
  const anexo = page.getByRole("dialog");
  await anexo.locator('input[type="file"]').setInputFiles({ name: "bioimpedancia.pdf", mimeType: "application/pdf", buffer: PDF });
  await anexo.getByLabel("Título").fill("Bioimpedância E2E");
  await anexo.getByLabel("Peso (kg)").fill("14.2");
  await anexo.getByRole("button", { name: "Anexar" }).click();
  await expect(anexo).toBeHidden();
  await expect(page.getByText(/Relatório externo \(Bioimpedância E2E\)/)).toBeVisible();

  // Evolução: as duas datas vêm marcadas e o PDF da comparação é gerado.
  await page.getByRole("button", { name: "Evolução" }).first().click();
  const evolucao = page.getByRole("dialog");
  await expect(evolucao.getByRole("checkbox", { checked: true })).toHaveCount(2);
  const [pdf] = await Promise.all([page.waitForEvent("download"), evolucao.getByRole("link", { name: "Gerar PDF" }).click()]);
  expect(pdf.suggestedFilename()).toMatch(/^evolucao-.*\.pdf$/);
});
