import { Wallet } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { averageMonthlyAppointments, latestOccurrencePerExpense, monthlyFixedCost, monthlyFixedCostByCategory } from "@/lib/finance";
import { ensureNextExpenseOccurrences } from "@/lib/actions/finance";
import type { Expense, ExpenseOccurrence } from "@/lib/types/database.types";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ExpenseFormDialog } from "@/components/finance/expense-form-dialog";
import { ExpensesTable, type ExpenseRow } from "@/components/finance/expenses-table";
import { CustoConsultorioCard } from "@/components/finance/custo-consultorio-card";

export default async function FinanceiroPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Garante que toda despesa recorrente ativa tem uma parcela pendente —
    // não há job agendado neste projeto, então isso acontece a cada carga
    // da página. Ver comentário em ensureNextExpenseOccurrences sobre como
    // isso permite pagar adiantado.
    await ensureNextExpenseOccurrences(supabase, user.id);
  }

  const noventaDiasAtrasIso = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: expenses, error: expensesError }, { count: atendimentosRealizados }] = await Promise.all([
    supabase
      .from("expenses")
      .select("*")
      .order("categoria")
      .returns<Expense[]>(),
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("status", "realizado")
      .gte("data_hora", noventaDiasAtrasIso),
  ]);

  const expensesList = expenses ?? [];
  const sugestaoAtendimentos = averageMonthlyAppointments(atendimentosRealizados ?? 0);
  const custoMensal = monthlyFixedCost(expensesList);
  const breakdown = monthlyFixedCostByCategory(expensesList);

  // A parcela atual de cada despesa é sempre a de data_vencimento mais alta
  // já registrada — o invariante mantido por ensureNextExpenseOccurrences
  // garante que essa é sempre a pendente (ou, pra 'unica', a única que existe).
  const expenseIds = expensesList.map((expense) => expense.id);
  const { data: occurrences } = expenseIds.length
    ? await supabase.from("expense_occurrences").select("*").in("expense_id", expenseIds).returns<ExpenseOccurrence[]>()
    : { data: [] as ExpenseOccurrence[] };

  const parcelaAtualPorDespesa = latestOccurrencePerExpense(occurrences ?? []);

  const expensesComParcela: ExpenseRow[] = expensesList.map((expense) => ({
    ...expense,
    parcelaAtual: parcelaAtualPorDespesa.get(expense.id) ?? null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Financeiro</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Despesas do consultório e uma referência de custo por atendimento — não é um ERP.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Despesas</CardTitle>
              <CardDescription>Custos fixos e pontuais do consultório.</CardDescription>
            </div>
            <ExpenseFormDialog />
          </CardHeader>
          <CardContent>
            {expensesError && (
              <p className="text-sm text-destructive">Erro ao carregar despesas: {expensesError.message}</p>
            )}

            {!expensesError && expensesComParcela.length > 0 && <ExpensesTable expenses={expensesComParcela} />}

            {!expensesError && expensesComParcela.length === 0 && (
              <EmptyState
                icon={Wallet}
                title="Nenhuma despesa cadastrada ainda"
                description='Use "Nova despesa" acima para ver o custo fixo mensal e o custo por atendimento.'
              />
            )}
          </CardContent>
        </Card>

        <CustoConsultorioCard
          custoMensal={custoMensal}
          breakdown={breakdown}
          sugestaoAtendimentos={sugestaoAtendimentos}
        />
      </div>
    </div>
  );
}
