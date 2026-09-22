"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { AppointmentFinancialStatus, AppointmentTipo, FormaPagamento } from "@/lib/types/database.types";
import type { PatientPickerResult } from "@/lib/actions/patients";
import { createAppointment, deleteAppointment } from "@/lib/actions/appointments";
import { setPackageBillingStatus } from "@/lib/actions/finance";
import { FORMAS_PAGAMENTO, FORMA_PAGAMENTO_LABELS, type PackageBillingInput } from "@/lib/validations/finance";
import { APPOINTMENT_TIPOS, APPOINTMENT_TIPO_LABELS, addMinutesToTimeStr, timeStrToMinutes } from "@/lib/agenda";
import { formatDate } from "@/lib/utils";

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

const FINANCIAL_STATUS_LABELS: Record<AppointmentFinancialStatus, string> = {
  nao_pago: "Não pago",
  pagou_sinal: "Pagou sinal",
  pagou_integral: "Pagou integral",
  gratuito: "Gratuito",
};

const DEFAULT_DURACAO_MIN = 60;
const DEFAULT_NUMERO_CONSULTAS = 3;
const MAX_NUMERO_CONSULTAS = 50;

interface ConsultaRow {
  data: string;
  horaInicio: string;
  horaFim: string;
}

function buildRow(data: string, horaInicio = "08:00"): ConsultaRow {
  return { data, horaInicio, horaFim: addMinutesToTimeStr(horaInicio, DEFAULT_DURACAO_MIN) };
}

function addDaysToDateStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

interface BillingFormState {
  status: "" | AppointmentFinancialStatus;
  valorTotal?: number;
  integralData: string;
  integralForma: FormaPagamento;
  valorSinal?: number;
  sinalData: string;
  sinalForma: FormaPagamento;
  vencimentoFalta: string;
}

function buildInitialBilling(dataBase: string): BillingFormState {
  return {
    status: "",
    integralData: dataBase,
    integralForma: "pix",
    sinalData: dataBase,
    sinalForma: "pix",
    vencimentoFalta: dataBase,
  };
}

function buildInitialRows(dataBase: string): ConsultaRow[] {
  return Array.from({ length: DEFAULT_NUMERO_CONSULTAS }, (_, i) => buildRow(addDaysToDateStr(dataBase, i * 7)));
}

interface PackageFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timeZone: string;
  defaultDateStr?: string;
  defaultPatient?: PatientPickerResult | null;
}

/**
 * "Novo pacote" (Fase 9, Bloco E) — agenda N consultas de uma vez, com uma
 * cobrança de pacote em comum. Reaproveita createAppointment (uma chamada
 * por consulta, sequencial) pra herdar de graça a checagem de sobreposição
 * de horário já existente lá — nenhuma lógica de conflito duplicada aqui.
 * Se qualquer etapa falhar no meio do caminho, desfaz (soft delete) tudo que
 * já tinha sido criado, pra nunca deixar um pacote pela metade.
 */
export function PackageFormDialog({
  open,
  onOpenChange,
  timeZone,
  defaultDateStr,
  defaultPatient,
}: PackageFormDialogProps) {
  const baseDate = defaultDateStr ?? new Date().toISOString().slice(0, 10);
  const pacienteLabelId = useId();
  const formaPagamentoIntegralLabelId = useId();
  const formaPagamentoSinalLabelId = useId();
  const consultasDoPacoteLabelId = useId();

  const [selectedPatient, setSelectedPatient] = useState<PatientPickerResult | null>(defaultPatient ?? null);
  const [patientError, setPatientError] = useState<string | null>(null);
  const [tipo, setTipo] = useState<AppointmentTipo | "">("");
  const [observacoes, setObservacoes] = useState("");
  const [numeroConsultas, setNumeroConsultas] = useState(DEFAULT_NUMERO_CONSULTAS);
  const [rows, setRows] = useState<ConsultaRow[]>(() => buildInitialRows(baseDate));
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [billing, setBilling] = useState<BillingFormState>(() => buildInitialBilling(baseDate));
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setSelectedPatient(defaultPatient ?? null);
    setPatientError(null);
    setTipo("");
    setObservacoes("");
    setNumeroConsultas(DEFAULT_NUMERO_CONSULTAS);
    setRows(buildInitialRows(baseDate));
    setRowErrors({});
    setBilling(buildInitialBilling(baseDate));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleNumeroConsultasChange(value: string) {
    const n = Math.max(1, Math.min(MAX_NUMERO_CONSULTAS, Number(value) || 1));
    setNumeroConsultas(n);
    setRows((prev) => {
      if (n <= prev.length) return prev.slice(0, n);
      const next = [...prev];
      while (next.length < n) {
        const last = next[next.length - 1];
        next.push(buildRow(last ? addDaysToDateStr(last.data, 7) : baseDate, last?.horaInicio));
      }
      return next;
    });
  }

  function updateRow(index: number, patch: Partial<ConsultaRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    setRowErrors((prev) => ({ ...prev, [index]: "" }));
  }

  /** null = nenhum status escolhido ainda. undefined = status escolhido mas faltam campos (ou sinal >= total). */
  function buildBillingPayload(): PackageBillingInput | null | undefined {
    switch (billing.status) {
      case "":
        return null;
      case "gratuito":
        return { status: "gratuito" };
      case "nao_pago":
        if (!billing.valorTotal) return undefined;
        return { status: "nao_pago", valorTotal: billing.valorTotal };
      case "pagou_integral":
        if (!billing.valorTotal || !billing.integralData) return undefined;
        return {
          status: "pagou_integral",
          valorTotal: billing.valorTotal,
          data: billing.integralData,
          forma_pagamento: billing.integralForma,
        };
      case "pagou_sinal":
        if (!billing.valorTotal || !billing.valorSinal || !billing.sinalData || !billing.vencimentoFalta)
          return undefined;
        if (billing.valorSinal >= billing.valorTotal) return undefined;
        return {
          status: "pagou_sinal",
          valorTotal: billing.valorTotal,
          valorSinal: billing.valorSinal,
          dataSinal: billing.sinalData,
          formaSinal: billing.sinalForma,
          vencimentoFalta: billing.vencimentoFalta,
        };
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedPatient) {
      setPatientError("Selecione um paciente.");
      return;
    }
    if (!tipo) {
      toast.error("Selecione o tipo de consulta.");
      return;
    }

    const errors: Record<number, string> = {};
    rows.forEach((row, i) => {
      if (timeStrToMinutes(row.horaFim) - timeStrToMinutes(row.horaInicio) <= 0) {
        errors[i] = "O término deve ser depois do início.";
      }
    });
    if (Object.keys(errors).length > 0) {
      setRowErrors(errors);
      toast.error("Corrija os horários das consultas destacadas.");
      return;
    }
    setRowErrors({});

    if (!billing.status) {
      toast.error("Selecione o status financeiro.");
      return;
    }
    const billingPayload = buildBillingPayload();
    if (!billingPayload) {
      toast.error(
        billing.status === "pagou_sinal"
          ? "Preencha os campos do status financeiro (o sinal deve ser menor que o valor total)."
          : "Preencha os campos do status financeiro."
      );
      return;
    }

    startTransition(async () => {
      const createdIds: string[] = [];

      for (const row of rows) {
        const result = await createAppointment({
          patient_id: selectedPatient.id,
          data_hora_local: `${row.data}T${row.horaInicio}`,
          duracao_min: timeStrToMinutes(row.horaFim) - timeStrToMinutes(row.horaInicio),
          tipo,
          observacoes,
        });

        if (!result.success || !result.id) {
          toast.error("Não foi possível agendar o pacote", {
            description: `Consulta de ${row.data}: ${result.message}`,
          });
          for (const id of createdIds) await deleteAppointment(id);
          return;
        }
        createdIds.push(result.id);
      }

      const billingResult = await setPackageBillingStatus(
        createdIds,
        rows.map((r) => r.data),
        selectedPatient.id,
        billingPayload
      );

      if (!billingResult.success) {
        toast.error("Não foi possível salvar o status financeiro do pacote", {
          description: billingResult.message,
        });
        for (const id of createdIds) await deleteAppointment(id);
        return;
      }

      toast.success(`Pacote de ${createdIds.length} consultas agendado.`);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo pacote</DialogTitle>
          <DialogDescription>
            Agenda várias consultas de uma vez, com uma cobrança de pacote em comum. Horário exibido no
            seu fuso ({timeZone.replace("_", " ")}).
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
              ariaLabelledBy={pacienteLabelId}
              disabled={isPending}
              ariaRequired
            />
            {patientError && <p className="text-xs text-destructive" role="alert">{patientError}</p>}
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Coluna esquerda: dados do pacote */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo *</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as AppointmentTipo)} disabled={isPending}>
                  <SelectTrigger id="tipo" aria-required="true">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {APPOINTMENT_TIPOS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {APPOINTMENT_TIPO_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="numero_consultas">Número de consultas *</Label>
                <Input
                  id="numero_consultas"
                  type="number"
                  min="1"
                  max={MAX_NUMERO_CONSULTAS}
                  value={numeroConsultas}
                  onChange={(e) => handleNumeroConsultasChange(e.target.value)}
                  disabled={isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  rows={2}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  disabled={isPending}
                />
              </div>
            </div>

            {/* Coluna direita: status financeiro do pacote */}
            <div className="space-y-4 sm:border-l sm:border-border sm:pl-6">
              {!selectedPatient ? (
                <p className="text-sm text-muted-foreground">
                  Selecione um paciente para definir o status financeiro.
                </p>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="pkg_status_financeiro">Status financeiro *</Label>
                    <Select
                      value={billing.status}
                      onValueChange={(v) => setBilling((b) => ({ ...b, status: v as AppointmentFinancialStatus }))}
                      disabled={isPending}
                    >
                      <SelectTrigger id="pkg_status_financeiro">
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
                    <div className="space-y-2">
                      <Label htmlFor="pkg_valor_total">Valor total do pacote *</Label>
                      <CurrencyInput
                        id="pkg_valor_total"
                        value={billing.valorTotal}
                        onChange={(v) => setBilling((b) => ({ ...b, valorTotal: v }))}
                        disabled={isPending}
                      />
                      <p className="text-xs text-muted-foreground">
                        Gera uma única cobrança pendente para o pacote inteiro, vencendo na data da
                        1ª consulta ({rows[0] ? formatDate(rows[0].data) : "—"}).
                      </p>
                    </div>
                  )}

                  {billing.status === "pagou_integral" && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="pkg_valor_total_integral">Valor total do pacote *</Label>
                        <CurrencyInput
                          id="pkg_valor_total_integral"
                          value={billing.valorTotal}
                          onChange={(v) => setBilling((b) => ({ ...b, valorTotal: v }))}
                          disabled={isPending}
                        />
                        <p className="text-xs text-muted-foreground">
                          Gera uma única cobrança já paga para o pacote inteiro (o paciente pagou tudo
                          de uma vez no ato de agendar).
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pkg_integral_data">Data do pagamento</Label>
                        <Input
                          id="pkg_integral_data"
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
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="pkg_valor_total_sinal">Valor total do pacote *</Label>
                        <CurrencyInput
                          id="pkg_valor_total_sinal"
                          value={billing.valorTotal}
                          onChange={(v) => setBilling((b) => ({ ...b, valorTotal: v }))}
                          disabled={isPending}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pkg_valor_sinal">Valor do sinal *</Label>
                        <CurrencyInput
                          id="pkg_valor_sinal"
                          value={billing.valorSinal}
                          onChange={(v) => setBilling((b) => ({ ...b, valorSinal: v }))}
                          disabled={isPending}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pkg_sinal_data">Data do sinal</Label>
                        <Input
                          id="pkg_sinal_data"
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
                      <div className="space-y-2">
                        <Label htmlFor="pkg_vencimento_falta">Vencimento do restante *</Label>
                        <Input
                          id="pkg_vencimento_falta"
                          type="date"
                          value={billing.vencimentoFalta}
                          onChange={(e) => setBilling((b) => ({ ...b, vencimentoFalta: e.target.value }))}
                          disabled={isPending}
                        />
                        <p className="text-xs text-muted-foreground">
                          O restante (valor total − sinal) vira uma única cobrança pendente, vencendo
                          nesta data — não amarrada a nenhuma consulta específica.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {/* Cabeçalho de seção, não label de um único controle — cada input da lista abaixo já tem seu próprio Label/htmlFor. */}
            <p className="text-sm font-medium leading-none text-foreground">Consultas do pacote *</p>
            <div className="space-y-3">
              {rows.map((row, index) => (
                <div key={index} className="rounded-md border border-border p-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Consulta {index + 1}
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label htmlFor={`data_${index}`} className="text-xs">
                        Data
                      </Label>
                      <Input
                        id={`data_${index}`}
                        type="date"
                        value={row.data}
                        onChange={(e) => updateRow(index, { data: e.target.value })}
                        disabled={isPending}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`inicio_${index}`} className="text-xs">
                        Início
                      </Label>
                      <Input
                        id={`inicio_${index}`}
                        type="time"
                        step={900}
                        value={row.horaInicio}
                        onChange={(e) => updateRow(index, { horaInicio: e.target.value })}
                        disabled={isPending}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`fim_${index}`} className="text-xs">
                        Término
                      </Label>
                      <Input
                        id={`fim_${index}`}
                        type="time"
                        step={900}
                        value={row.horaFim}
                        onChange={(e) => updateRow(index, { horaFim: e.target.value })}
                        disabled={isPending}
                      />
                    </div>
                  </div>
                  {rowErrors[index] && <p className="mt-1 text-xs text-destructive" role="alert">{rowErrors[index]}</p>}
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Agendar pacote
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
