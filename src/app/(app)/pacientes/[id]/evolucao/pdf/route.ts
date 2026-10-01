import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { generateEvolucaoPdf } from "@/lib/pdf/generate-evolucao-pdf";
import { parseIndicadores } from "@/lib/evolution";
import { withinRateLimit } from "@/lib/rate-limit";

/** PDF "Evolução física": `?ate=aaaa-mm-dd&ind=peso,imc,...` (até 5 indicadores). */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("Não autorizado.", { status: 401 });
  }

  const ateParam = request.nextUrl.searchParams.get("ate");
  const ate = ateParam && /^\d{4}-\d{2}-\d{2}$/.test(ateParam) ? ateParam : new Date().toISOString().slice(0, 10);
  const indicadores = parseIndicadores(request.nextUrl.searchParams.get("ind"));

  if (!(await withinRateLimit(supabase, "gerar_pdf"))) {
    return new NextResponse("Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.", { status: 429 });
  }

  const result = await generateEvolucaoPdf(supabase, user, params.id, ate, indicadores);

  if (!result) {
    return new NextResponse("Paciente não encontrado.", { status: 404 });
  }

  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
