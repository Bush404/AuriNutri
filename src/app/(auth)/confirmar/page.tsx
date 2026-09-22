import { tipoDeConfirmacao } from "@/lib/auth-confirm";

import { ConfirmarLink } from "./confirmar-link";

interface ConfirmarPageProps {
  searchParams: { token_hash?: string; type?: string };
}

// Destino dos links dos e-mails do Supabase (ver supabase/email-templates/).
export default function ConfirmarPage({ searchParams }: ConfirmarPageProps) {
  return <ConfirmarLink tokenHash={searchParams.token_hash ?? ""} tipo={tipoDeConfirmacao(searchParams.type)} />;
}
