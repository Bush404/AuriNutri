import { z } from "zod";

/** Converte string vazia/undefined em undefined antes da validação de texto opcional. */
const optionalText = () =>
  z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" || v === undefined ? undefined : v));

/** Converte string vazia/undefined em undefined antes da validação de UUID opcional. */
const optionalUuid = () =>
  z
    .string()
    .uuid("Identificador inválido")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" || v === undefined ? undefined : v));

export const APPOINTMENT_TIPOS = ["primeira_consulta", "retorno", "avaliacao", "outro"] as const;
export const APPOINTMENT_STATUSES = [
  "agendado",
  "confirmado",
  "realizado",
  "faltou",
  "cancelado",
] as const;

export const appointmentSchema = z.object({
  patient_id: z.string().uuid("Selecione um paciente"),
  /**
   * Horário de parede local, formato "AAAA-MM-DDTHH:mm" (valor de um
   * <input type="datetime-local">) — SEM fuso embutido. A action converte
   * para UTC usando o fuso salvo em profiles.fuso_horario, nunca o fuso do
   * servidor. Ver src/lib/timezone.ts.
   */
  data_hora_local: z
    .string()
    .min(1, "Informe data e horário")
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Data/horário inválido")
    .refine((v) => Number(v.slice(-2)) % 15 === 0, "O horário deve ser em intervalos de 15 minutos"),
  duracao_min: z.coerce
    .number({ invalid_type_error: "Informe a duração" })
    .int("Duração deve ser um número inteiro de minutos")
    .positive("Duração deve ser maior que zero")
    .refine((v) => v % 15 === 0, "A duração deve ser em intervalos de 15 minutos"),
  tipo: z.enum(APPOINTMENT_TIPOS, { errorMap: () => ({ message: "Selecione o tipo de consulta" }) }),
  status: z.enum(APPOINTMENT_STATUSES).optional(),
  observacoes: optionalText(),
});
export type AppointmentInput = z.infer<typeof appointmentSchema>;

export const taskSchema = z.object({
  titulo: z.string().min(2, "Informe o título da pendência"),
  descricao: optionalText(),
  patient_id: optionalUuid(),
  appointment_id: optionalUuid(),
  /** Data (yyyy-mm-dd), sem horário — não precisa de conversão de fuso. */
  data_limite: optionalText(),
  concluida: z.boolean().optional(),
});
export type TaskInput = z.infer<typeof taskSchema>;
