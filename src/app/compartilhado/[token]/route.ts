import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Rota pública (sem autenticação) que um paciente abre a partir do link
 * enviado por WhatsApp. Nunca expõe a signed URL do Storage diretamente —
 * sempre repassa os bytes por aqui, pra que revogar o link (via
 * revokePlanShareLink) tenha efeito imediato mesmo que alguém já tenha
 * aberto o link antes. Ver migration 0010 para o desenho completo.
 *
 * Um mesmo token só existe em UMA das duas tabelas (plan_share_tokens ou
 * document_share_tokens, migration 0024) — tenta a do plano primeiro (fluxo
 * mais antigo e mais usado) e cai pra genérica de documentos (Evolução
 * Física, receita avulsa, arquivo) se não achar.
 */
export async function GET(_request: Request, { params }: { params: { token: string } }) {
  const supabase = createClient();

  const { data: planoData } = await supabase
    .rpc("get_shared_plan_pdf", { p_token: params.token })
    .returns<Array<{ signed_url: string; plano_nome: string; paciente_nome: string; expires_at: string }>>()
    .maybeSingle();

  const resolved = planoData
    ? { signedUrl: planoData.signed_url, filename: `plano-${planoData.paciente_nome}.pdf` }
    : await (async () => {
        const { data: documentoData } = await supabase
          .rpc("get_shared_document", { p_token: params.token })
          .returns<Array<{ signed_url: string; titulo: string; paciente_nome: string; expires_at: string }>>()
          .maybeSingle();

        if (!documentoData) return null;
        return { signedUrl: documentoData.signed_url, filename: `${documentoData.titulo}.pdf` };
      })();

  if (!resolved) {
    return new NextResponse("Este link é inválido, expirou ou foi revogado pelo profissional.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const pdfResponse = await fetch(resolved.signedUrl);
  if (!pdfResponse.ok || !pdfResponse.body) {
    return new NextResponse("Não foi possível carregar o documento no momento. Tente novamente mais tarde.", {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return new NextResponse(pdfResponse.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${resolved.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
