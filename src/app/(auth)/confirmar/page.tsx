import { tipoDeConfirmacao } from "@/lib/auth-confirm";

import { ConfirmarLink } from "./confirmar-link";

interface ConfirmarPageProps {
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}

// Destino dos links dos e-mails do Supabase (ver supabase/email-templates/).
export default async function ConfirmarPage(props: ConfirmarPageProps) {
  const searchParams = await props.searchParams;
  return <ConfirmarLink tokenHash={searchParams.token_hash ?? ""} tipo={tipoDeConfirmacao(searchParams.type)} />;
}
