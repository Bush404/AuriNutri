import { expect, test } from "@playwright/test";

import { STORAGE_STATE } from "./env";
import { criarPaciente, escolherNoSelect } from "./helpers";

test.use({ storageState: STORAGE_STATE });

test("agendar consulta, marcar como realizada e conferir a cobrança gerada", async ({ page }) => {
  const paciente = await criarPaciente(page);

  await page.goto("/agenda");
  await page.getByRole("button", { name: "Nova consulta" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: /Paciente/ }).fill(paciente.nome);
  await page.getByRole("option").filter({ hasText: paciente.nome }).first().click();
  await escolherNoSelect(page, /Tipo/, "Primeira consulta");
  await escolherNoSelect(page, /Status financeiro/, "Não pago");
  await dialog.getByLabel("Valor da consulta").fill("200");
  await dialog.getByRole("button", { name: "Agendar consulta" }).click();
  await expect(dialog).toBeHidden();

  // Abre a consulta no calendário (o chip leva o nome do paciente no title).
  // Fase 19: clicar na consulta mostra os detalhes no painel ao lado; "Editar" abre a janela.
  await page.getByTitle(new RegExp(paciente.nome)).filter({ visible: true }).first().click();
  await page.getByRole("button", { name: "Editar" }).click();
  await dialog.getByRole("button", { name: "Marcar como realizado" }).click();
  await expect(page.getByText("Consulta marcada como realizada.")).toBeVisible();
  await expect(page.getByTitle(new RegExp(`${paciente.nome} \\(Realizad`)).filter({ visible: true }).first()).toBeVisible();

  // A cobrança criada junto com a consulta aparece em aberto no financeiro do paciente.
  await page.goto(`/pacientes/${paciente.id}`);
  await page.getByRole("tab", { name: "Financeiro" }).click();
  const emAberto = page.locator("div", { has: page.getByText("Em aberto", { exact: true }) }).last();
  await expect(emAberto).toContainText("200,00");

  // Fase 19: recebe o pagamento e o botão "Recibo" abre a Central de Envio já com o recibo dele escolhido.
  await page.getByRole("button", { name: "Marcar como recebido" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirmar recebimento" }).click();
  await expect(page.getByText("Tudo em dia")).toBeVisible();
  await page.getByRole("button", { name: /^Recibo:/ }).click();
  const central = page.getByRole("dialog");
  await expect(central.getByRole("checkbox", { name: "Recibo de pagamento" })).toBeChecked();
  await expect(central.getByRole("button", { name: "Gerar recibo e link" })).toBeEnabled();
});
