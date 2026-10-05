"use client";

import { useState, useTransition, type ComponentType, type ReactNode } from "react";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  CreditCard,
  FileText,
  MoreVertical,
  Package,
  Pencil,
  Trash2,
  Undo2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import type { AppointmentStatus, Payment, PatientBilling, PatientBillingTipo } from "@/lib/types/database.types";
import { formatCurrencyBRL, sumCurrency } from "@/lib/finance";
import { deletePayment, unregisterPayment } from "@/lib/actions/finance";
import { deleteAppointment } from "@/lib/actions/appointments";
import { FORMA_PAGAMENTO_LABELS } from "@/lib/validations/finance";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import {
  consultasDoPacote,
  estaVencido,
  pacoteAtivo,
  proximaCobranca,
  rotuloTipos,
  situacaoPagamento,
  type SituacaoPagamento,
} from "@/lib/patient-finance";
import type { SendCenterContext } from "@/lib/actions/patient-send";
import { Checkbox } from "@/components/ui/checkbox";

import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { PatientSendDialog } from "@/components/patients/patient-send-dialog";

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

/**
 * Aba "Financeiro" do paciente (Fase 19, layout de referência de 05/10/2026):
 * resumo (recebido, em aberto, cobranças, pacote ativo, próxima cobrança),
 * filtros e as tabelas de pendentes e pagos. Só leitura nova — as regras de
 * cobrança, recebimento, desfazer e exclusão são as mesmas de antes.
 */
export function PatientFinancePanel({
  patientId,
  patientNome,
  patientTelefone,
  billings,
  sendCenterContext,
  hoje,
}: {
  patientId: string;
  patientNome: string;
  patientTelefone: string | null;
  billings: PatientBillingWithPayments[];
  /** Para o botão "Recibo" abrir a Central de Envio (sem ela, o botão fica desativado). */
  sendCenterContext: SendCenterContext | null;
  /** "yyyy-mm-dd" no fuso do Brasil — para o selo "Vencido". */
  hoje: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [editando, setEditando] = useState<PagamentoRow | null>(null);
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

  // Só cobranças que ainda têm pagamento — as mesmas das tabelas. Excluir uma cobrança pendente apaga o pagamento
  // (soft_delete_payment) mas deixa o registro da cobrança; sem este filtro ele contaria como cobrança/pacote ativo.
  const cobrancasVisiveis = billings.filter((b) => b.payments.length > 0);
  const pacote = pacoteAtivo(cobrancasVisiveis);
  const proxima = proximaCobranca(pendentes);
  const [filtro, setFiltro] = useState<"todos" | "pagos" | "pendentes">("todos");
  const [reciboDe, setReciboDe] = useState<string | null>(null);

  const FILTROS = [
    { valor: "todos", rotulo: "Todos", n: todosPagamentos.length },
    { valor: "pagos", rotulo: "Pagos", n: pagos.length },
    { valor: "pendentes", rotulo: "Pendentes", n: pendentes.length },
  ] as const;

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="space-y-5 p-4 sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-success-soft text-primary">
                <CreditCard className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Financeiro</h2>
                <p className="text-sm text-muted-foreground">Acompanhe as cobranças, pagamentos e pacotes deste paciente.</p>
              </div>
            </div>
            <NewPatientBillingDialog patientId={patientId} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(12.5rem,1fr))]">
            <ResumoCard icon={CircleDollarSign} rotulo="Recebido">
              <p className="text-2xl font-bold tabular-nums tracking-tight text-primary">{formatCurrencyBRL(totalRecebido)}</p>
              <p className="text-sm text-muted-foreground">
                {pagos.length === 0 ? "nenhum pagamento ainda" : `em ${pagos.length} ${pagos.length === 1 ? "pagamento" : "pagamentos"}`}
              </p>
            </ResumoCard>

            <ResumoCard icon={Clock} rotulo="Em aberto" tom="laranja">
              <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground">{formatCurrencyBRL(totalPendente)}</p>
              {pendentes.length === 0 ? (
                <>
                  <Badge variant="success" className="mt-1 gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Tudo em dia
                  </Badge>
                  <p className="mt-1 text-xs text-muted-foreground">Nenhum pagamento pendente.</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  em {pendentes.length} {pendentes.length === 1 ? "pagamento" : "pagamentos"}
                </p>
              )}
            </ResumoCard>

            <ResumoCard icon={FileText} rotulo="Total de cobranças" tom="cinza">
              <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground">{cobrancasVisiveis.length}</p>
              <p className="text-sm text-muted-foreground">{rotuloTipos(cobrancasVisiveis) || "nenhuma cobrança"}</p>
            </ResumoCard>

            {pacote && <PacoteAtivoCard pacote={pacote} />}

            <ResumoCard icon={CalendarDays} rotulo="Próxima cobrança" tom="cinza" suave>
              {proxima ? (
                <>
                  <p className="text-xl font-bold tabular-nums tracking-tight text-foreground">{formatCurrencyBRL(proxima.valor)}</p>
                  <p className="text-sm text-muted-foreground">{proxima.billingDescricao}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    Vence em {formatDate(proxima.data_vencimento)}
                    {estaVencido(proxima, hoje) && <Badge variant="destructive">Vencido</Badge>}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground">Nenhuma cobrança pendente no momento.</p>
                  <p className="mt-1 text-xs text-muted-foreground">O paciente está em dia com os pagamentos.</p>
                </>
              )}
            </ResumoCard>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Cobranças e pagamentos</h2>
            <p className="text-sm text-muted-foreground">Cobranças avulsas e pacotes deste paciente.</p>
          </div>

          {todosPagamentos.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="Nenhuma cobrança registrada ainda"
              description='Use "Nova cobrança" acima para registrar um avulso ou pacote.'
            />
          ) : (
            <>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar cobranças">
                {FILTROS.map((f) => {
                  const ativo = filtro === f.valor;
                  return (
                    <button
                      key={f.valor}
                      type="button"
                      aria-pressed={ativo}
                      onClick={() => setFiltro(f.valor)}
                      className={cn(
                        "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        ativo
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-muted/40 text-foreground hover:bg-muted",
                      )}
                    >
                      {f.rotulo} ({f.n})
                    </button>
                  );
                })}
              </div>

              {filtro !== "pagos" &&
                (pendentes.length === 0 ? (
                  <div className="flex items-center gap-3 rounded-lg border border-success/20 bg-success-soft/40 px-4 py-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success text-primary-foreground">
                      <Check className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Nenhuma cobrança pendente</p>
                      <p className="text-xs text-muted-foreground">O paciente está em dia com todos os pagamentos.</p>
                    </div>
                  </div>
                ) : (
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">Pendentes ({pendentes.length})</h3>
                    <div className="overflow-x-auto rounded-xl border">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow className="hover:bg-transparent">
                            <TableHead className={TH}>Descrição</TableHead>
                            <TableHead className={TH}>Valor</TableHead>
                            <TableHead className={cn(TH, "hidden sm:table-cell")}>Vencimento</TableHead>
                            <TableHead className={cn(TH, "text-right")}>Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendentes.map((p) => (
                            <TableRow key={p.id}>
                              <TableCell>
                                <DescricaoCell p={p} onShowPackage={setPackageDetailsFor} />
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-sm tabular-nums text-foreground">
                                {formatCurrencyBRL(p.valor)}
                              </TableCell>
                              <TableCell className="hidden whitespace-nowrap text-sm text-muted-foreground sm:table-cell">
                                <span className="inline-flex items-center gap-1.5">
                                  {formatDate(p.data_vencimento)}
                                  {estaVencido(p, hoje) && <Badge variant="destructive">Vencido</Badge>}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-end gap-1">
                                  <RegisterPatientPaymentDialog paymentId={p.id} descricaoCobranca={p.billingDescricao} />
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground"
                                        aria-label={`Mais ações: ${p.billingDescricao}`}
                                        title="Mais ações"
                                      >
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onSelect={() => setEditando(p)}>
                                        <Pencil className="h-4 w-4" />
                                        Editar
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onSelect={() => {
                                          setCancelarConsulta(true);
                                          setPaymentToDelete(p);
                                        }}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                        Excluir
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </section>
                ))}

              {filtro !== "pendentes" && (
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">Pagos ({pagos.length})</h3>
                  {pagos.length === 0 ? (
                    <p className="rounded-lg bg-muted/40 px-4 py-3 text-sm text-muted-foreground">Nenhum pagamento recebido ainda.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow className="hover:bg-transparent">
                            <TableHead className={TH}>Descrição</TableHead>
                            <TableHead className={TH}>Valor</TableHead>
                            <TableHead className={cn(TH, "hidden md:table-cell")}>Recebido em</TableHead>
                            <TableHead className={cn(TH, "hidden sm:table-cell")}>Forma</TableHead>
                            <TableHead className={TH}>Recibo</TableHead>
                            <TableHead className={TH}>Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pagos.map((p) => (
                            <TableRow key={p.id}>
                              <TableCell>
                                <DescricaoCell p={p} onShowPackage={setPackageDetailsFor} />
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-sm tabular-nums text-foreground">
                                {formatCurrencyBRL(p.valor)}
                              </TableCell>
                              <TableCell className="hidden whitespace-nowrap text-sm text-muted-foreground md:table-cell">
                                {formatDate(p.data_pagamento)}
                              </TableCell>
                              <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                                {p.forma_pagamento ? FORMA_PAGAMENTO_LABELS[p.forma_pagamento] : "—"}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={!sendCenterContext}
                                  onClick={() => setReciboDe(p.id)}
                                  aria-label={`Recibo: ${p.billingDescricao}, ${formatDate(p.data_pagamento)}`}
                                >
                                  <FileText className="h-4 w-4" />
                                  Recibo
                                </Button>
                              </TableCell>
                              <TableCell>
                                <Button variant="outline" size="sm" disabled={isPending} onClick={() => handleUndo(p.id)}>
                                  <Undo2 className="h-4 w-4" />
                                  Desfazer
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* "Recibo": a mesma Central de Envio do botão "Enviar", já com o recibo deste pagamento escolhido. */}
      {reciboDe && sendCenterContext && (
        <PatientSendDialog
          key={reciboDe}
          patientId={patientId}
          patientNome={patientNome}
          patientTelefone={patientTelefone}
          context={sendCenterContext}
          controle={{
            open: true,
            onOpenChange: (o) => !o && setReciboDe(null),
            inicial: { itens: ["recibo"], reciboPagamentoId: reciboDe },
          }}
        />
      )}

      {editando && (
        <EditPatientPaymentDialog
          key={editando.id}
          payment={editando}
          descricaoCobranca={editando.billingDescricao}
          open
          onOpenChange={(open) => !open && setEditando(null)}
        />
      )}

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

const TH = "h-10 text-xs font-medium uppercase tracking-wide text-muted-foreground";

const TOM_ICONE = {
  verde: "bg-success-soft text-primary",
  laranja: "bg-warning-soft text-accent",
  cinza: "bg-muted text-muted-foreground",
} as const;

/** Cartão do resumo: ícone redondo à esquerda, rótulo e o conteúdo (número + linha de apoio). */
function ResumoCard({
  icon: Icon,
  rotulo,
  tom = "verde",
  suave = false,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  rotulo: string;
  tom?: keyof typeof TOM_ICONE;
  /** Fundo levemente acinzentado (cartões de situação, como na referência). */
  suave?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex gap-3 rounded-xl border p-4 shadow-sm", suave ? "bg-muted/30" : "bg-card")}>
      <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", TOM_ICONE[tom])}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{rotulo}</p>
        {children}
      </div>
    </div>
  );
}

const SITUACAO_LABEL: Record<SituacaoPagamento, { label: string; variant: "success" | "warning" | "info" }> = {
  pago: { label: "Pago", variant: "success" },
  pendente: { label: "Pendente", variant: "warning" },
  parcial: { label: "Parcial", variant: "info" },
};

/**
 * "Pacote ativo": o pacote mais recente com consulta ainda agendada ou
 * confirmada. A barra mostra só as realizadas; faltas aparecem à parte
 * (se a falta conta como usada é decisão do consultório). Pacote não tem
 * validade no sistema, então não há "válido até".
 */
function PacoteAtivoCard({ pacote }: { pacote: PatientBillingWithPayments }) {
  const c = consultasDoPacote(pacote);
  const situacao = SITUACAO_LABEL[situacaoPagamento(pacote.payments)];
  const partes = [
    c.faltas > 0 && `${c.faltas} ${c.faltas === 1 ? "falta" : "faltas"}`,
    c.agendadas > 0 && `${c.agendadas} ${c.agendadas === 1 ? "agendada" : "agendadas"}`,
  ].filter(Boolean);

  return (
    <div className="flex gap-3 rounded-xl border border-success/20 bg-success-soft/30 p-4 shadow-sm">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-success-soft text-primary">
        <Package className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-sm font-medium text-foreground">Pacote ativo</p>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-foreground">{pacote.descricao}</p>
          <Badge variant={situacao.variant}>{situacao.label}</Badge>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={c.total}
          aria-valuenow={c.realizadas}
          aria-label="Consultas realizadas do pacote"
        >
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${c.total > 0 ? Math.min(100, (c.realizadas / c.total) * 100) : 0}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {c.realizadas} de {c.total} {c.total === 1 ? "consulta realizada" : "consultas realizadas"}
          {partes.length > 0 && ` • ${partes.join(" • ")}`}
        </p>
      </div>
    </div>
  );
}
