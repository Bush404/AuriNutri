"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { patientBillingSchema, PATIENT_BILLING_TIPOS, type PatientBillingInput } from "@/lib/validations/finance";
import { createPatientBilling } from "@/lib/actions/finance";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const TIPO_LABELS: Record<(typeof PATIENT_BILLING_TIPOS)[number], string> = {
  avulso: "Avulso",
  pacote: "Pacote",
};

type FormaPagamentoPacote = "avista" | "parcelado";

const DEFAULT_VALUES: PatientBillingInput = {
  patient_id: "",
  tipo: "avulso",
  descricao: "Consulta",
  valor_total: 0,
  numero_consultas: undefined,
  numero_parcelas: undefined,
  data_inicio: new Date().toISOString().slice(0, 10),
};

export function NewPatientBillingDialog({ patientId }: { patientId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamentoPacote>("avista");

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<PatientBillingInput>({
    resolver: zodResolver(patientBillingSchema),
    defaultValues: { ...DEFAULT_VALUES, patient_id: patientId },
  });

  const tipo = watch("tipo");
  const isPacote = tipo === "pacote";

  useEffect(() => {
    if (open) {
      reset({ ...DEFAULT_VALUES, patient_id: patientId });
      setFormaPagamento("avista");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onSubmit(values: PatientBillingInput) {
    setLoading(true);
    const result = await createPatientBilling({
      ...values,
      numero_consultas: values.tipo === "pacote" ? values.numero_consultas : undefined,
      numero_parcelas: values.tipo === "pacote" && formaPagamento === "parcelado" ? values.numero_parcelas : undefined,
    });
    setLoading(false);

    if (!result.success) {
      toast.error("Não foi possível criar a cobrança", { description: result.message });
      return;
    }

    toast.success(result.message ?? "Cobrança criada.");
    reset({ ...DEFAULT_VALUES, patient_id: patientId });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          Nova cobrança
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova cobrança</DialogTitle>
          <DialogDescription>
            Avulso é uma cobrança única. Pacote cobre várias consultas, à vista ou parcelado.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo *</Label>
            <Controller
              control={control}
              name="tipo"
              render={({ field }) => (
                <Tabs value={field.value} onValueChange={field.onChange}>
                  <TabsList className="grid w-full grid-cols-2">
                    {PATIENT_BILLING_TIPOS.map((valor) => (
                      <TabsTrigger key={valor} value={valor}>
                        {TIPO_LABELS[valor]}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição *</Label>
            <Input
              id="descricao"
              placeholder={isPacote ? "Ex: Pacote 3 meses" : "Ex: Consulta"}
              {...register("descricao")}
            />
            {errors.descricao && <p className="text-xs text-destructive">{errors.descricao.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valor_total">Valor {isPacote ? "total" : ""} *</Label>
              <Controller
                control={control}
                name="valor_total"
                render={({ field }) => (
                  <CurrencyInput id="valor_total" value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
                )}
              />
              {errors.valor_total && <p className="text-xs text-destructive">{errors.valor_total.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="data_inicio">{isPacote ? "Data da 1ª parcela" : "Vencimento"} *</Label>
              <Input id="data_inicio" type="date" {...register("data_inicio")} />
              {errors.data_inicio && <p className="text-xs text-destructive">{errors.data_inicio.message}</p>}
            </div>
          </div>

          {isPacote && (
            <>
              <div className="space-y-2">
                <Label htmlFor="numero_consultas">Número de consultas do pacote *</Label>
                <Input id="numero_consultas" type="number" min="1" {...register("numero_consultas")} />
                {errors.numero_consultas && (
                  <p className="text-xs text-destructive">{errors.numero_consultas.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Como será pago? *</Label>
                <Tabs value={formaPagamento} onValueChange={(v) => setFormaPagamento(v as FormaPagamentoPacote)}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="avista">À vista</TabsTrigger>
                    <TabsTrigger value="parcelado">Parcelado</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {formaPagamento === "parcelado" && (
                <div className="space-y-2">
                  <Label htmlFor="numero_parcelas">Em quantas parcelas?</Label>
                  <Input id="numero_parcelas" type="number" min="2" {...register("numero_parcelas")} />
                  {errors.numero_parcelas && (
                    <p className="text-xs text-destructive">{errors.numero_parcelas.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Cada parcela vence um mês após a anterior, a partir da data acima.
                  </p>
                </div>
              )}
            </>
          )}

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar cobrança
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
