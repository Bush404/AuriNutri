import { z } from "zod";

const optionalText = () =>
  z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" || v === undefined ? undefined : v));

export const labExamSchema = z.object({
  data_coleta: z.string().min(1, "Informe a data da coleta"),
  laboratorio: optionalText(),
  observacoes: optionalText(),
});
export type LabExamInput = z.infer<typeof labExamSchema>;

export const labMarkerSchema = z.object({
  nome_marcador: z.string().min(1, "Informe o nome do marcador"),
  valor: z.coerce.number({ invalid_type_error: "Informe o valor" }),
  unidade: z.string().min(1, "Informe a unidade"),
  referencia_min: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : val),
    z.coerce.number().optional()
  ),
  referencia_max: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : val),
    z.coerce.number().optional()
  ),
  referencia_editada: z.boolean().default(false),
});
export type LabMarkerInput = z.infer<typeof labMarkerSchema>;

/** Arquivo do exame — PDF ou imagem, validado no cliente E no servidor. */
export const LAB_EXAM_FILE_ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"] as const;
export const LAB_EXAM_FILE_ACCEPTED_EXTENSIONS = ".pdf,.png,.jpg,.jpeg,.webp";
export const LAB_EXAM_FILE_MAX_BYTES = 10 * 1024 * 1024; // 10MB
