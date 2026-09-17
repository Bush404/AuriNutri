import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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


const PUBLIC_ROUTES = [
  "/login",
  "/cadastro",
  "/esqueci-senha",
  "/redefinir-senha",
  "/auth/callback",
  // Link de compartilhamento do PDF do plano — aberto pelo paciente, que
  // nunca tem sessão (D2: paciente não é usuário autenticado). O acesso é
  // controlado pelo token em si (ver migration 0010), não por login.
  "/compartilhado",
];

function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
}

/**
 * Atualiza a sessão do Supabase em cada requisição e protege as rotas
 * privadas da aplicação, redirecionando usuários não autenticados para /login
 * e usuários autenticados para longe das páginas de autenticação.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const publicRoute = isPublicRoute(pathname);

  if (!user && !publicRoute && pathname !== "/") {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && (pathname === "/login" || pathname === "/cadastro")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}
