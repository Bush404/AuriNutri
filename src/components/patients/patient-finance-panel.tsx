"use client";

import { useState, useTransition } from "react";
import { CalendarDays, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";

import type { AppointmentStatus, Payment, PatientBilling, PatientBillingTipo } from "@/lib/types/database.types";
import { formatCurrencyBRL, sumCurrency } from "@/lib/finance";
import { deletePayment, unregisterPayment } from "@/lib/actions/finance";
import { deleteAppointment } from "@/lib/actions/appointments";
import { FORMA_PAGAMENTO_LABELS } from "@/lib/validations/finance";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { NewPatientBillingDialog } from "@/components/patients/new-patient-billing-dialog";
import { RegisterPatientPaymentDialog } from "@/components/patients/register-patient-payment-dialog";
import { EditPatientPaymentDialog } from "@/components/patients/edit-patient-payment-dialog";

const TIPO_LABELS: Record<PatientBillingTipo, string> = {
  avulso: "Avulso",
  pacote: "Pacote",
};

const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  realizado: "Realizado",
  faltou: "Faltou",
  cancelado: "Cancelado",
};

type LinkedAppointment = { id: string; status: AppointmentStatus; data_hora: string };
type PacoteConsulta = { id: string; status: AppointmentStatus; data_hora: string; duracao_min: number };

export type PatientBillingWithPayments = PatientBilling & {
  payments: Payment[];
  appointments: LinkedAppointment | null;
  pacote_consultas: PacoteConsulta[];
};

interface PagamentoRow extends Payment {
  billingDescricao: string;
  billingTipo: PatientBillingTipo;
  linkedAppointment: LinkedAppointment | null;
  pacoteConsultas: PacoteConsulta[];
}

const CANCELABLE_STATUSES: AppointmentStatus[] = ["agendado", "confirmado"];

/** Consultas de uma cobrança que ainda podem ser canceladas ao excluí-la (nunca as já realizadas/faltou/canceladas). */
function getCancelableAppointments(p: PagamentoRow | null): { id: string; data_hora: string }[] {
  if (!p) return [];
  if (p.billingTipo === "avulso") {
    return p.linkedAppointment && CANCELABLE_STATUSES.includes(p.linkedAppointment.status)
      ? [p.linkedAppointment]
      : [];
  }
  return p.pacoteConsultas.filter((c) => CANCELABLE_STATUSES.includes(c.status));
}

function DescricaoCell({ p, onShowPackage }: { p: PagamentoRow; onShowPackage: (p: PagamentoRow) => void }) {
  const isPacoteComConsultas = p.billingTipo === "pacote" && p.pacoteConsultas.length > 0;
  return (
    <>
      {isPacoteComConsultas ? (
        <button
          type="button"
          className="text-sm font-medium text-foreground underline decoration-dotted underline-offset-2 hover:text-primary"
          onClick={() => onShowPackage(p)}
        >
          {p.billingDescricao}
        </button>
      ) : (
        <span className="text-sm font-medium text-foreground">{p.billingDescricao}</span>
      )}
      <Badge variant="secondary" className="ml-2 text-[10px]">
        {TIPO_LABELS[p.billingTipo]}
      </Badge>
    </>
  );
}

export function PatientFinancePanel({
  patientId,
  billings,
}: {
  patientId: string;
  billings: PatientBillingWithPayments[];
}) {
  const [isPending, startTransition] = useTransition();
  const [paymentToDelete, setPaymentToDelete] = useState<PagamentoRow | null>(null);
  const [cancelarConsulta, setCancelarConsulta] = useState(true);
  const [packageDetailsFor, setPackageDetailsFor] = useState<PagamentoRow | null>(null);
  const [editAfterCancel, setEditAfterCancel] = useState<PagamentoRow | null>(null);

  const todosPagamentos: PagamentoRow[] = billings.flatMap((billing) =>
    billing.payments.map((payment) => ({
      ...payment,
      billingDescricao: billing.descricao,
      billingTipo: billing.tipo,
      linkedAppointment: billing.appointments,
      pacoteConsultas: billing.pacote_consultas,
    }))
  );

  const pendentes = todosPagamentos
    .filter((p) => !p.data_pagamento)
    .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));

  const pagos = todosPagamentos
    .filter((p) => p.data_pagamento)
    .sort((a, b) => (b.data_pagamento ?? "").localeCompare(a.data_pagamento ?? ""));

  const totalRecebido = sumCurrency(pagos.map((p) => p.valor));
  const totalPendente = sumCurrency(pendentes.map((p) => p.valor));

  const cancelaveisParaExcluir = getCancelableAppointments(paymentToDelete);

  /**
   * Pacote parcialmente cumprido (pelo menos 1 consulta já realizada/faltou/cancelada E pelo
   * menos 1 ainda agendada/confirmada): não decide sozinho o que fazer com o dinheiro — pergunta
   * ao profissional (manter/editar/excluir), porque isso é política do consultório, não algo o
   * sistema deveria assumir.
   */
  const isPacotePartial =
    paymentToDelete?.billingTipo === "pacote" &&
    cancelaveisParaExcluir.length > 0 &&
    paymentToDelete.pacoteConsultas.some((c) => !CANCELABLE_STATUSES.includes(c.status));
  const jaResolvidasCount = paymentToDelete ? paymentToDelete.pacoteConsultas.length - cancelaveisParaExcluir.length : 0;

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

  function handleDeletePayment() {
    if (!paymentToDelete) return;
    const isPacote = paymentToDelete.billingTipo === "pacote";
    const cancelaveis = getCancelableAppointments(paymentToDelete);

    startTransition(async () => {
      // Avulso (1:1): cancelar a consulta já cuida de cancelar a cobrança inteira ligada a ela
      // (ver cancelAppointmentBilling) — não precisa chamar deletePayment também.
      if (!isPacote && cancelaveis.length > 0 && cancelarConsulta) {
        const result = await deleteAppointment(cancelaveis[0].id);
        if (!result.success) {
          toast.error("Não foi possível cancelar a consulta", { description: result.message });
          return;
        }
        toast.success("Cobrança excluída e consulta cancelada.");
        setPaymentToDelete(null);
        return;
      }

      const result = await deletePayment(paymentToDelete.id);
      if (!result.success) {
        toast.error("Não foi possível excluir a cobrança", { description: result.message });
        return;
      }

      // Pacote (N:1): a cobrança já foi excluída acima. Cancela à parte só as consultas que
      // ainda não aconteceram — as já realizadas continuam intactas (ver cancelAppointmentBilling:
      // com pelo menos uma consulta ainda ligada, a cobrança em si não é re-cancelada por elas).
      if (isPacote && cancelarConsulta && cancelaveis.length > 0) {
        for (const consulta of cancelaveis) {
          await deleteAppointment(consulta.id);
        }
        toast.success(`Cobrança excluída e ${cancelaveis.length} consulta(s) do pacote cancelada(s).`);
        setPaymentToDelete(null);
        return;
      }

      toast.success("Cobrança excluída.");
      setPaymentToDelete(null);
    });
  }

  /**
   * Pacote parcial — opção "Cobrar apenas a consulta realizada": só ABRE a edição do valor aqui,
   * pra reduzir a cobrança pro que já foi entregue. As consultas restantes só são canceladas
   * depois que o profissional realmente salvar (ver onSaved abaixo, no EditPatientPaymentDialog)
   * — nunca antes, senão cancela a consulta mesmo que ele desista e feche sem salvar.
   */
  function handleAjustarValorRealizada() {
    if (!paymentToDelete) return;
    setEditAfterCancel(paymentToDelete);
    setPaymentToDelete(null);
  }

  function handleValorEditadoConfirmado() {
    if (!editAfterCancel) return;
    const consultas = getCancelableAppointments(editAfterCancel);
    setEditAfterCancel(null);
    startTransition(async () => {
      for (const consulta of consultas) {
        await deleteAppointment(consulta.id);
      }
      if (consultas.length > 0) {
        toast.success(`${consultas.length} consulta(s) cancelada(s).`);
      }
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
                        <TableHead className="w-[240px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendentes.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>
                            <DescricaoCell p={p} onShowPackage={setPackageDetailsFor} />
                          </TableCell>
                          <TableCell className="text-sm text-foreground">{formatCurrencyBRL(p.valor)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDate(p.data_vencimento)}</TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <RegisterPatientPaymentDialog paymentId={p.id} descricaoCobranca={p.billingDescricao} />
                              <EditPatientPaymentDialog payment={p} descricaoCobranca={p.billingDescricao} />
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Excluir"
                                onClick={() => {
                                  setCancelarConsulta(true);
                                  setPaymentToDelete(p);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
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
                            <DescricaoCell p={p} onShowPackage={setPackageDetailsFor} />
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

      <AlertDialog open={Boolean(paymentToDelete)} onOpenChange={(open) => !open && setPaymentToDelete(null)}>
        <AlertDialogContent className={isPacotePartial ? "sm:max-w-lg" : undefined}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isPacotePartial ? "Cancelamento parcial do pacote" : "Excluir cobrança pendente"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isPacotePartial ? (
                <>
                  Este pacote tem <strong>{jaResolvidasCount} consulta(s) já realizada(s)</strong> e{" "}
                  <strong>{cancelaveisParaExcluir.length} ainda agendada(s)</strong>. A cobrança pendente é de{" "}
                  <strong>{formatCurrencyBRL(paymentToDelete?.valor ?? 0)}</strong> — cobrindo o pacote inteiro,
                  incluindo a consulta já realizada. O que fazer com ela ao cancelar as consultas restantes é
                  uma decisão sua, não do sistema.
                </>
              ) : (
                <>
                  Tem certeza que deseja excluir a cobrança de{" "}
                  <strong>{formatCurrencyBRL(paymentToDelete?.valor ?? 0)}</strong> ({paymentToDelete?.billingDescricao})?
                  Essa ação não pode ser desfeita.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {!isPacotePartial && cancelaveisParaExcluir.length > 0 && paymentToDelete && (
            <label className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
              <Checkbox
                checked={cancelarConsulta}
                onCheckedChange={(checked) => setCancelarConsulta(checked === true)}
                className="mt-0.5"
              />
              <span>
                {paymentToDelete.billingTipo === "avulso" ? (
                  <>
                    Deseja também cancelar a consulta agendada para{" "}
                    <strong>{formatDateTime(cancelaveisParaExcluir[0].data_hora)}</strong>? Essa cobrança nasceu
                    dela — se não cancelar, a consulta continua na Agenda.
                  </>
                ) : (
                  <>
                    Deseja também cancelar as <strong>{cancelaveisParaExcluir.length} consulta(s)</strong> deste
                    pacote? Se não cancelar, elas continuam agendadas normalmente.
                  </>
                )}
              </span>
            </label>
          )}

          {isPacotePartial ? (
            <div className="flex flex-col gap-2">
              <Button
                className="w-full justify-center"
                variant="outline"
                disabled={isPending}
                onClick={handleAjustarValorRealizada}
              >
                Cobrar apenas a consulta realizada
              </Button>
              <Button
                className="w-full justify-center"
                variant="destructive"
                disabled={isPending}
                onClick={handleDeletePayment}
              >
                Excluir cobrança inteira
              </Button>
              <AlertDialogCancel disabled={isPending} className="mt-1 w-full sm:w-full">
                Cancelar
              </AlertDialogCancel>
            </div>
          ) : (
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeletePayment} disabled={isPending}>
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          )}
        </AlertDialogContent>
      </AlertDialog>

      {editAfterCancel && (
        <EditPatientPaymentDialog
          payment={editAfterCancel}
          descricaoCobranca={editAfterCancel.billingDescricao}
          open={Boolean(editAfterCancel)}
          onOpenChange={(open) => !open && setEditAfterCancel(null)}
          warningNote={
            getCancelableAppointments(editAfterCancel).length > 0
              ? `Ajuste o valor pra refletir só a(s) consulta(s) já realizada(s). Ao salvar, ${getCancelableAppointments(editAfterCancel).length} consulta(s) que ainda não aconteceram serão canceladas.`
              : undefined
          }
          onSaved={handleValorEditadoConfirmado}
        />
      )}

      <Dialog open={Boolean(packageDetailsFor)} onOpenChange={(open) => !open && setPackageDetailsFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{packageDetailsFor?.billingDescricao}</DialogTitle>
            <DialogDescription>
              {formatCurrencyBRL(packageDetailsFor?.valor ?? 0)}
              {packageDetailsFor?.data_pagamento
                ? ` — pago em ${formatDate(packageDetailsFor.data_pagamento)}`
                : ` — vencimento em ${formatDate(packageDetailsFor?.data_vencimento)}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Consultas do pacote</p>
            <ul className="space-y-2">
              {[...(packageDetailsFor?.pacoteConsultas ?? [])]
                .sort((a, b) => a.data_hora.localeCompare(b.data_hora))
                .map((consulta) => (
                  <li
                    key={consulta.id}
                    className="flex items-center justify-between rounded-md border border-border p-2 text-sm"
                  >
                    <span className="flex items-center gap-2 text-foreground">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      {formatDateTime(consulta.data_hora)}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {APPOINTMENT_STATUS_LABELS[consulta.status]}
                    </Badge>
                  </li>
                ))}
            </ul>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
