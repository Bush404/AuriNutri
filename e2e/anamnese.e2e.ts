import { expect, test } from "@playwright/test";

import { STORAGE_STATE } from "./env";
import { criarPaciente, unico } from "./helpers";

test.use({ storageState: STORAGE_STATE });

// Fase 14: anamnese em texto livre, "Salvar como modelo" e "Começar de" um modelo.
test("escrever anamnese em texto livre, salvar como modelo e começar outra a partir dele", async ({ page }) => {
  const paciente = await criarPaciente(page);
  const nomeModelo = unico("Modelo E2E");

  await page.goto(`/pacientes/${paciente.id}?aba=anamnese`);
  await page.getByRole("button", { name: "Adicionar nova anamnese" }).click();

  await page.getByLabel("Nome (opcional)").fill("Anamnese inicial");
  const editor = page.getByRole("textbox", { name: "Texto da anamnese" });
  await editor.click();
  await page.keyboard.type("Queixa principal: cansaço à tarde.");

  // Vira modelo (o nome sugerido vem do nome da anamnese; troca por um único).
  await page.getByRole("button", { name: "Salvar como modelo" }).click();
  const modeloDialog = page.getByRole("dialog", { name: "Salvar como modelo" });
  await modeloDialog.getByLabel("Nome do modelo").fill(nomeModelo);
  await modeloDialog.getByRole("button", { name: "Salvar modelo" }).click();
  await expect(modeloDialog).toBeHidden();

  await page.getByRole("button", { name: "Registrar anamnese" }).click();
  await expect(page.getByText("Anamnese registrada com sucesso.")).toBeVisible();

  // Aparece fechada na lista; o card abre o texto salvo.
  const registro = page.getByRole("button", { name: /Abrir Anamnese inicial/ });
  await expect(registro).toBeVisible();
  await registro.click();
  await expect(page.getByRole("textbox", { name: "Texto da anamnese" })).toContainText("cansaço à tarde");
  await page.getByRole("button", { name: "Cancelar" }).click();

  // Nova anamnese a partir do modelo: o texto do modelo é copiado para o editor.
  await page.getByRole("button", { name: "Adicionar nova anamnese" }).click();
  await page.getByRole("combobox", { name: "Começar de" }).click();
  await page.getByRole("option", { name: `Modelo: ${nomeModelo}` }).click();
  await expect(page.getByRole("textbox", { name: "Texto da anamnese" })).toContainText("cansaço à tarde");
  await page.getByRole("button", { name: "Cancelar" }).click();

  // Limpeza: exclui o modelo pela janela "Meus modelos".
  await page.getByRole("button", { name: "Meus modelos" }).click();
  const meusModelos = page.getByRole("dialog", { name: "Meus modelos de anamnese" });
  await meusModelos.getByRole("button", { name: `Excluir ${nomeModelo}` }).click();
  await meusModelos.getByRole("button", { name: `Confirmar exclusão de ${nomeModelo}` }).click();
  await expect(page.getByText("Modelo excluído.")).toBeVisible();
});
