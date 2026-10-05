import { z } from "zod";

export const patientPhotoSchema = z.object({
  data_registro: z.string().min(1, "Informe a data"),
  // "perfil" fica de fora: só existe em fotos antigas (antes da migration 0050), sem lado.
  tipo: z.enum(["frente", "direita", "esquerda", "costas"], { required_error: "Selecione o ângulo da foto" }),
});
export type PatientPhotoInput = z.infer<typeof patientPhotoSchema>;

/** Foto de evolução — só imagem (nunca PDF), validado no cliente E no servidor. */
export const PATIENT_PHOTO_ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const PATIENT_PHOTO_ACCEPTED_EXTENSIONS = ".png,.jpg,.jpeg,.webp";
export const PATIENT_PHOTO_MAX_BYTES = 8 * 1024 * 1024; // 8MB
