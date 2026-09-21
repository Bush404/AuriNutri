import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { generateMaterialPdf } from "@/lib/pdf/generate-material-pdf";
import { withinRateLimit } from "@/lib/rate-limit";

/**
 * PDF de um material da biblioteca — usado pelo "Visualizar" da listagem
 * (pra conferir como o material vai chegar ao paciente antes de enviar) e
 * também aproveitável pelo próprio profissional pra imprimir/guardar.
 * `inline` (não `attachment`) pra abrir direto no navegador, mesmo padrão
 * de /compartilhado/[token]. Mesmo gerador da Central de Envio
 * (generateMaterialPdf) — nunca duas versões diferentes do mesmo PDF.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("Não autorizado.", { status: 401 });
  }

  if (!(await withinRateLimit(supabase, "gerar_pdf"))) {
    return new NextResponse("Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.", { status: 429 });
  }

  const result = await generateMaterialPdf(supabase, user, params.id);

  if (!result) {
    return new NextResponse("Material não encontrado.", { status: 404 });
  }

  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${result.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
