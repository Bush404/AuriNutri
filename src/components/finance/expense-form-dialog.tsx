"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  expenseSchema,
  EXPENSE_RECORRENCIAS,
  EXPENSE_RECORRENCIAS_COM_MES,
  EXPENSE_PARCELAMENTOS,
  type ExpenseInput,
} from "@/lib/validations/finance";
import { createExpense, updateExpense } from "@/lib/actions/finance";
import type { Expense } from "@/lib/types/database.types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const RECORRENCIA_LABELS: Record<(typeof EXPENSE_RECORRENCIAS)[number], string> = {
  unica: "Única",
  mensal: "Mensal",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

const MESES_LABELS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const PARCELAMENTO_LABELS: Record<(typeof EXPENSE_PARCELAMENTOS)[number], string> = {
  avista: "À vista",
  parcelado: "Parcelado",
};

const CATEGORIAS_SUGERIDAS = [
  "Aluguel",
  "Água/Luz/Internet",
  "Softwares/assinaturas",
  "Materiais",
  "Marketing",
  "Impostos/taxas",
  "Outros",
];

const EMPTY_VALUES: ExpenseInput = {
  descricao: "",
  categoria: "",
  valor: 0,
  recorrencia: "mensal",
  dia_vencimento: 5,
  mes_vencimento: undefined,
  data_vencimento: undefined,
  parcelamento: undefined,
  ativa: true,
};

function buildDefaults(expense?: Expense): ExpenseInput {
  if (!expense) return EMPTY_VALUES;
  return {
    descricao: expense.descricao,
    categoria: expense.categoria,
    valor: expense.valor,
    recorrencia: expense.recorrencia,
    dia_vencimento: expense.dia_vencimento ?? undefined,
    mes_vencimento: expense.mes_vencimento ?? undefined,
    data_vencimento: expense.data_vencimento ?? undefined,
    parcelamento: expense.parcelamento ?? undefined,
    ativa: expense.ativa,
  };
}

interface ExpenseFormDialogProps {
  /** Presente = editar esta despesa. Ausente = criar uma nova. */
  expense?: Expense;
  /** Gatilho customizado (ex.: ícone de editar numa linha da tabela). Padrão: botão "Nova despesa". */
  trigger?: React.ReactNode;
}

export function ExpenseFormDialog({ expense, trigger }: ExpenseFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEditing = Boolean(expense);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<ExpenseInput>({
    resolver: zodResolver(expenseSchema),
    defaultValues: buildDefaults(expense),
  });

  const recorrencia = watch("recorrencia");
  const isUnica = recorrencia === "unica";
  const precisaDeMes = EXPENSE_RECORRENCIAS_COM_MES.includes(recorrencia);

  useEffect(() => {
    if (open) reset(buildDefaults(expense));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onSubmit(values: ExpenseInput) {
    setLoading(true);
    const result = isEditing ? await updateExpense(expense!.id, values) : await createExpense(values);
    setLoading(false);

    if (!result.success) {
      toast.error(`Não foi possível ${isEditing ? "atualizar" : "cadastrar"} a despesa`, {
        description: result.message,
      });
      return;
    }

    toast.success(result.message ?? "Despesa salva.");
    if (!isEditing) reset(EMPTY_VALUES);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="h-4 w-4" />
            Nova despesa
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar despesa" : "Nova despesa"}</DialogTitle>
          <DialogDescription>
            Cadastre um custo fixo ou pontual do consultório para entrar no cálculo de custo por
            atendimento.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Recorrência *</Label>
            <Controller
              control={control}
              name="recorrencia"
              render={({ field }) => (
                <Tabs value={field.value} onValueChange={field.onChange}>
                  <TabsList className="grid w-full grid-cols-5">
                    {EXPENSE_RECORRENCIAS.map((valor) => (
                      <TabsTrigger key={valor} value={valor} className="text-xs sm:text-sm">
                        {RECORRENCIA_LABELS[valor]}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              )}
            />
            {errors.recorrencia && <p className="text-xs text-destructive">{errors.recorrencia.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição *</Label>
            <Input id="descricao" placeholder="Ex: Aluguel da sala" {...register("descricao")} />
            {errors.descricao && <p className="text-xs text-destructive">{errors.descricao.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria *</Label>
              <Input
                id="categoria"
                list="categorias-sugeridas"
                placeholder="Ex: Aluguel"
                {...register("categoria")}
              />
              <datalist id="categorias-sugeridas">
                {CATEGORIAS_SUGERIDAS.map((categoria) => (
                  <option key={categoria} value={categoria} />
                ))}
              </datalist>
              {errors.categoria && <p className="text-xs text-destructive">{errors.categoria.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="valor">Valor *</Label>
              <Controller
                control={control}
                name="valor"
                render={({ field }) => (
                  <CurrencyInput id="valor" value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
                )}
              />
              {errors.valor && <p className="text-xs text-destructive">{errors.valor.message}</p>}
            </div>
          </div>

          {isUnica && (
            <div className="space-y-2">
              <Label htmlFor="data_vencimento">Data de vencimento *</Label>
              <Input id="data_vencimento" type="date" {...register("data_vencimento")} />
              {errors.data_vencimento && (
                <p className="text-xs text-destructive">{errors.data_vencimento.message}</p>
              )}
            </div>
          )}

          {!isUnica && (
            <div className="grid grid-cols-2 gap-4">
              {precisaDeMes && (
                <div className="space-y-2">
                  <Label>Mês do vencimento *</Label>
                  <Controller
                    control={control}
                    name="mes_vencimento"
                    render={({ field }) => (
                      <Select
                        value={field.value ? String(field.value) : undefined}
                        onValueChange={(v) => field.onChange(Number(v))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {MESES_LABELS.map((label, index) => (
                            <SelectItem key={label} value={String(index + 1)}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.mes_vencimento && (
                    <p className="text-xs text-destructive">{errors.mes_vencimento.message}</p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="dia_vencimento">Dia do vencimento *</Label>
                <Input id="dia_vencimento" type="number" min="1" max="31" {...register("dia_vencimento")} />
                {errors.dia_vencimento && (
                  <p className="text-xs text-destructive">{errors.dia_vencimento.message}</p>
                )}
              </div>
            </div>
          )}

          {precisaDeMes && (
            <div className="space-y-2">
              <Label>Como você paga essa despesa? (opcional)</Label>
              <Controller
                control={control}
                name="parcelamento"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Não informado" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_PARCELAMENTOS.map((valor) => (
                        <SelectItem key={valor} value={valor}>
                          {PARCELAMENTO_LABELS[valor]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-xs text-muted-foreground">
                Só uma etiqueta pra você lembrar — não muda o valor nem a data de vencimento acima.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? "Salvar alterações" : "Salvar despesa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
