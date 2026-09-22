"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { CheckCircle2, Loader2, MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type {
  AppointmentWithPatient,
  AppointmentStatus,
  AppointmentTipo,
  AppointmentFinancialStatus,
  FormaPagamento,
} from "@/lib/types/database.types";
import type { PatientPickerResult } from "@/lib/actions/patients";
import { createAppointment, deleteAppointment, updateAppointment, updateAppointmentStatus } from "@/lib/actions/appointments";
import { getPatientAgendaContext } from "@/lib/actions/patient-context";
import { getAppointmentBillingStatus, getPackageDeletionImpact, setAppointmentBillingStatus } from "@/lib/actions/finance";
import { formatCurrencyBRL } from "@/lib/finance";
import { FORMAS_PAGAMENTO, FORMA_PAGAMENTO_LABELS, type AppointmentBillingInput } from "@/lib/validations/finance";
import type { PatientAgendaContext } from "@/lib/patient-context";
import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS_META,
  APPOINTMENT_TIPOS,
  APPOINTMENT_TIPO_LABELS,
  addMinutesToTimeStr,
  timeStrToMinutes,
} from "@/lib/agenda";
import { utcInstantToZonedDateTime } from "@/lib/timezone";
import { formatDate } from "@/lib/utils";
import { buildAppointmentReminderMessage, buildWhatsAppUrl } from "@/lib/whatsapp";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PatientCombobox } from "@/components/shared/patient-combobox";
import { CurrencyInput } from "@/components/shared/currency-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const FINANCIAL_STATUS_LABELS: Record<AppointmentFinancialStatus, string> = {
  nao_pago: "Não pago",
  pagou_sinal: "Pagou sinal",
  pagou_integral: "Pagou integral",
  gratuito: "Gratuito",
};

interface BillingFormState {
  status: "" | AppointmentFinancialStatus;
  naoPagoValor?: number;
  naoPagoVencimento: string;
  integralValor?: number;
  integralData: string;
  integralForma: FormaPagamento;
  sinalValor?: number;
  sinalData: string;
  sinalForma: FormaPagamento;
  faltaValor?: number;
  faltaVencimento: string;
}

function buildInitialBillingState(dataConsulta: string): BillingFormState {
  return {
    status: "",
    naoPagoVencimento: dataConsulta,
    integralData: dataConsulta,
    integralForma: "pix",
    sinalData: dataConsulta,
    sinalForma: "pix",
    faltaVencimento: dataConsulta,
  };
}

interface FormState {
  data: string;
  horaInicio: string;
  horaFim: string;
  tipo: AppointmentTipo | "";
  status: AppointmentStatus;
  observacoes: string;
}

const DEFAULT_DURACAO_MIN = 60;

function buildInitialState(
  timeZone: string,
  appointment: AppointmentWithPatient | undefined,
  defaultDateStr: string | undefined,
  defaultTimeStr: string | undefined
): FormState {
  if (appointment) {
    const { dateStr, timeStr } = utcInstantToZonedDateTime(appointment.data_hora, timeZone);
    return {
      data: dateStr,
      horaInicio: timeStr,
      horaFim: addMinutesToTimeStr(timeStr, appointment.duracao_min),
      tipo: appointment.tipo,
      status: appointment.status,
      observacoes: appointment.observacoes ?? "",
    };
  }
  const horaInicio = defaultTimeStr ?? "08:00";
  return {
    data: defaultDateStr ?? new Date().toISOString().slice(0, 10),
    horaInicio,
    horaFim: addMinutesToTimeStr(horaInicio, DEFAULT_DURACAO_MIN),
    tipo: "",
    status: "agendado",
    observacoes: "",
  };
}

interface AppointmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timeZone: string;
  appointment?: AppointmentWithPatient;
  defaultDateStr?: string;
  defaultTimeStr?: string;
  defaultPatient?: PatientPickerResult | null;
}

/** Diálogo único de criar/editar consulta — reaproveitado em modo edição, mesmo padrão de NewAssessmentDialog. */
export function AppointmentFormDialog({
  open,
  onOpenChange,
  timeZone,
  appointment,
  defaultDateStr,
  defaultTimeStr,
  defaultPatient,
}: AppointmentFormDialogProps) {
  const isEditing = Boolean(appointment);
  /** Consulta criada por "Novo pacote" — o financeiro é gerenciado pelo pacote, não aqui (ver comentário na tela). */
  const belongsToPackage = Boolean(appointment?.patient_billing_id);
  const pacienteLabelId = useId();
  const formaPagamentoIntegralLabelId = useId();
  const formaPagamentoSinalLabelId = useId();
  const [selectedPatient, setSelectedPatient] = useState<PatientPickerResult | null>(
    appointment ? { id: appointment.patient_id, nome: appointment.patients?.nome ?? "Paciente" } : defaultPatient ?? null
  );
  const [form, setForm] = useState<FormState>(() =>
    buildInitialState(timeZone, appointment, defaultDateStr, defaultTimeStr)
  );
  const [patientError, setPatientError] = useState<string | null>(null);
  const [horarioError, setHorarioError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [context, setContext] = useState<PatientAgendaContext | null>(null);
  const [billing, setBilling] = useState<BillingFormState>(() =>
    buildInitialBillingState(buildInitialState(timeZone, appointment, defaultDateStr, defaultTimeStr).data)
  );
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [packageDeletionImpact, setPackageDeletionImpact] = useState<{
    isLastAppointment: boolean;
    paidValue: number | null;
  } | null>(null);

  // O diálogo não desmonta entre aberturas — reseta os valores toda vez que abre.
  useEffect(() => {
    if (!open) return;
    const initialForm = buildInitialState(timeZone, appointment, defaultDateStr, defaultTimeStr);
    setForm(initialForm);
    setSelectedPatient(
      appointment ? { id: appointment.patient_id, nome: appointment.patients?.nome ?? "Paciente" } : defaultPatient ?? null
    );
    setPatientError(null);
    setHorarioError(null);
    setBilling(buildInitialBillingState(initialForm.data));

    // Status financeiro já salvo, se estiver editando uma consulta existente
    // avulsa — consultas de pacote não usam esse fluxo (ver belongsToPackage).
    if (appointment && !appointment.patient_billing_id) {
      getAppointmentBillingStatus(appointment.id).then((state) => {
        if (!state.status) return;
        setBilling((b) => ({
          ...b,
          status: state.status ?? "",
          naoPagoValor: state.naoPagoValor,
          naoPagoVencimento: state.naoPagoVencimento ?? b.naoPagoVencimento,
          integralValor: state.integralValor,
          integralData: state.integralData ?? b.integralData,
          integralForma: state.integralForma ?? b.integralForma,
          sinalValor: state.sinalValor,
          sinalData: state.sinalData ?? b.sinalData,
          sinalForma: state.sinalForma ?? b.sinalForma,
          faltaValor: state.faltaValor,
          faltaVencimento: state.faltaVencimento ?? b.faltaVencimento,
        }));
      });
    }

    // Pacote: descobre de antemão se esta é a última consulta ligada a ele e, se for, se apagá-la
    // vai disparar o cascade que cancela pagamentos JÁ recebidos (ver getPackageDeletionImpact).
    setPackageDeletionImpact(null);
    if (appointment?.patient_billing_id) {
      getPackageDeletionImpact(appointment.id, appointment.patient_billing_id).then(setPackageDeletionImpact);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Contexto clínico segue a seleção de paciente — carrega de novo sempre que ela muda.
  useEffect(() => {
    if (!open || !selectedPatient) {
      setContext(null);
      return;
    }
    let cancelled = false;
    getPatientAgendaContext(selectedPatient.id, timeZone, { excludeAppointmentId: appointment?.id }).then((data) => {
      if (cancelled) return;
      setContext(data);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedPatient?.id, timeZone]);

  /** null = nenhum status escolhido ainda (handleSubmit barra o envio antes de chegar aqui). undefined = status escolhido mas faltam campos obrigatórios dele. */
  function buildBillingPayload(): AppointmentBillingInput | null | undefined {
    switch (billing.status) {
      case "":
        return null;
      case "gratuito":
        return { status: "gratuito" };
      case "nao_pago":
        if (!billing.naoPagoValor || !billing.naoPagoVencimento) return undefined;
        return { status: "nao_pago", valor: billing.naoPagoValor, vencimento: billing.naoPagoVencimento };
      case "pagou_integral":
        if (!billing.integralValor || !billing.integralData) return undefined;
        return {
          status: "pagou_integral",
          valor: billing.integralValor,
          data: billing.integralData,
          forma_pagamento: billing.integralForma,
        };
      case "pagou_sinal":
        if (!billing.sinalValor || !billing.sinalData || !billing.faltaValor || !billing.faltaVencimento) return undefined;
        return {
          status: "pagou_sinal",
          valorSinal: billing.sinalValor,
          dataSinal: billing.sinalData,
          formaSinal: billing.sinalForma,
          valorFalta: billing.faltaValor,
          vencimentoFalta: billing.faltaVencimento,
        };
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const tipo = form.tipo;
    if (!selectedPatient) {
      setPatientError("Selecione um paciente.");
      return;
    }
    if (!tipo) {
      toast.error("Selecione o tipo de consulta.");
      return;
    }

    const duracaoMin = timeStrToMinutes(form.horaFim) - timeStrToMinutes(form.horaInicio);
    if (duracaoMin <= 0) {
      setHorarioError("O horário de término deve ser depois do início.");
      return;
    }
    setHorarioError(null);

    // Consulta de pacote: o financeiro é gerenciado pelo pacote (ver "Novo pacote"), não aqui.
    if (!belongsToPackage && !billing.status) {
      toast.error("Selecione o status financeiro.");
      return;
    }

    const billingPayload = belongsToPackage ? null : buildBillingPayload();
    if (billingPayload === undefined) {
      toast.error("Preencha os campos do status financeiro.");
      return;
    }

    const payload = {
      patient_id: selectedPatient.id,
      data_hora_local: `${form.data}T${form.horaInicio}`,
      duracao_min: duracaoMin,
      tipo,
      status: isEditing ? form.status : undefined,
      observacoes: form.observacoes,
    };

    startTransition(async () => {
      const result: { success: boolean; message?: string; id?: string } = isEditing
        ? await updateAppointment(appointment!.id, payload)
        : await createAppointment(payload);

      if (!result.success) {
        toast.error(`Não foi possível ${isEditing ? "atualizar" : "agendar"} a consulta`, {
          description: result.message,
        });
        return;
      }

      const appointmentId = isEditing ? appointment!.id : result.id;
      if (billingPayload && appointmentId) {
        const billingResult = await setAppointmentBillingStatus(appointmentId, selectedPatient.id, billingPayload);
        if (!billingResult.success) {
          toast.error("Consulta salva, mas não foi possível salvar o status financeiro", {
            description: billingResult.message,
          });
          onOpenChange(false);
          return;
        }
      }

      toast.success(result.message ?? "Consulta salva.");
      onOpenChange(false);
    });
  }

  /**
   * Avulsa: já tem alguma parte paga. Pacote: esta é a última consulta ligada a ele E o pacote
   * tem algo pago — nos dois casos, excluir sem perguntar apagaria dinheiro já recebido.
   */
  const hasPaidPayment = belongsToPackage
    ? Boolean(packageDeletionImpact?.isLastAppointment && packageDeletionImpact.paidValue)
    : billing.status === "pagou_integral" || billing.status === "pagou_sinal";
  const paidValue = belongsToPackage
    ? (packageDeletionImpact?.paidValue ?? undefined)
    : billing.status === "pagou_integral"
      ? billing.integralValor
      : billing.sinalValor;

  function handleDeleteClick() {
    if (!appointment) return;
    if (hasPaidPayment) {
      setDeleteConfirmOpen(true);
      return;
    }
    handleDelete();
  }

  function handleDelete(keepBilling = false) {
    if (!appointment) return;
    startTransition(async () => {
      const result = await deleteAppointment(appointment.id, keepBilling ? { keepBilling: true } : undefined);
      if (!result.success) {
        toast.error("Não foi possível excluir a consulta", { description: result.message });
        return;
      }
      toast.success(
        keepBilling ? "Consulta excluída. O pagamento continua registrado no Financeiro." : "Consulta excluída."
      );
      setDeleteConfirmOpen(false);
      onOpenChange(false);
    });
  }

  function handleMarkRealizado() {
    if (!appointment) return;
    startTransition(async () => {
      const result = await updateAppointmentStatus(appointment.id, "realizado");
      if (!result.success) {
        toast.error("Não foi possível marcar como realizado", { description: result.message });
        return;
      }
      toast.success("Consulta marcada como realizada.");
      onOpenChange(false);
    });
  }

  function buildWhatsAppHref() {
    if (!appointment) return "#";
    const nome = selectedPatient?.nome ?? appointment.patients?.nome ?? "";
    const telefone = context?.patientTelefone ?? null;
    const { dateStr, timeStr } = utcInstantToZonedDateTime(appointment.data_hora, timeZone);
    const mensagem = buildAppointmentReminderMessage(nome, formatDate(dateStr), timeStr);
    return buildWhatsAppUrl(telefone, mensagem);
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar consulta" : "Nova consulta"}</DialogTitle>
          <DialogDescription>
            Horário exibido no seu fuso ({timeZone.replace("_", " ")}).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label id={pacienteLabelId}>Paciente *</Label>
            <PatientCombobox
              value={selectedPatient}
              onChange={(patient) => {
                setSelectedPatient(patient);
                setPatientError(null);
              }}
              disabled={isPending}
              ariaLabelledBy={pacienteLabelId}
              ariaRequired
            />
            {patientError && <p className="text-xs text-destructive" role="alert">{patientError}</p>}
          </div>

          {isEditing && appointment && (
            <div className="flex flex-wrap gap-2">
              {appointment.status !== "realizado" && (
                <Button type="button" variant="outline" size="sm" onClick={handleMarkRealizado} disabled={isPending}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Marcar como realizado
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" asChild>
                <a href={buildWhatsAppHref()} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-3.5 w-3.5" />
                  Lembrete WhatsApp
                </a>
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Coluna esquerda: dados da consulta */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="data">Data *</Label>
                <Input
                  id="data"
                  type="date"
                  value={form.data}
                  onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
                  required
                  disabled={isPending}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="hora_inicio">Início *</Label>
                  <Input
                    id="hora_inicio"
                    type="time"
                    step={900}
                    value={form.horaInicio}
                    onChange={(e) => {
                      const horaInicio = e.target.value;
                      setForm((f) =>
                        timeStrToMinutes(f.horaFim) <= timeStrToMinutes(horaInicio)
                          ? { ...f, horaInicio, horaFim: addMinutesToTimeStr(horaInicio, DEFAULT_DURACAO_MIN) }
                          : { ...f, horaInicio }
                      );
                      setHorarioError(null);
                    }}
                    required
                    disabled={isPending}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hora_fim">Término *</Label>
                  <Input
                    id="hora_fim"
                    type="time"
                    step={900}
                    value={form.horaFim}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, horaFim: e.target.value }));
                      setHorarioError(null);
                    }}
                    required
                    disabled={isPending}
                  />
                </div>
              </div>
              {horarioError && <p className="text-xs text-destructive" role="alert">{horarioError}</p>}

              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo *</Label>
                <Select
                  value={form.tipo}
                  onValueChange={(v) => setForm((f) => ({ ...f, tipo: v as AppointmentTipo }))}
                  disabled={isPending}
                >
                  <SelectTrigger id="tipo" aria-required="true">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {APPOINTMENT_TIPOS.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>
                        {APPOINTMENT_TIPO_LABELS[tipo]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isEditing && (
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm((f) => ({ ...f, status: v as AppointmentStatus }))}
                    disabled={isPending}
                  >
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {APPOINTMENT_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {APPOINTMENT_STATUS_META[status].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Coluna direita: status financeiro */}
            <div className="space-y-4 sm:border-l sm:border-border sm:pl-6">
              {belongsToPackage ? (
                <div className="space-y-1 rounded-md border border-accent/40 bg-accent/10 p-3">
                  <p className="text-sm font-medium text-foreground">Faz parte de um pacote</p>
                  <p className="text-xs text-muted-foreground">
                    O status financeiro desta consulta é controlado pelo pacote, não por aqui. Pra ver ou
                    alterar o pagamento, use a aba Financeiro do paciente.
                  </p>
                </div>
              ) : !selectedPatient ? (
                <p className="text-sm text-muted-foreground">
                  Selecione um paciente para definir o status financeiro.
                </p>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="status_financeiro">Status financeiro *</Label>
                    <Select
                      value={billing.status}
                      onValueChange={(v) => setBilling((b) => ({ ...b, status: v as AppointmentFinancialStatus }))}
                      disabled={isPending}
                    >
                      <SelectTrigger id="status_financeiro">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(FINANCIAL_STATUS_LABELS) as AppointmentFinancialStatus[]).map((status) => (
                          <SelectItem key={status} value={status}>
                            {FINANCIAL_STATUS_LABELS[status]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {billing.status === "nao_pago" && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="nao_pago_valor">Valor da consulta *</Label>
                        <CurrencyInput
                          id="nao_pago_valor"
                          value={billing.naoPagoValor}
                          onChange={(v) => setBilling((b) => ({ ...b, naoPagoValor: v }))}
                          disabled={isPending}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="nao_pago_vencimento">Vencimento</Label>
                        <Input
                          id="nao_pago_vencimento"
                          type="date"
                          value={billing.naoPagoVencimento}
                          onChange={(e) => setBilling((b) => ({ ...b, naoPagoVencimento: e.target.value }))}
                          disabled={isPending}
                        />
                      </div>
                    </div>
                  )}

                  {billing.status === "pagou_integral" && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="integral_valor">Valor pago *</Label>
                        <CurrencyInput
                          id="integral_valor"
                          value={billing.integralValor}
                          onChange={(v) => setBilling((b) => ({ ...b, integralValor: v }))}
                          disabled={isPending}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="integral_data">Data do pagamento</Label>
                        <Input
                          id="integral_data"
                          type="date"
                          value={billing.integralData}
                          onChange={(e) => setBilling((b) => ({ ...b, integralData: e.target.value }))}
                          disabled={isPending}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label id={formaPagamentoIntegralLabelId}>Forma de pagamento</Label>
                        <Select
                          value={billing.integralForma}
                          onValueChange={(v) => setBilling((b) => ({ ...b, integralForma: v as FormaPagamento }))}
                          disabled={isPending}
                        >
                          <SelectTrigger aria-labelledby={formaPagamentoIntegralLabelId}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FORMAS_PAGAMENTO.map((forma) => (
                              <SelectItem key={forma} value={forma}>
                                {FORMA_PAGAMENTO_LABELS[forma]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {billing.status === "pagou_sinal" && (
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="sinal_valor">Valor do sinal *</Label>
                          <CurrencyInput
                            id="sinal_valor"
                            value={billing.sinalValor}
                            onChange={(v) => setBilling((b) => ({ ...b, sinalValor: v }))}
                            disabled={isPending}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="sinal_data">Data do sinal</Label>
                          <Input
                            id="sinal_data"
                            type="date"
                            value={billing.sinalData}
                            onChange={(e) => setBilling((b) => ({ ...b, sinalData: e.target.value }))}
                            disabled={isPending}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label id={formaPagamentoSinalLabelId}>Forma de pagamento do sinal</Label>
                          <Select
                            value={billing.sinalForma}
                            onValueChange={(v) => setBilling((b) => ({ ...b, sinalForma: v as FormaPagamento }))}
                            disabled={isPending}
                          >
                            <SelectTrigger aria-labelledby={formaPagamentoSinalLabelId}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FORMAS_PAGAMENTO.map((forma) => (
                                <SelectItem key={forma} value={forma}>
                                  {FORMA_PAGAMENTO_LABELS[forma]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-3 border-t border-border pt-4">
                        <div className="space-y-2">
                          <Label htmlFor="falta_valor">Quanto falta *</Label>
                          <CurrencyInput
                            id="falta_valor"
                            value={billing.faltaValor}
                            onChange={(v) => setBilling((b) => ({ ...b, faltaValor: v }))}
                            disabled={isPending}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="falta_vencimento">Vencimento do restante</Label>
                          <Input
                            id="falta_vencimento"
                            type="date"
                            value={billing.faltaVencimento}
                            onChange={(e) => setBilling((b) => ({ ...b, faltaVencimento: e.target.value }))}
                            disabled={isPending}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              rows={2}
              value={form.observacoes}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
              disabled={isPending}
            />
          </div>

          <DialogFooter className="sm:justify-between">
            {isEditing ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={handleDeleteClick}
                disabled={isPending}
              >
                <Trash2 className="h-4 w-4" />
                Excluir
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? "Salvar alterações" : "Agendar consulta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir consulta já paga</AlertDialogTitle>
          <AlertDialogDescription>
            {belongsToPackage ? (
              <>
                Esta é a última consulta ligada a este pacote, que tem{" "}
                {paidValue !== undefined ? <strong>{formatCurrencyBRL(paidValue)}</strong> : "um valor"} já
                registrado como pago. Excluir a consulta da Agenda não precisa apagar esse pagamento — o que
                você prefere?
              </>
            ) : (
              <>
                Esta consulta tem{" "}
                {paidValue !== undefined ? <strong>{formatCurrencyBRL(paidValue)}</strong> : "um valor"} já
                registrado como pago. Excluir a consulta da Agenda não precisa apagar esse pagamento — o que
                você prefere?
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          <Button
            className="w-full justify-center"
            variant="outline"
            disabled={isPending}
            onClick={() => handleDelete(true)}
          >
            Manter o pagamento e excluir só a consulta
          </Button>
          <Button
            className="w-full justify-center"
            variant="destructive"
            disabled={isPending}
            onClick={() => handleDelete(false)}
          >
            Excluir consulta e pagamento juntos
          </Button>
          <AlertDialogCancel disabled={isPending} className="mt-1 w-full sm:w-full">
            Cancelar
          </AlertDialogCancel>
        </div>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
