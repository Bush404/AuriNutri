import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { loadEnvLocal } from "./env";

/** Sufixo único por execução, para nomes criados pelos testes não colidirem. */
export function unico(prefixo: string) {
  return `${prefixo} ${Date.now()}`;
}

/** Cliente com service role — só para preparar/limpar dados de teste. */
export function adminClient() {
  loadEnvLocal();
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Várias telas renderizam tabela (desktop) e cartões (celular) com o mesmo
 * conteúdo; só um fica visível. Este localizador ignora a cópia escondida.
 */
export const escaparRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function textoVisivel(page: Page, texto: string | RegExp) {
  return page.getByText(texto, { exact: typeof texto === "string" }).filter({ visible: true }).first();
}

export async function criarPaciente(page: Page, nome = unico("Paciente E2E")) {
  await page.goto("/pacientes/novo");
  await page.getByLabel("Nome completo").fill(nome);
  await page.getByRole("button", { name: "Cadastrar paciente" }).click();
  await expect(page).toHaveURL(/\/pacientes\/[0-9a-f-]{36}$/);
  const id = page.url().split("/").pop()!;
  return { id, nome };
}

export async function criarPlano(page: Page, patientId: string, nome = "Plano E2E") {
  await page.goto(`/pacientes/${patientId}`);
  await page.getByRole("tab", { name: "Planos alimentares" }).click();
  await page.getByRole("button", { name: "Criar plano alimentar" }).click();
  await page.getByLabel("Nome do plano").fill(nome);
  await page.getByRole("button", { name: "Criar e montar refeições" }).click();
  await expect(page).toHaveURL(/\/planos\/[0-9a-f-]{36}$/);
  return page.url().split("/").pop()!;
}

/** Nomes das refeições do plano: ficam em campos editáveis na linha (Fase 19), não em texto solto. */
export async function nomesDasRefeicoes(page: Page) {
  return page
    .getByRole("textbox", { name: "Nome da refeição" })
    .evaluateAll((campos) => campos.map((c) => (c as HTMLInputElement).value));
}

export async function adicionarRefeicao(page: Page, nome = "Café da manhã") {
  await page.getByRole("button", { name: "Adicionar refeição" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome da refeição").fill(nome);
  await dialog.locator('button[type="submit"]').click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => nomesDasRefeicoes(page)).toContain(nome);
  // A refeição nova aparece na lista; abrir leva à janela "Editar refeição" (Fase 19).
  await page.getByRole("button", { name: /^Abrir/ }).last().click();
}

/** Busca no campo "Alimento" e escolhe a primeira opção que contém `nomeOpcao`. */
export async function escolherAlimento(page: Page, busca: string, nomeOpcao: string | RegExp) {
  await page.getByRole("combobox", { name: "Alimento" }).fill(busca);
  const opcao = page.getByRole("option").filter({ hasText: nomeOpcao }).first();
  await expect(opcao).toBeVisible();
  const nome = (await opcao.innerText()).split("\n")[0].trim();
  await opcao.click();
  return nome;
}

/** Janela "Editar refeição" (Fase 19). */
export function janelaDaRefeicao(page: Page) {
  return page.getByRole("dialog", { name: "Editar refeição" });
}

/** "Salvar alterações" da janela da refeição: só aí a refeição é gravada. */
export async function salvarRefeicao(page: Page) {
  const janela = janelaDaRefeicao(page);
  await janela.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(janela).toBeHidden();
}

/**
 * Na janela da refeição aberta: busca, clica em "Adicionar" (entra na medida
 * usual ou na porção de referência), ajusta a quantidade em gramas e, por
 * padrão, salva a refeição.
 */
export async function adicionarAlimentoNaRefeicao(
  page: Page,
  busca: string,
  nomeOpcao: string | RegExp,
  gramas: number,
  { salvar = true }: { salvar?: boolean } = {},
) {
  const janela = janelaDaRefeicao(page);
  await janela.getByLabel("Buscar alimentos").fill(busca);
  const resultado = janela
    .getByRole("list", { name: "Resultados" })
    .getByRole("listitem")
    .filter({ hasText: nomeOpcao })
    .first();
  await expect(resultado).toBeVisible();
  const nome = (await resultado.locator("p").first().innerText()).trim();
  await resultado.getByTitle("Adicionar à refeição").click();
  // Alimento com medida caseira (Fase 17, Bloco D) entra em "1 medida"; o teste trabalha em gramas.
  await expect(janela.getByLabel(new RegExp(`^Quantidade de ${escaparRegex(nome)} \\(`))).toBeVisible();
  const unidade = janela.getByLabel(`Unidade de ${nome}`);
  if ((await unidade.count()) > 0 && (await unidade.inputValue()) !== "g") await unidade.selectOption("g");
  const quantidade = janela.getByLabel(`Quantidade de ${nome} (g)`);
  await expect(quantidade).toBeVisible();
  await quantidade.fill(String(gramas));
  await quantidade.press("Tab");
  if (salvar) await salvarRefeicao(page);
  return nome;
}

/** Abre um Select (Radix) pelo rótulo e escolhe a opção pelo texto. */
export async function escolherNoSelect(page: Page, rotulo: string | RegExp, opcao: string) {
  await page.getByRole("combobox", { name: rotulo }).click();
  await page.getByRole("option", { name: opcao, exact: true }).click();
}

/** PDF mínimo válido — só para exercitar o envio ao Storage de verdade. */
export const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj " +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF"
);

/** Registra o consentimento do tipo indicado na aba Consentimentos do paciente aberto. */
export async function registrarConsentimento(page: Page, tipoLabel: string) {
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
