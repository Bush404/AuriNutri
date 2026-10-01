import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { generateAntropometriaPdf } from "@/lib/pdf/generate-antropometria-pdf";
import { withinRateLimit } from "@/lib/rate-limit";

/** PDF "Relatório antropométrico" de uma avaliação (botão Relatório da lista). */
export async function GET(_request: Request, props: { params: Promise<{ id: string; avaliacaoId: string }> }) {
  const params = await props.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("Não autorizado.", { status: 401 });
  }

  if (!(await withinRateLimit(supabase, "gerar_pdf"))) {
    return new NextResponse("Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.", { status: 429 });
  }

  const result = await generateAntropometriaPdf(supabase, user, params.id, params.avaliacaoId);

  if (!result) {
    return new NextResponse("Avaliação não encontrada.", { status: 404 });
  }

  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
