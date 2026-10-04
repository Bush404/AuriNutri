import { expect, test } from "@playwright/test";

import { STORAGE_STATE } from "./env";
import {
  adicionarAlimentoNaRefeicao,
  adicionarRefeicao,
  criarPaciente,
  criarPlano,
  escaparRegex,
  janelaDaRefeicao,
  salvarRefeicao,
  unico,
} from "./helpers";

test.use({ storageState: STORAGE_STATE });

// Fluxo central do produto, do cadastro do paciente ao alimento da TACO.
test("cadastrar paciente, criar plano, adicionar refeição e alimento TACO", async ({ page }) => {
  const paciente = await criarPaciente(page);
  await expect(page.getByText(paciente.nome).first()).toBeVisible();
  await criarPlano(page, paciente.id);
  await adicionarRefeicao(page);
  const nome = await adicionarAlimentoNaRefeicao(page, "arroz", /arroz/i, 100);

  // Substitutos (Fase 17, Bloco E; na janela da refeição desde a Fase 19): sugestão rápida, depois "usar este".
  await page.getByRole("button", { name: /^Abrir/ }).last().click();
  const janela = janelaDaRefeicao(page);
  await janela.getByRole("button", { name: `Substitutos de ${nome}` }).click();
  const painel = janela.getByRole("region", { name: `Substitutos de ${nome}` });
  const sugestao = painel.getByTitle("Adicionar como substituto").first();
  await expect(sugestao).toBeVisible();
  const nomeSubstituto = ((await sugestao.innerText()).split(" — ")[0] ?? "").trim();
  await sugestao.click();
  const usar = painel.getByRole("button", { name: `Usar este: ${nomeSubstituto} vira o alimento do plano` });
  await expect(usar).toBeVisible();
  await usar.click();
  await expect(janela.getByRole("region", { name: `Substitutos de ${nomeSubstituto}` })).toContainText(nome);
  await salvarRefeicao(page);

  // Gravado de verdade: reabrindo, o substituto é o alimento e o original virou substituto.
  await page.getByRole("button", { name: /^Abrir/ }).last().click();
  await janela.getByRole("button", { name: `Substitutos de ${nomeSubstituto}` }).click();
  await expect(janela.getByRole("region", { name: `Substitutos de ${nomeSubstituto}` })).toContainText(nome);
});

// Fase 18: alimento da USDA pelo filtro próprio, com o selo da fonte no item.
test("filtrar pela USDA e adicionar um alimento da USDA na refeição", async ({ page }) => {
  const paciente = await criarPaciente(page);
  await criarPlano(page, paciente.id);
  await adicionarRefeicao(page);
  const janela = janelaDaRefeicao(page);
  await janela.getByRole("radio", { name: "USDA" }).click();
  const nome = await adicionarAlimentoNaRefeicao(page, "quinoa", /Quinoa, cozida/, 100, { salvar: false });
  const item = janela
    .getByRole("listitem")
    .filter({ has: page.getByLabel(new RegExp(`^Quantidade de ${escaparRegex(nome)} \\(`)) });
  await expect(item.getByText("USDA", { exact: true })).toBeVisible();
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

  // Resumo fixo no rodapé (Fase 17).
  const totais = page.getByRole("region", { name: "Resumo do plano" });
  await expect(totais).toContainText("Calorias: 300 kcal");
  await expect(totais).toContainText("Proteínas: 15,0 g");
  await expect(totais).toContainText("Carboidratos: 30,0 g");
  await expect(totais).toContainText("Lipídios: 7,5 g");

  // Medida caseira própria (Fase 17, Bloco D): "pote" de 50 g; 3 potes = 150 g, mesmos totais.
  await page.getByRole("button", { name: /^Abrir/ }).last().click();
  const janela = janelaDaRefeicao(page);
  await janela.getByLabel(`Unidade de ${nomeAlimento}`).selectOption("__gerenciar");
  const medidas = page.getByRole("dialog", { name: "Medidas caseiras" });
  await medidas.getByLabel("Nome").fill("pote E2E");
  await medidas.getByLabel("Gramas").fill("50");
  await medidas.getByRole("button", { name: "Criar" }).click();
  await expect(medidas).toBeHidden();
  const potes = janela.getByLabel(`Quantidade de ${nomeAlimento} (medidas)`);
  await expect(potes).toHaveValue("1");
  await potes.fill("3");
  await potes.press("Tab");
  await expect(janela.getByText("= 150 g")).toBeVisible();
  await salvarRefeicao(page);
  await expect(totais).toContainText("Calorias: 300 kcal");

  // "Baixar PDF" abre as opções (Fase 17, Bloco F); conferimos o PDF simples e o completo.
  await page.getByRole("button", { name: "Baixar PDF" }).click();
  const opcoes = page.getByRole("dialog", { name: "Baixar PDF do plano" });
  const baixar = opcoes.getByRole("link", { name: "Baixar" });
  await expect(baixar).toHaveAttribute("href", `/planos/${planId}/pdf`);
  await opcoes.getByLabel(/Relatório de nutrientes/).click();
  await opcoes.getByLabel(/Lista de compras/).click();
  await expect(baixar).toHaveAttribute("href", `/planos/${planId}/pdf?nutrientes=1&compras=1&dias=7`);
  for (const url of [
    `/planos/${planId}/pdf`,
    `/planos/${planId}/pdf?nutrientes=1&compras=1&dias=7&quebra=1&estilo=lista`,
  ]) {
    const resposta = await page.request.get(url);
    expect(resposta.status()).toBe(200);
    expect(resposta.headers()["content-type"]).toContain("application/pdf");
    expect((await resposta.body()).subarray(0, 4).toString()).toBe("%PDF");
  }
  await page.keyboard.press("Escape");

  // Lista de compras na tela: 3 potes por dia × 7 dias.
  await page.getByRole("button", { name: "Lista de compras" }).click();
  const compras = page.getByRole("dialog", { name: "Lista de compras" });
  await expect(compras.getByRole("listitem").filter({ hasText: nomeAlimento })).toContainText("21 × pote E2E (1,1 kg)");
  await page.keyboard.press("Escape");

  // Micronutrientes × DRI.
  await page.getByRole("button", { name: "Ver todos os nutrientes" }).click();
  await expect(page.getByRole("dialog", { name: "Micronutrientes do cardápio" })).toBeVisible();
});
