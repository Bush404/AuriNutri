import type { createClient } from "@/lib/supabase/server";
import { getProfileFileSignedUrl } from "@/lib/actions/profile";
import type { Profile } from "@/lib/types/database.types";

export interface ProfissionalPdfHeaderData {
  nome: string;
  crn: string | null;
  crnUf: string | null;
  especialidade: string | null;
  telefone: string | null;
  endereco: string | null;
  corMarca: string | null;
  logoUrl: string | null;
  assinaturaUrl: string | null;
}

/**
 * Dados do cabeçalho/rodapé do profissional (nome, CRN, logo, assinatura) —
 * reaproveitado por todo gerador de PDF da Central de Envio (plano, evolução
 * física, receita), pra nunca duplicar essa busca em cada arquivo.
 */
export async function buildProfissionalPdfHeaderData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; email?: string | null }
): Promise<ProfissionalPdfHeaderData> {
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();

  const [logoUrl, assinaturaUrl] = await Promise.all([
    getProfileFileSignedUrl(profile?.logo_url),
    getProfileFileSignedUrl(profile?.assinatura_url),
  ]);

  return {
    nome: profile?.nome ?? user.email?.split("@")[0] ?? "Nutricionista",
    crn: profile?.crn ?? null,
    crnUf: profile?.crn_uf ?? null,
    especialidade: profile?.especialidade ?? null,
    telefone: profile?.telefone ?? null,
    endereco: profile?.endereco ?? null,
    corMarca: profile?.cor_marca ?? null,
    logoUrl,
    assinaturaUrl,
  };
}
