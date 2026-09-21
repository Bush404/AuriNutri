"use server";

import { createClient } from "@/lib/supabase/server";
import { feedbackSchema, type FeedbackInput } from "@/lib/validations/feedback";
import type { ActionResult } from "@/lib/actions/patients";

/**
 * Grava o feedback — identificado (user_id), nunca anônimo. Sem
 * revalidatePath: nenhuma tela lista feedback próprio, e a leitura é feita
 * pelo painel do Supabase (ver migration 0033). Sem notificação por e-mail
 * de propósito, conforme pedido.
 */
export async function sendFeedback(input: FeedbackInput): Promise<ActionResult> {
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Verifique a mensagem." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  const { error } = await supabase.from("feedback").insert({
    user_id: user.id,
    tipo: parsed.data.tipo,
    mensagem: parsed.data.mensagem,
    rota: parsed.data.rota ?? null,
    user_agent: parsed.data.user_agent ?? null,
    viewport: parsed.data.viewport ?? null,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true };
}
