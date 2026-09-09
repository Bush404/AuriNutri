import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Valida uma variável de ambiente obrigatória.
 *
 * IMPORTANTE: o valor precisa ser passado como `process.env.NOME_LITERAL`.
 * O Next.js só substitui as variáveis `NEXT_PUBLIC_*` pelo valor real no
 * bundle do navegador quando o acesso é ESTÁTICO. Um acesso dinâmico
 * (`process.env[nome]`) não é substituído e resulta em `undefined` no
 * cliente, mesmo com a variável corretamente configurada.
 */
function requiredEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(
      `[AuriNutri] Variável de ambiente ausente: ${name}. ` +
        "Configure-a no painel do Netlify (Site configuration > Environment variables) " +
        "e refaça o deploy, ou no arquivo .env.local em desenvolvimento."
    );
  }
  return value;
}


/**
 * Cliente Supabase para uso em Server Components, Route Handlers e Server Actions.
 * Lê/escreve a sessão através dos cookies da requisição.
 *
 * NOTA: o generic `Database` é intencionalmente omitido — ver comentário
 * equivalente em `client.ts`.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Chamado a partir de um Server Component sem permissão de escrita.
            // Pode ser ignorado quando há middleware renovando a sessão.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // Idem ao caso acima.
          }
        },
      },
    }
  );
}
