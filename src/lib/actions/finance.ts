"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  advanceOneOccurrence,
  buildInstallmentPayments,
  firstOccurrenceOnOrAfter,
  latestOccurrencePerExpense,
} from "@/lib/finance";
import {
  expenseSchema,
  patientBillingSchema,
  paymentSchema,
  registerPaymentSchema,
  registerExpenseOccurrenceSchema,
  EXPENSE_RECORRENCIAS_COM_MES,
  type ExpenseInput,
  type PatientBillingInput,
  type PaymentInput,
  type RegisterPaymentInput,
  type RegisterExpenseOccurrenceInput,
} from "@/lib/validations/finance";
import type { ActionResult } from "@/lib/actions/patients";
import type { Expense } from "@/lib/types/database.types";

// ----------------------------------------------------------------------------
// EXPENSES
// ----------------------------------------------------------------------------

/** Monta os campos de vencimento/etiqueta a partir da recorrência — nunca deixa mais de um vencimento preenchido. */
function buildVencimentoFields(parsed: ExpenseInput) {
  return {
    dia_vencimento: parsed.recorrencia === "unica" ? null : parsed.dia_vencimento,
    mes_vencimento: EXPENSE_RECORRENCIAS_COM_MES.includes(parsed.recorrencia) ? parsed.mes_vencimento : null,
    data_vencimento: parsed.recorrencia === "unica" ? parsed.data_vencimento || null : null,
    parcelamento: EXPENSE_RECORRENCIAS_COM_MES.includes(parsed.recorrencia) ? parsed.parcelamento ?? null : null,
  };
}

export async function createExpense(input: ExpenseInput): Promise<ActionResult> {
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Dados inválidos. Verifique o formulário." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  const { data: expense, error } = await supabase
    .from("expenses")
    .insert({
      user_id: user.id,
      descricao: parsed.data.descricao,
      categoria: parsed.data.categoria,
      valor: parsed.data.valor,
      recorrencia: parsed.data.recorrencia,
      ...buildVencimentoFields(parsed.data),
      ativa: parsed.data.ativa ?? true,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !expense) {
    return { success: false, message: error?.message ?? "Não foi possível cadastrar a despesa." };
  }

  // 'unica' já nasce com sua única ocorrência de pagamento — a data já é
  // conhecida de imediato, não precisa esperar o mês chegar (diferente das
  // recorrentes, cujas ocorrências são garantidas mês a mês, ver
  // ensureCurrentMonthExpenseOccurrences).
  if (parsed.data.recorrencia === "unica" && parsed.data.data_vencimento) {
    const { error: occurrenceError } = await supabase.from("expense_occurrences").insert({
      expense_id: expense.id,
      user_id: user.id,
      valor: parsed.data.valor,
      data_vencimento: parsed.data.data_vencimento,
    });
    if (occurrenceError) {
      return { success: false, message: `Não foi possível registrar o vencimento: ${occurrenceError.message}` };
    }
  }

  revalidatePath("/financeiro");
  return { success: true, message: "Despesa cadastrada com sucesso." };
}

export async function updateExpense(expenseId: string, input: ExpenseInput): Promise<ActionResult> {
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Dados inválidos. Verifique o formulário." };
  }

  const supabase = createClient();

  const { error } = await supabase
    .from("expenses")
    .update({
      descricao: parsed.data.descricao,
      categoria: parsed.data.categoria,
      valor: parsed.data.valor,
      recorrencia: parsed.data.recorrencia,
      ...buildVencimentoFields(parsed.data),
      ativa: parsed.data.ativa ?? true,
    })
    .eq("id", expenseId);

  if (error) {
    return { success: false, message: error.message };
  }

  // 'unica' tem exatamente uma ocorrência, criada junto com a despesa — mantém
  // valor/vencimento em dia com a edição, sem guardar histórico da mudança
  // (nunca uma segunda ocorrência: mesma linha atualizada). Despesas
  // recorrentes não são sincronizadas retroativamente aqui — ocorrências já
  // geradas ficam como estão, e as futuras já nascem com o novo agendamento.
  if (parsed.data.recorrencia === "unica" && parsed.data.data_vencimento) {
    await supabase
      .from("expense_occurrences")
      .update({ valor: parsed.data.valor, data_vencimento: parsed.data.data_vencimento })
      .eq("expense_id", expenseId);
  }

  revalidatePath("/financeiro");
  return { success: true, message: "Despesa atualizada com sucesso." };
}

/**
 * Exclusão real — nunca soft delete. Diferente das entidades clínicas
 * (paciente, avaliação, plano), despesa é um registro operacional do
 * profissional: ao excluir, ela simplesmente some, sem deixar rastro nem
 * exigir uma ação de "encerrar" antes. As ocorrências de pagamento
 * associadas (expense_occurrences) somem junto via `on delete cascade`.
 */
export async function deleteExpense(expenseId: string): Promise<ActionResult> {
  const supabase = createClient();

  const { error } = await supabase.from("expenses").delete().eq("id", expenseId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/financeiro");
  return { success: true };
}

// ----------------------------------------------------------------------------
// EXPENSE_OCCURRENCES — histórico de vencimento/pagamento de uma despesa
// (equivalente de payments, mas para despesas do consultório). Base do
// futuro card "Despesas do mês" no dashboard. Sem job agendado neste
// projeto: a próxima parcela pendente de cada despesa recorrente ativa é
// garantida (upsert idempotente) sempre que /financeiro carrega.
//
// Invariante mantida por este módulo: uma despesa recorrente ativa tem NO
// MÁXIMO uma ocorrência pendente por vez — a "parcela atual". Pagá-la
// (mesmo adiantado, antes do mês dela chegar) libera a próxima
// imediatamente, permitindo pagar adiantado sem esperar o mês virar.
// Desfazer o pagamento remove essa próxima (se ainda não foi paga também),
// restaurando a de antes como a única pendente de novo.
// ----------------------------------------------------------------------------

/**
 * Garante que toda despesa recorrente ativa do usuário tem uma parcela
 * pendente registrada — sem duplicar (a constraint unique de
 * expense_occurrences protege mesmo sob concorrência). Se a despesa ainda
 * não tem nenhuma ocorrência, cria a primeira a partir de `referencia`
 * (default: hoje). Se a mais recente já foi paga, cria a seguinte
 * (`advanceOneOccurrence`) — é isso que permite pagar adiantado: assim que
 * a atual é paga, a próxima já fica disponível, mesmo fora do mês dela.
 * 'unica' fica de fora: sua única ocorrência já nasce em createExpense e
 * nunca avança.
 */
export async function ensureNextExpenseOccurrences(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  referencia: Date = new Date()
): Promise<void> {
  const { data: expenses } = await supabase
    .from("expenses")
    .select("id, recorrencia, dia_vencimento, mes_vencimento, data_vencimento, valor")
    .eq("ativa", true)
    .neq("recorrencia", "unica")
    .returns<Pick<Expense, "id" | "recorrencia" | "dia_vencimento" | "mes_vencimento" | "data_vencimento" | "valor">[]>();

  if (!expenses || expenses.length === 0) return;

  const expenseIds = expenses.map((expense) => expense.id);
  const { data: occurrences } = await supabase
    .from("expense_occurrences")
    .select("expense_id, data_vencimento, data_pagamento")
    .in("expense_id", expenseIds)
    .returns<{ expense_id: string; data_vencimento: string; data_pagamento: string | null }[]>();

  const latestByExpense = latestOccurrencePerExpense(occurrences ?? []);

  const occurrencesToInsert = expenses
    .map((expense) => {
      const latest = latestByExpense.get(expense.id);
      if (latest && !latest.data_pagamento) return null; // já tem parcela pendente — nada a gerar

      const dataVencimento = latest
        ? advanceOneOccurrence(expense, latest.data_vencimento)
        : firstOccurrenceOnOrAfter(expense, referencia);

      return dataVencimento
        ? { expense_id: expense.id, user_id: userId, valor: expense.valor, data_vencimento: dataVencimento }
        : null;
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (occurrencesToInsert.length === 0) return;

  await supabase
    .from("expense_occurrences")
    .upsert(occurrencesToInsert, { onConflict: "expense_id,data_vencimento", ignoreDuplicates: true });
}

/** Dá baixa numa ocorrência de despesa — grava data_pagamento + forma_pagamento juntas (mesmo CHECK do banco). */
export async function registerExpenseOccurrencePayment(
  occurrenceId: string,
  input: RegisterExpenseOccurrenceInput
): Promise<ActionResult> {
  const parsed = registerExpenseOccurrenceSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Dados inválidos. Verifique o formulário." };
  }

  const supabase = createClient();

  const { error } = await supabase
    .from("expense_occurrences")
    .update({ data_pagamento: parsed.data.data_pagamento, forma_pagamento: parsed.data.forma_pagamento })
    .eq("id", occurrenceId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/financeiro");
  return { success: true, message: "Pagamento registrado." };
}

/** Desfaz uma baixa registrada por engano — volta a ocorrência para pendente. */
export async function unregisterExpenseOccurrencePayment(occurrenceId: string): Promise<ActionResult> {
  const supabase = createClient();

  const { data: occurrence, error: fetchError } = await supabase
    .from("expense_occurrences")
    .select("expense_id, data_vencimento")
    .eq("id", occurrenceId)
    .single<{ expense_id: string; data_vencimento: string }>();

  if (fetchError || !occurrence) {
    return { success: false, message: fetchError?.message ?? "Ocorrência não encontrada." };
  }

  const { error } = await supabase
    .from("expense_occurrences")
    .update({ data_pagamento: null, forma_pagamento: null })
    .eq("id", occurrenceId);

  if (error) {
    return { success: false, message: error.message };
  }

  // Desfazer o pagamento desfaz também o avanço automático que ele gerou:
  // remove a parcela seguinte SE ela ainda não foi paga (só existiria por
  // causa deste pagamento) — restaura esta como a única pendente de novo.
  // Se o profissional já tiver pago a seguinte também (adiantou duas), essa
  // fica intacta: é histórico real, não um artefato do avanço automático.
  await supabase
    .from("expense_occurrences")
    .delete()
    .eq("expense_id", occurrence.expense_id)
    .gt("data_vencimento", occurrence.data_vencimento)
    .is("data_pagamento", null);

  revalidatePath("/financeiro");
  return { success: true };
}

// ----------------------------------------------------------------------------
// PATIENT_BILLINGS — o acordo de cobrança. Criar um billing já gera as
// parcelas (payments) correspondentes: avulso = 1 parcela, pacote = N
// parcelas (ou 1, se pago à vista), cada uma vencendo um mês após a
// anterior a partir de data_inicio.
// ----------------------------------------------------------------------------

export async function createPatientBilling(input: PatientBillingInput): Promise<ActionResult> {
  const parsed = patientBillingSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Dados inválidos. Verifique o formulário." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  const { data: billing, error: billingError } = await supabase
    .from("patient_billings")
    .insert({
      patient_id: parsed.data.patient_id,
      user_id: user.id,
      tipo: parsed.data.tipo,
      descricao: parsed.data.descricao,
      valor_total: parsed.data.valor_total,
      numero_consultas: parsed.data.tipo === "pacote" ? parsed.data.numero_consultas : null,
      data_inicio: parsed.data.data_inicio,
    })
    .select("id")
    .single<{ id: string }>();

  if (billingError || !billing) {
    return { success: false, message: billingError?.message ?? "Não foi possível criar a cobrança." };
  }

  const numeroParcelas = parsed.data.tipo === "pacote" ? parsed.data.numero_parcelas ?? 1 : 1;
  const parcelas = buildInstallmentPayments(parsed.data.valor_total, numeroParcelas, parsed.data.data_inicio);

  const paymentsToInsert = parcelas.map(({ valor, data_vencimento }) => ({
    billing_id: billing.id,
    user_id: user.id,
    valor,
    data_vencimento,
  }));

  const { error: paymentsError } = await supabase.from("payments").insert(paymentsToInsert);

  if (paymentsError) {
    // Não deixa uma cobrança "fantasma" sem nenhuma parcela gerada.
    await supabase.rpc("soft_delete_patient_billing", { billing_id: billing.id });
    return { success: false, message: `Não foi possível gerar as parcelas: ${paymentsError.message}` };
  }

  revalidatePath("/financeiro");
  revalidatePath(`/pacientes/${parsed.data.patient_id}`);
  return { success: true, message: "Cobrança criada com sucesso." };
}

/**
 * Só descrição e data de início são editáveis depois de criada — valor_total,
 * tipo e numero_consultas já geraram as parcelas em `payments` na criação;
 * mudá-los aqui deixaria as parcelas existentes dessincronizadas do acordo.
 * Trocar o valor de um pacote já cobrado é uma cobrança nova, não uma edição.
 */
export async function updatePatientBilling(
  billingId: string,
  input: { descricao: string; data_inicio: string }
): Promise<ActionResult> {
  if (!input.descricao || input.descricao.trim().length < 2) {
    return { success: false, message: "Informe a descrição da cobrança." };
  }
  if (!input.data_inicio) {
    return { success: false, message: "Informe a data de início." };
  }

  const supabase = createClient();

  const { error } = await supabase
    .from("patient_billings")
    .update({ descricao: input.descricao, data_inicio: input.data_inicio })
    .eq("id", billingId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/financeiro");
  return { success: true, message: "Cobrança atualizada com sucesso." };
}

/** Soft delete via função `security definer` (migration 0025). Não apaga as parcelas já geradas — ver comentário na migration sobre esse limite conhecido. */
export async function deletePatientBilling(billingId: string): Promise<ActionResult> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("soft_delete_patient_billing", { billing_id: billingId });

  if (error) {
    return { success: false, message: error.message };
  }
  if (!data) {
    return { success: false, message: "Cobrança não encontrada." };
  }

  revalidatePath("/financeiro");
  return { success: true };
}

// ----------------------------------------------------------------------------
// PAYMENTS — parcelas/recebimentos de um patient_billing. "Pendente" é
// derivado (data_pagamento is null): não existe uma action "marcar como
// pendente/pago" mexendo num campo de status — registerPayment/
// unregisterPayment mexem direto em data_pagamento + forma_pagamento.
// ----------------------------------------------------------------------------

/** Adiciona uma parcela extra a uma cobrança já existente (fora do parcelamento automático da criação). */
export async function createPayment(billingId: string, input: PaymentInput): Promise<ActionResult> {
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Dados inválidos. Verifique o formulário." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  const { error } = await supabase.from("payments").insert({
    billing_id: billingId,
    user_id: user.id,
    valor: parsed.data.valor,
    data_vencimento: parsed.data.data_vencimento,
    observacoes: parsed.data.observacoes || null,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/financeiro");
  return { success: true, message: "Parcela adicionada com sucesso." };
}

/** Edita valor/vencimento/observações de uma parcela — não mexe em data_pagamento/forma_pagamento (ver registerPayment/unregisterPayment). */
export async function updatePayment(paymentId: string, input: PaymentInput): Promise<ActionResult> {
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Dados inválidos. Verifique o formulário." };
  }

  const supabase = createClient();

  const { error } = await supabase
    .from("payments")
    .update({
      valor: parsed.data.valor,
      data_vencimento: parsed.data.data_vencimento,
      observacoes: parsed.data.observacoes || null,
    })
    .eq("id", paymentId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/financeiro");
  return { success: true, message: "Parcela atualizada com sucesso." };
}

/** Dá baixa numa parcela — grava data_pagamento + forma_pagamento juntas (mesmo CHECK do banco). */
export async function registerPayment(paymentId: string, input: RegisterPaymentInput): Promise<ActionResult> {
  const parsed = registerPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Dados inválidos. Verifique o formulário." };
  }

  const supabase = createClient();

  const { error } = await supabase
    .from("payments")
    .update({ data_pagamento: parsed.data.data_pagamento, forma_pagamento: parsed.data.forma_pagamento })
    .eq("id", paymentId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/financeiro");
  return { success: true, message: "Pagamento registrado com sucesso." };
}

/** Desfaz uma baixa registrada por engano — volta a parcela para pendente. */
export async function unregisterPayment(paymentId: string): Promise<ActionResult> {
  const supabase = createClient();

  const { error } = await supabase
    .from("payments")
    .update({ data_pagamento: null, forma_pagamento: null })
    .eq("id", paymentId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/financeiro");
  return { success: true };
}

/** Soft delete via função `security definer` (migration 0025). */
export async function deletePayment(paymentId: string): Promise<ActionResult> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("soft_delete_payment", { payment_id: paymentId });

  if (error) {
    return { success: false, message: error.message };
  }
  if (!data) {
    return { success: false, message: "Pagamento não encontrado." };
  }

  revalidatePath("/financeiro");
  return { success: true };
}
