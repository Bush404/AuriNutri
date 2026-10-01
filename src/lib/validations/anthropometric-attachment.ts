import { z } from "zod";

import { optionalPositiveNumber, optionalText } from "@/lib/validations/patient";

/** Relatório externo (bioimpedância, DEXA, laudo) — mesmos formatos e limite dos exames (Fase 7). */
export {
  LAB_EXAM_FILE_ACCEPTED_EXTENSIONS as ANEXO_ACCEPTED_EXTENSIONS,
  LAB_EXAM_FILE_ACCEPTED_TYPES as ANEXO_ACCEPTED_TYPES,
  LAB_EXAM_FILE_MAX_BYTES as ANEXO_MAX_BYTES,
} from "@/lib/validations/lab-exam";

export const anthropometricAttachmentSchema = z.object({
  data_avaliacao: z.string().min(1, "Informe a data do relatório"),
  titulo: optionalText(),
  observacoes: optionalText(),
  peso_kg: optionalPositiveNumber(),
  percentual_gordura: optionalPositiveNumber(),
  massa_livre_gordura_kg: optionalPositiveNumber(),
  massa_muscular_kg: optionalPositiveNumber(),
});

export type AnthropometricAttachmentInput = z.input<typeof anthropometricAttachmentSchema>;
