import { z } from "zod";

/** Converte string vazia/undefined em undefined antes da validação de texto opcional. */
const optionalText = () =>
  z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" || v === undefined ? undefined : v));

export const BRAZIL_UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

/** Tipos de arquivo e tamanho aceitos para logo/assinatura — validados no cliente E no servidor. */
export const PROFILE_FILE_ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
] as const;
export const PROFILE_FILE_ACCEPTED_EXTENSIONS = ".png,.jpg,.jpeg,.webp,.svg";
export const PROFILE_FILE_MAX_BYTES = 2 * 1024 * 1024; // 2MB

export const profileSchema = z
  .object({
    nome: z.string().min(2, "Informe seu nome completo"),
    crn: z
      .string()
      .optional()
      .or(z.literal(""))
      .transform((v) => (v === "" || v === undefined ? undefined : v))
      .refine((v) => v === undefined || /^\d{3,7}$/.test(v), {
        message: "CRN deve conter apenas números (3 a 7 dígitos)",
      }),
    crn_uf: z
      .union([z.enum(BRAZIL_UFS), z.literal("")])
      .optional()
      .transform((v) => (v === "" || v === undefined ? undefined : v)),
    especialidade: optionalText(),
    telefone: optionalText(),
    endereco: optionalText(),
    bio: z
      .string()
      .max(500, "A bio deve ter no máximo 500 caracteres")
      .optional()
      .or(z.literal(""))
      .transform((v) => (v === "" || v === undefined ? undefined : v)),
    cor_marca: z
      .string()
      .optional()
      .or(z.literal(""))
      .transform((v) => (v === "" || v === undefined ? undefined : v))
      .refine((v) => v === undefined || /^#[0-9A-Fa-f]{6}$/.test(v), {
        message: "Cor inválida",
      }),
    logo_url: z.string().optional().nullable(),
    assinatura_url: z.string().optional().nullable(),
  })
  .refine((data) => !(data.crn && !data.crn_uf), {
    message: "Informe a UF do CRN",
    path: ["crn_uf"],
  })
  .refine((data) => !(data.crn_uf && !data.crn), {
    message: "Informe o número do CRN",
    path: ["crn"],
  });

export type ProfileInput = z.infer<typeof profileSchema>;
