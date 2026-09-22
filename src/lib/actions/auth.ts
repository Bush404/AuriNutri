"use server";

import { createClient } from "@/lib/supabase/server";
import { CONFIRMACOES, tipoDeConfirmacao } from "@/lib/auth-confirm";
import type { ActionResult } from "@/lib/actions/patients";

/**
 * Confirma um link de e-mail (token_hash) e cria a sessão nos cookies. Só roda
 * quando a pessoa clica em Continuar em /confirmar — ver src/lib/auth-confirm.ts.
 */
export async function confirmarLinkDeEmail(
  tokenHash: string,
  tipo: string
): Promise<ActionResult & { destino?: string }> {
  const tipoValido = tipoDeConfirmacao(tipo);
  if (!tokenHash || !tipoValido) {
    return { success: false, message: "Link inválido." };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipoValido });
  if (error) {
    return { success: false, message: "Este link é inválido ou já expirou." };
  }

  return { success: true, destino: CONFIRMACOES[tipoValido].destino };
}
