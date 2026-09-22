"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { paymentSchema, type PaymentInput } from "@/lib/validations/finance";
import { updatePayment } from "@/lib/actions/finance";
import type { Payment } from "@/lib/types/database.types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/shared/currency-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface EditPatientPaymentDialogProps {
  payment: Payment;
  descricaoCobranca: string;
  /** Controlado externamente (ex.: abrir direto após cancelar consultas de um pacote), sem o lápis de gatilho próprio. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Aviso extra abaixo da descrição (ex.: "ao salvar, N consulta(s) serão canceladas"). */
  warningNote?: string;
  /** Chamado só DEPOIS que o valor é salvo com sucesso — nunca antes, nunca se o profissional fechar sem salvar. */
  onSaved?: () => void;
}

export function EditPatientPaymentDialog({
  payment,
  descricaoCobranca,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  warningNote,
  onSaved,
}: EditPatientPaymentDialogProps) {
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? setControlledOpen! : setInternalOpen;
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<PaymentInput>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      valor: payment.valor,
      data_vencimento: payment.data_vencimento,
      observacoes: payment.observacoes ?? "",
    },
  });

  async function onSubmit(values: PaymentInput) {
    setLoading(true);
    const result = await updatePayment(payment.id, values);
    setLoading(false);

    if (!result.success) {
      toast.error("Não foi possível atualizar a cobrança", { description: result.message });
      return;
    }

    toast.success(result.message ?? "Cobrança atualizada.");
    setOpen(false);
    onSaved?.();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset({ valor: payment.valor, data_vencimento: payment.data_vencimento, observacoes: payment.observacoes ?? "" });
      }}
    >
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" title="Editar">
            <Pencil className="h-4 w-4" />
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar cobrança pendente</DialogTitle>
          <DialogDescription>{descricaoCobranca}</DialogDescription>
        </DialogHeader>

        {warningNote && (
          <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            {warningNote}
          </p>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="valor">Valor *</Label>
            <Controller
              control={control}
              name="valor"
              render={({ field }) => (
                <CurrencyInput id="valor" value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
              )}
            />
            {errors.valor && <p className="text-xs text-destructive" role="alert">{errors.valor.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="data_vencimento">Vencimento *</Label>
            <Input id="data_vencimento" type="date" {...register("data_vencimento")} />
            {errors.data_vencimento && (
              <p className="text-xs text-destructive" role="alert">{errors.data_vencimento.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Input id="observacoes" placeholder="Opcional" {...register("observacoes")} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
