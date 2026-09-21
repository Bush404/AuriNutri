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
/** Centralizado aqui pra não reescrever em cada dialog que tem um Select de forma de pagamento. */
export const FORMA_PAGAMENTO_LABELS: Record<(typeof FORMAS_PAGAMENTO)[number], string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  transferencia: "Transferência",
  outro: "Outro",
};

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

/**
 * Status financeiro definido ao agendar/editar uma consulta (Fase 9, Bloco
 * D). Union discriminada por `status` porque cada opção pede campos
 * diferentes — "pagou sinal" precisa dos dois lançamentos (o sinal já pago
 * e o restante pendente) porque o valor do sinal entra em "Recebido" e o
 * restante em "Pendente", nos mesmos totais que a aba Financeiro já usa.
 */
export const appointmentBillingSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("gratuito") }),
  z.object({
    status: z.literal("nao_pago"),
    valor: z.coerce.number({ invalid_type_error: "Informe o valor" }).positive("Valor deve ser maior que zero"),
    vencimento: z.string().min(1, "Informe o vencimento"),
  }),
  z.object({
    status: z.literal("pagou_integral"),
    valor: z.coerce.number({ invalid_type_error: "Informe o valor" }).positive("Valor deve ser maior que zero"),
    data: z.string().min(1, "Informe a data do pagamento"),
    forma_pagamento: z.enum(FORMAS_PAGAMENTO, { errorMap: () => ({ message: "Selecione a forma de pagamento" }) }),
  }),
  z.object({
    status: z.literal("pagou_sinal"),
    valorSinal: z.coerce.number({ invalid_type_error: "Informe o valor do sinal" }).positive("Valor deve ser maior que zero"),
    dataSinal: z.string().min(1, "Informe a data do sinal"),
    formaSinal: z.enum(FORMAS_PAGAMENTO, { errorMap: () => ({ message: "Selecione a forma de pagamento" }) }),
    valorFalta: z.coerce.number({ invalid_type_error: "Informe quanto falta" }).positive("Valor deve ser maior que zero"),
    vencimentoFalta: z.string().min(1, "Informe o vencimento do restante"),
  }),
]);
export type AppointmentBillingInput = z.infer<typeof appointmentBillingSchema>;

/**
 * Status financeiro de um PACOTE (Fase 9, Bloco E — "Novo pacote" na
 * Agenda). Ajustado depois do primeiro uso real: pacote normalmente é pago
 * de uma vez (à vista/cartão no ato de agendar), então NÃO divide o valor
 * em uma parcela por consulta como na primeira versão — gera UMA cobrança
 * para o pacote inteiro, não uma por consulta (menos ruído em Pendentes na
 * aba Financeiro). "não pago" vence na data da primeira consulta; "pagou
 * integral" nasce paga na data informada; só "pagou sinal" continua com
 * dois lançamentos (sinal já pago + restante pendente), e o vencimento do
 * restante agora é UMA data só, digitada, não mais amarrada às consultas.
 */
const packageBillingUnion = z.discriminatedUnion("status", [
  z.object({ status: z.literal("gratuito") }),
  z.object({
    status: z.literal("nao_pago"),
    valorTotal: z.coerce
      .number({ invalid_type_error: "Informe o valor total do pacote" })
      .positive("Valor deve ser maior que zero"),
  }),
  z.object({
    status: z.literal("pagou_integral"),
    valorTotal: z.coerce
      .number({ invalid_type_error: "Informe o valor total do pacote" })
      .positive("Valor deve ser maior que zero"),
    data: z.string().min(1, "Informe a data do pagamento"),
    forma_pagamento: z.enum(FORMAS_PAGAMENTO, { errorMap: () => ({ message: "Selecione a forma de pagamento" }) }),
  }),
  z.object({
    status: z.literal("pagou_sinal"),
    valorTotal: z.coerce
      .number({ invalid_type_error: "Informe o valor total do pacote" })
      .positive("Valor deve ser maior que zero"),
    valorSinal: z.coerce
      .number({ invalid_type_error: "Informe o valor do sinal" })
      .positive("Valor deve ser maior que zero"),
    dataSinal: z.string().min(1, "Informe a data do sinal"),
    formaSinal: z.enum(FORMAS_PAGAMENTO, { errorMap: () => ({ message: "Selecione a forma de pagamento" }) }),
    vencimentoFalta: z.string().min(1, "Informe o vencimento do restante"),
  }),
]);

// .refine() no topo, não dentro de uma opção da union — z.discriminatedUnion exige que cada
// opção seja um ZodObject puro, sem wrapping de ZodEffects.
export const packageBillingSchema = packageBillingUnion.refine(
  (data) => data.status !== "pagou_sinal" || data.valorSinal < data.valorTotal,
  { message: "O sinal deve ser menor que o valor total do pacote", path: ["valorSinal"] }
);
export type PackageBillingInput = z.infer<typeof packageBillingUnion>;
