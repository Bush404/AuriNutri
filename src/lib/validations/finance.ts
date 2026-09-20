import { z } from "zod";

/** Converte string vazia/undefined em undefined antes da validação de texto opcional. */
const optionalText = () =>
  z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" || v === undefined ? undefined : v));

export const EXPENSE_RECORRENCIAS = ["unica", "mensal", "trimestral", "semestral", "anual"] as const;
export const EXPENSE_RECORRENCIAS_COM_MES: ReadonlyArray<(typeof EXPENSE_RECORRENCIAS)[number]> = [
  "trimestral",
  "semestral",
  "anual",
];
export const EXPENSE_PARCELAMENTOS = ["avista", "parcelado"] as const;
export const PATIENT_BILLING_TIPOS = ["avulso", "pacote"] as const;
export const FORMAS_PAGAMENTO = ["pix", "dinheiro", "cartao", "transferencia", "outro"] as const;

function precisaDeMesVencimento(recorrencia: (typeof EXPENSE_RECORRENCIAS)[number]): boolean {
  return EXPENSE_RECORRENCIAS_COM_MES.includes(recorrencia);
}

export const expenseSchema = z
  .object({
    descricao: z.string().min(2, "Informe a descrição da despesa"),
    categoria: z.string().min(2, "Informe a categoria"),
    valor: z.coerce.number({ invalid_type_error: "Informe o valor" }).positive("Valor deve ser maior que zero"),
    recorrencia: z.enum(EXPENSE_RECORRENCIAS, {
      errorMap: () => ({ message: "Selecione a recorrência" }),
    }),
    /** Só usado quando recorrencia <> 'unica'. */
    dia_vencimento: z.coerce
      .number()
      .int()
      .min(1, "Dia deve ser entre 1 e 31")
      .max(31, "Dia deve ser entre 1 e 31")
      .optional(),
    /** Só usado quando recorrencia é trimestral/semestral/anual. */
    mes_vencimento: z.coerce.number().int().min(1, "Selecione o mês").max(12, "Selecione o mês").optional(),
    /** Só usado quando recorrencia = 'unica'. */
    data_vencimento: optionalText(),
    /** Etiqueta informativa, só para trimestral/semestral/anual — opcional, não muda cálculo nenhum. */
    parcelamento: z.enum(EXPENSE_PARCELAMENTOS).optional(),
    ativa: z.boolean().optional(),
  })
  .refine((data) => data.recorrencia === "unica" || data.dia_vencimento !== undefined, {
    message: "Informe o dia de vencimento",
    path: ["dia_vencimento"],
  })
  .refine((data) => !precisaDeMesVencimento(data.recorrencia) || data.mes_vencimento !== undefined, {
    message: "Selecione o mês de vencimento",
    path: ["mes_vencimento"],
  })
  .refine((data) => data.recorrencia !== "unica" || !!data.data_vencimento, {
    message: "Informe a data de vencimento",
    path: ["data_vencimento"],
  });
export type ExpenseInput = z.infer<typeof expenseSchema>;

export const patientBillingSchema = z
  .object({
    patient_id: z.string().uuid("Selecione um paciente"),
    tipo: z.enum(PATIENT_BILLING_TIPOS, { errorMap: () => ({ message: "Selecione o tipo de cobrança" }) }),
    descricao: z.string().min(2, "Informe a descrição da cobrança"),
    valor_total: z.coerce
      .number({ invalid_type_error: "Informe o valor total" })
      .positive("Valor total deve ser maior que zero"),
    /** Só para tipo = 'pacote'. */
    numero_consultas: z.coerce.number().int().positive("Número de consultas deve ser maior que zero").optional(),
    /** Só para tipo = 'pacote' — em quantas parcelas dividir o valor total. Padrão: 1 (à vista). */
    numero_parcelas: z.coerce.number().int().positive("Número de parcelas deve ser maior que zero").optional(),
    data_inicio: z.string().min(1, "Informe a data de início"),
  })
  .refine((data) => data.tipo !== "pacote" || data.numero_consultas !== undefined, {
    message: "Informe o número de consultas do pacote",
    path: ["numero_consultas"],
  });
export type PatientBillingInput = z.infer<typeof patientBillingSchema>;

export const paymentSchema = z.object({
  valor: z.coerce.number({ invalid_type_error: "Informe o valor" }).positive("Valor deve ser maior que zero"),
  data_vencimento: z.string().min(1, "Informe a data de vencimento"),
  observacoes: optionalText(),
});
export type PaymentInput = z.infer<typeof paymentSchema>;

/** Baixa de um pagamento — exige data + forma juntas (mesmo CHECK do banco). */
export const registerPaymentSchema = z.object({
  data_pagamento: z.string().min(1, "Informe a data de pagamento"),
  forma_pagamento: z.enum(FORMAS_PAGAMENTO, { errorMap: () => ({ message: "Selecione a forma de pagamento" }) }),
});
export type RegisterPaymentInput = z.infer<typeof registerPaymentSchema>;

/** Baixa de uma ocorrência de despesa (expense_occurrences) — mesma forma de registerPaymentSchema. */
export const registerExpenseOccurrenceSchema = registerPaymentSchema;
export type RegisterExpenseOccurrenceInput = RegisterPaymentInput;
