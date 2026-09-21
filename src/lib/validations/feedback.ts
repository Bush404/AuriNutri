import { z } from "zod";
import type { FeedbackTipo } from "@/lib/types/database.types";

export const FEEDBACK_TIPOS: FeedbackTipo[] = ["sugestao", "problema", "elogio", "outro"];

export const FEEDBACK_TIPO_LABELS: Record<FeedbackTipo, string> = {
  sugestao: "Sugestão",
  problema: "Problema",
  elogio: "Elogio",
  outro: "Outro",
};

const feedbackTipoSchema = z.enum(FEEDBACK_TIPOS as [FeedbackTipo, ...FeedbackTipo[]]);

/** Nada obrigatório além da mensagem — pedido explícito, pra manter o atrito baixo. */
export const feedbackSchema = z.object({
  tipo: feedbackTipoSchema,
  mensagem: z.string().trim().min(3, "Escreva sua mensagem.").max(2000, "Mensagem muito longa (máximo 2000 caracteres)."),
  rota: z.string().optional(),
  user_agent: z.string().optional(),
  viewport: z.string().optional(),
});
export type FeedbackInput = z.infer<typeof feedbackSchema>;
