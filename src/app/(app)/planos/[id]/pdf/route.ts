import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { generatePlanPdf } from "@/lib/pdf/generate-plan-pdf";
import { withinRateLimit } from "@/lib/rate-limit";

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
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

  const result = await generatePlanPdf(supabase, user, params.id);

  if (!result) {
    return new NextResponse("Plano não encontrado.", { status: 404 });
  }

  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
