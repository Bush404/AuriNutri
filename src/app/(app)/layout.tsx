import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileFileSignedUrl } from "@/lib/actions/profile";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  // Usuário e perfil vão juntos ao banco (o layout roda em toda página, e cada
  // busca em fila soma ~0,2 s — ver docs/ROADMAP_2.md, Fase 12). O perfil não
  // precisa do id: a RLS de profiles (auth.uid() = id) já devolve só o próprio.
  const [
    {
      data: { user },
    },
    { data: profile },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("profiles")
      .select("nome, email, logo_url, crn, crn_uf")
      .single<{ nome: string; email: string; logo_url: string | null; crn: string | null; crn_uf: string | null }>(),
  ]);

  // Camada extra de proteção além do middleware.
  if (!user) {
    redirect("/login");
  }

  const userName = profile?.nome ?? user.email?.split("@")[0] ?? "Nutricionista";
  const userEmail = profile?.email ?? user.email ?? "";
  const logoUrl = await getProfileFileSignedUrl(profile?.logo_url);

  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar
          userName={userName}
          userEmail={userEmail}
          logoUrl={logoUrl}
          crn={profile?.crn ?? null}
          crnUf={profile?.crn_uf ?? null}
        />
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
