import { expect, test } from "@playwright/test";

import { STORAGE_STATE } from "./env";

test.use({ storageState: STORAGE_STATE });

test("criar tarefa na agenda, vê-la no dashboard, concluir e excluir", async ({ page }) => {
  const titulo = `Tarefa E2E ${Date.now()}`;

  // Cria pela agenda, para hoje (a data já vem preenchida) às 10h.
  await page.goto("/agenda");
  await page.getByRole("button", { name: "Nova tarefa" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Título").fill(titulo);
  await dialog.getByLabel("Horário").fill("10:00");
  await dialog.getByRole("button", { name: "Criar tarefa" }).click();
  await expect(dialog).toBeHidden();

  // Aparece no calendário e em "Próximos compromissos" do dashboard.
  await expect(page.getByTitle(new RegExp(`Tarefa: .*${titulo}`)).filter({ visible: true }).first()).toBeVisible();
  await page.goto("/dashboard");
  await expect(page.getByText(titulo).first()).toBeVisible();

  // Concluir tira a tarefa do dashboard (só mostra as em aberto).
  await page.goto("/agenda");
  await page.getByTitle(new RegExp(`Tarefa: .*${titulo}`)).filter({ visible: true }).first().click();
  await dialog.getByRole("button", { name: "Concluir" }).click();
  await expect(page.getByText("Tarefa concluída.")).toBeVisible();
  await page.goto("/dashboard");
  await expect(page.getByText(titulo)).toHaveCount(0);

  // Excluir pede confirmação e remove do calendário.
  await page.goto("/agenda");
  await page.getByTitle(new RegExp(`Tarefa: .*${titulo}`)).filter({ visible: true }).first().click();
  await dialog.getByRole("button", { name: "Excluir" }).click();
  await dialog.getByRole("button", { name: "Confirmar exclusão" }).click();
  await expect(page.getByText("Tarefa excluída.")).toBeVisible();
  await expect(page.getByTitle(new RegExp(`Tarefa: .*${titulo}`))).toHaveCount(0);
});
