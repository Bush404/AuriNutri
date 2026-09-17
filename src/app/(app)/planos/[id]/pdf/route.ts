import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { generatePlanPdf } from "@/lib/pdf/generate-plan-pdf";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("Não autorizado.", { status: 401 });
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
