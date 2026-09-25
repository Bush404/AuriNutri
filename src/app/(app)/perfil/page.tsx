import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getProfileFileSignedUrl } from "@/lib/actions/profile";
import type { Profile } from "@/lib/types/database.types";
import { ProfileForm } from "@/components/profile/profile-form";

export default async function PerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile) {
    redirect("/login");
  }

  const [logoSignedUrl, assinaturaSignedUrl] = await Promise.all([
    getProfileFileSignedUrl(profile.logo_url),
    getProfileFileSignedUrl(profile.assinatura_url),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Editar perfil</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Suas informações profissionais, usadas nos documentos entregues aos pacientes.
        </p>
      </div>

      <ProfileForm profile={profile} logoSignedUrl={logoSignedUrl} assinaturaSignedUrl={assinaturaSignedUrl} />
    </div>
  );
}
