import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Rota pública (sem autenticação) que um paciente abre a partir do link
 * enviado por WhatsApp. Nunca expõe a signed URL do Storage diretamente —
 * sempre repassa os bytes por aqui, pra que revogar o link (via
 * revokePlanShareLink) tenha efeito imediato mesmo que alguém já tenha
 * aberto o link antes. Ver migration 0010 para o desenho completo.
 */
export async function GET(_request: Request, { params }: { params: { token: string } }) {
  const supabase = createClient();

  const { data, error } = await supabase
    .rpc("get_shared_plan_pdf", { p_token: params.token })
    .returns<Array<{ signed_url: string; plano_nome: string; paciente_nome: string; expires_at: string }>>()
    .maybeSingle();

  if (error || !data) {
    return new NextResponse("Este link é inválido, expirou ou foi revogado pelo profissional.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const pdfResponse = await fetch(data.signed_url);
  if (!pdfResponse.ok || !pdfResponse.body) {
    return new NextResponse("Não foi possível carregar o plano no momento. Tente novamente mais tarde.", {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return new NextResponse(pdfResponse.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="plano-${data.paciente_nome}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
