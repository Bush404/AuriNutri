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

export async function adicionarRefeicao(page: Page, nome = "Café da manhã") {
  await page.getByRole("button", { name: "Adicionar refeição" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome da refeição").fill(nome);
  await dialog.locator('button[type="submit"]').click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(nome).first()).toBeVisible();
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

export async function adicionarAlimentoNaRefeicao(page: Page, busca: string, nomeOpcao: string | RegExp, gramas: number) {
  const nome = await escolherAlimento(page, busca, nomeOpcao);
  await page.getByLabel("Quantidade em gramas").fill(String(gramas));
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(page.getByLabel("Quantidade em gramas")).toHaveValue("");
  await expect(textoVisivel(page, nome)).toBeVisible();
  return nome;
}

/** Abre um Select (Radix) pelo rótulo e escolhe a opção pelo texto. */
export async function escolherNoSelect(page: Page, rotulo: string | RegExp, opcao: string) {
  await page.getByRole("combobox", { name: rotulo }).click();
  await page.getByRole("option", { name: opcao, exact: true }).click();
}
