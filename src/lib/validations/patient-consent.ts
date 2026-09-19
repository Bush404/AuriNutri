import { z } from "zod";

const optionalText = () =>
  z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" || v === undefined ? undefined : v));

export const patientConsentSchema = z.object({
  tipo: z.enum(["exames", "fotos", "dados_clinicos"], { required_error: "Selecione o tipo de dado" }),
  forma: z.enum(["presencial", "documento_assinado", "verbal_registrado"], {
    required_error: "Selecione como o consentimento foi obtido",
  }),
  observacoes: optionalText(),
});
export type PatientConsentInput = z.infer<typeof patientConsentSchema>;
