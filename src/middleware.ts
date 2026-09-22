import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Fica em src/ (e não na raiz) porque o projeto usa pasta src/: na raiz o
     * Next.js ignora este arquivo sem nenhum aviso.
     *
     * Aplica o middleware a todas as rotas, exceto:
     * - arquivos estáticos (_next/static, _next/image)
     * - favicon e assets públicos
     * - /monitoring (túnel do Sentry, ver next.config.mjs)
     */
    "/((?!monitoring|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
