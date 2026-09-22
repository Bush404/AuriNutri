"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { Expense, ExpenseOccurrence } from "@/lib/types/database.types";
import { formatCurrencyBRL } from "@/lib/finance";
import { deleteExpense, unregisterExpenseOccurrencePayment } from "@/lib/actions/finance";
import { formatDate } from "@/lib/utils";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RegisterExpenseOccurrenceDialog } from "@/components/finance/register-expense-occurrence-dialog";
import { ExpenseFormDialog } from "@/components/finance/expense-form-dialog";

const RECORRENCIA_LABELS: Record<Expense["recorrencia"], string> = {
  unica: "Única",
  mensal: "Mensal",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

const PARCELAMENTO_LABELS: Record<NonNullable<Expense["parcelamento"]>, string> = {
  avista: "À vista",
  parcelado: "Parcelado",
};

export interface ExpenseRow extends Expense {
  /** A parcela pendente (ou, pra 'unica', a única) — sempre a de vencimento mais recente registrada. */
  parcelaAtual: ExpenseOccurrence | null;
}

export function ExpensesTable({ expenses }: { expenses: ExpenseRow[] }) {
  const [isPending, startTransition] = useTransition();
  const [expenseToDelete, setExpenseToDelete] = useState<ExpenseRow | null>(null);

  function handleUndoPayment(occurrenceId: string) {
    startTransition(async () => {
      const result = await unregisterExpenseOccurrencePayment(occurrenceId);
      if (!result.success) {
        toast.error("Não foi possível desfazer o pagamento", { description: result.message });
        return;
      }
      toast.success("Pagamento desfeito.");
    });
  }

  function handleDelete() {
    if (!expenseToDelete) return;
    startTransition(async () => {
      const result = await deleteExpense(expenseToDelete.id);
      if (!result.success) {
        toast.error("Não foi possível excluir", { description: result.message });
        return;
      }
      toast.success("Despesa excluída.");
      setExpenseToDelete(null);
    });
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Descrição</TableHead>
            <TableHead className="hidden sm:table-cell">Categoria</TableHead>
            <TableHead className="hidden md:table-cell">Recorrência</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Próxima parcela</TableHead>
            <TableHead className="w-[50px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.map((expense) => {
            const parcela = expense.parcelaAtual;
            const paga = Boolean(parcela?.data_pagamento);
            return (
              <TableRow key={expense.id}>
                <TableCell>
                  <span className="text-sm font-medium text-foreground">{expense.descricao}</span>
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                  {expense.categoria}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary">{RECORRENCIA_LABELS[expense.recorrencia]}</Badge>
                    {expense.parcelamento && (
                      <Badge variant="outline" className="text-[10px]">
                        {PARCELAMENTO_LABELS[expense.parcelamento]}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-foreground">{formatCurrencyBRL(expense.valor)}</TableCell>
                <TableCell>
                  {!parcela ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : paga ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">{formatDate(parcela.data_vencimento)}</span>
                      <Badge variant="success" className="text-[10px]">
                        Pago em {formatDate(parcela.data_pagamento)}
                      </Badge>
                      <Button variant="ghost" size="sm" disabled={isPending} onClick={() => handleUndoPayment(parcela.id)}>
                        Desfazer
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">{formatDate(parcela.data_vencimento)}</span>
                      <Badge variant="warning" className="text-[10px]">
                        Pendente
                      </Badge>
                      <RegisterExpenseOccurrenceDialog occurrenceId={parcela.id} descricaoDespesa={expense.descricao} />
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <ExpenseFormDialog
                        expense={expense}
                        trigger={
                          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            <Pencil className="h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                        }
                      />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setExpenseToDelete(expense)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <AlertDialog open={Boolean(expenseToDelete)} onOpenChange={(open) => !open && setExpenseToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir despesa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{expenseToDelete?.descricao}</strong>? Essa ação não
              pode ser desfeita e remove também o histórico de pagamento desse mês.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isPending}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
