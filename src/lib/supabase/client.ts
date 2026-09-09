import { createBrowserClient } from "@supabase/ssr";

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
 * Cliente Supabase para uso em Client Components ("use client").
 * Mantém a sessão sincronizada via cookies.
 *
 * NOTA: intencionalmente NÃO passamos o generic `Database` aqui. O parser de
 * tipos do supabase-js infere o resultado de `select()` a partir do schema, e
 * um schema escrito à mão (não gerado pelo CLI do Supabase) faz esse parser
 * resolver os resultados como `never`, quebrando o build com erros do tipo
 * "Property 'x' does not exist on type 'never'". Os tipos de domínio
 * (Patient, Food, MealPlan...) continuam sendo aplicados explicitamente nas
 * queries via `.returns<T>()` / `.single<T>()` e nas props dos componentes.
 */
export function createClient() {
  return createBrowserClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}
