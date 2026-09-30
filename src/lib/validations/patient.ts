import { z } from "zod";

/** Converte string vazia/undefined em undefined antes da validação de texto opcional. */
export const optionalText = () =>
  z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" || v === undefined ? undefined : v));

/**
 * Número opcional vindo de um <input type="number">. Trata "" e undefined como
 * "não informado" ANTES de coagir para number, evitando que "" vire 0 e quebre
 * a validação de .positive() em campos opcionais.
 */
export const optionalPositiveNumber = () =>
  z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : val),
    z.coerce.number().positive("Deve ser maior que zero").optional()
  );

export const patientSchema = z.object({
  nome: z.string().min(2, "Informe o nome completo do paciente"),
  email: z
    .string()
    .email("E-mail inválido")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" ? undefined : v)),
  telefone: optionalText(),
  data_nascimento: optionalText(),
  sexo: z.enum(["feminino", "masculino", "outro"]).optional(),
  endereco: optionalText(),
  objetivo: optionalText(),
  observacoes: optionalText(),
});

export type PatientInput = z.infer<typeof patientSchema>;

/**
 * Anamnese em texto livre (Fase 14). As colunas por tema antigas não são mais
 * escritas pela aplicação — ficam no banco só para leitura de registros antigos.
 */
export const anamnesisSchema = z.object({
  titulo: optionalText(),
  /** HTML do editor; o servidor limpa (sanitizeRichText) antes de gravar. */
  conteudo: z.string().max(500_000, "Texto grande demais"),
});
export type AnamnesisInput = z.infer<typeof anamnesisSchema>;

export const anamnesisTemplateSchema = z.object({
  nome: z.string().trim().min(1, "Dê um nome ao modelo").max(120, "Nome muito longo"),
  conteudo: z.string().max(500_000, "Texto grande demais"),
});
export type AnamnesisTemplateInput = z.infer<typeof anamnesisTemplateSchema>;
