import type { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/patients";

/**
 * Rate limiting das operações caras (Fase 11, Bloco A) — gerar PDF/link de
 * compartilhamento e enviar arquivo. O contador mora no Postgres
 * (`check_rate_limit`, migration 0034), não em memória: Netlify Functions
 * são serverless, uma variável de módulo não sobrevive entre invocações e
 * não é compartilhada entre instâncias.
 *
 * Uso: no início da Server Action (depois de checar a sessão), `await
 * rateLimitOrError(supabase, "gerar_pdf")` — se vier um `ActionResult`,
 * retorne ele direto; se vier `null`, siga com a operação normalmente.
 *
 * Falha ABERTA de propósito: se a checagem em si der erro (ex.: função não
 * existe, banco fora do ar), a operação segue normalmente — o rate limiter
 * nunca deve virar um jeito de derrubar o produto inteiro por conta própria.
 */

export const RATE_LIMITS = {
  gerar_pdf: { maxTentativas: 30, janelaSegundos: 60 * 60 }, // 30 por hora
  enviar_arquivo: { maxTentativas: 30, janelaSegundos: 60 * 60 }, // 30 por hora
} as const;

export type RateLimitAction = keyof typeof RATE_LIMITS;

/** true = dentro do limite (pode seguir); false = estourou o limite. Fail-open em caso de erro na própria checagem. */
export async function withinRateLimit(supabase: Awaited<ReturnType<typeof createClient>>, acao: RateLimitAction): Promise<boolean> {
  const { maxTentativas, janelaSegundos } = RATE_LIMITS[acao];

  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_acao: acao,
    p_max_tentativas: maxTentativas,
    p_janela_segundos: janelaSegundos,
  });

  if (error) return true; // fail-open — ver comentário acima.
  return data !== false;
}

/** Uso em Server Actions que retornam ActionResult: `const limited = await rateLimitOrError(...); if (limited) return limited;` */
export async function rateLimitOrError(
  supabase: Awaited<ReturnType<typeof createClient>>,
  acao: RateLimitAction
): Promise<ActionResult | null> {
  const ok = await withinRateLimit(supabase, acao);
  if (ok) return null;
  return { success: false, message: "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente." };
}
