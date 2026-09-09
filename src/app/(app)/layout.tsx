import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Camada extra de proteção além do middleware.
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("nome, email")
    .eq("id", user.id)
    .single<{ nome: string; email: string }>();

  const userName = profile?.nome ?? user.email?.split("@")[0] ?? "Nutricionista";
  const userEmail = profile?.email ?? user.email ?? "";

  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar userName={userName} userEmail={userEmail} />
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
