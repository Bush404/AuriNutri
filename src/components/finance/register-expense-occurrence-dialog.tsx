"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleDollarSign, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  registerExpenseOccurrenceSchema,
  FORMAS_PAGAMENTO,
  FORMA_PAGAMENTO_LABELS,
  type RegisterExpenseOccurrenceInput,
} from "@/lib/validations/finance";
import { registerExpenseOccurrencePayment } from "@/lib/actions/finance";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface RegisterExpenseOccurrenceDialogProps {
  occurrenceId: string;
  descricaoDespesa: string;
}

export function RegisterExpenseOccurrenceDialog({
  occurrenceId,
  descricaoDespesa,
}: RegisterExpenseOccurrenceDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<RegisterExpenseOccurrenceInput>({
    resolver: zodResolver(registerExpenseOccurrenceSchema),
    defaultValues: { data_pagamento: new Date().toISOString().slice(0, 10), forma_pagamento: "pix" },
  });

  async function onSubmit(values: RegisterExpenseOccurrenceInput) {
    setLoading(true);
    const result = await registerExpenseOccurrencePayment(occurrenceId, values);
    setLoading(false);

    if (!result.success) {
      toast.error("Não foi possível registrar o pagamento", { description: result.message });
      return;
    }

    toast.success(result.message ?? "Pagamento registrado.");
    reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <CircleDollarSign className="h-4 w-4" />
          Marcar como pago
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
          <DialogDescription>{descricaoDespesa}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="data_pagamento">Data do pagamento *</Label>
            <Input id="data_pagamento" type="date" {...register("data_pagamento")} />
            {errors.data_pagamento && (
              <p className="text-xs text-destructive">{errors.data_pagamento.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Forma de pagamento *</Label>
            <Controller
              control={control}
              name="forma_pagamento"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMAS_PAGAMENTO.map((forma) => (
                      <SelectItem key={forma} value={forma}>
                        {FORMA_PAGAMENTO_LABELS[forma]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.forma_pagamento && (
              <p className="text-xs text-destructive">{errors.forma_pagamento.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar pagamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
