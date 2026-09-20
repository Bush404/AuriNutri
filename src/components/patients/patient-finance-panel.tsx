"use client";

import { useTransition } from "react";
import { Wallet } from "lucide-react";
import { toast } from "sonner";

import type { Payment, PatientBilling, PatientBillingTipo } from "@/lib/types/database.types";
import { formatCurrencyBRL, sumCurrency } from "@/lib/finance";
import { unregisterPayment } from "@/lib/actions/finance";
import { formatDate } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { NewPatientBillingDialog } from "@/components/patients/new-patient-billing-dialog";
import { RegisterPatientPaymentDialog } from "@/components/patients/register-patient-payment-dialog";

const FORMA_PAGAMENTO_LABELS: Record<NonNullable<Payment["forma_pagamento"]>, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  transferencia: "Transferência",
  outro: "Outro",
};

const TIPO_LABELS: Record<PatientBillingTipo, string> = {
  avulso: "Avulso",
  pacote: "Pacote",
};

export type PatientBillingWithPayments = PatientBilling & { payments: Payment[] };

interface PagamentoRow extends Payment {
  billingDescricao: string;
  billingTipo: PatientBillingTipo;
}

export function PatientFinancePanel({
  patientId,
  billings,
}: {
  patientId: string;
  billings: PatientBillingWithPayments[];
}) {
  const [isPending, startTransition] = useTransition();

  const todosPagamentos: PagamentoRow[] = billings.flatMap((billing) =>
    billing.payments.map((payment) => ({ ...payment, billingDescricao: billing.descricao, billingTipo: billing.tipo }))
  );

  const pendentes = todosPagamentos
    .filter((p) => !p.data_pagamento)
    .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));

  const pagos = todosPagamentos
    .filter((p) => p.data_pagamento)
    .sort((a, b) => (b.data_pagamento ?? "").localeCompare(a.data_pagamento ?? ""));

  const totalRecebido = sumCurrency(pagos.map((p) => p.valor));
  const totalPendente = sumCurrency(pendentes.map((p) => p.valor));

  function handleUndo(paymentId: string) {
    startTransition(async () => {
      const result = await unregisterPayment(paymentId);
      if (!result.success) {
        toast.error("Não foi possível desfazer o recebimento", { description: result.message });
        return;
      }
      toast.success("Recebimento desfeito.");
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recebido</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{formatCurrencyBRL(totalRecebido)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Em aberto</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{formatCurrencyBRL(totalPendente)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Cobranças e pagamentos</CardTitle>
            <CardDescription>Cobranças avulsas e pacotes deste paciente.</CardDescription>
          </div>
          <NewPatientBillingDialog patientId={patientId} />
        </CardHeader>
        <CardContent className="space-y-6">
          {todosPagamentos.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="Nenhuma cobrança registrada ainda"
              description='Use "Nova cobrança" acima para registrar um avulso ou pacote.'
            />
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Pendentes</p>
                {pendentes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum pagamento pendente.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead className="w-[180px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendentes.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>
                            <span className="text-sm font-medium text-foreground">{p.billingDescricao}</span>
                            <Badge variant="secondary" className="ml-2 text-[10px]">
                              {TIPO_LABELS[p.billingTipo]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-foreground">{formatCurrencyBRL(p.valor)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDate(p.data_vencimento)}</TableCell>
                          <TableCell>
                            <RegisterPatientPaymentDialog paymentId={p.id} descricaoCobranca={p.billingDescricao} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Pagos</p>
                {pagos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum pagamento recebido ainda.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Recebido em</TableHead>
                        <TableHead>Forma</TableHead>
                        <TableHead className="w-[110px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagos.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>
                            <span className="text-sm font-medium text-foreground">{p.billingDescricao}</span>
                            <Badge variant="secondary" className="ml-2 text-[10px]">
                              {TIPO_LABELS[p.billingTipo]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-foreground">{formatCurrencyBRL(p.valor)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(p.data_pagamento)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {p.forma_pagamento ? FORMA_PAGAMENTO_LABELS[p.forma_pagamento] : "—"}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" disabled={isPending} onClick={() => handleUndo(p.id)}>
                              Desfazer
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Para gerar o recibo de um pagamento recebido, use o botão &quot;Enviar&quot; no topo da página (Central de
        Envio → Recibo de pagamento).
      </p>
    </div>
  );
}
