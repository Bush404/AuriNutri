import Link from "next/link";
import { Users, UserPlus, Apple, ClipboardList, ArrowRight } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDate, getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("nome")
    .eq("id", user!.id)
    .single<{ nome: string }>();

  const [{ count: totalPacientes }, { count: totalAlimentos }, { count: totalPlanos }, { data: pacientesRecentes }] =
    await Promise.all([
      supabase.from("patients").select("*", { count: "exact", head: true }),
      supabase.from("foods").select("*", { count: "exact", head: true }).eq("is_global", false),
      supabase.from("meal_plans").select("*", { count: "exact", head: true }),
      supabase
        .from("patients")
        .select("id, nome, email, created_at")
        .order("created_at", { ascending: false })
        .limit(5)
        .returns<{ id: string; nome: string; email: string | null; created_at: string }[]>(),
    ]);

  const firstName = (profile?.nome ?? "").split(" ")[0];

  const stats = [
    {
      title: "Pacientes ativos",
      value: totalPacientes ?? 0,
      icon: Users,
      href: "/pacientes",
    },
    {
      title: "Meus alimentos",
      value: totalAlimentos ?? 0,
      icon: Apple,
      href: "/alimentos",
    },
    {
      title: "Planos alimentares",
      value: totalPlanos ?? 0,
      icon: ClipboardList,
      href: "/planos",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {firstName ? `Olá, ${firstName}` : "Olá"} 👋
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Aqui está um resumo da sua atividade na AuriNutri.
          </p>
        </div>
        <Button asChild>
          <Link href="/pacientes/novo">
            <UserPlus className="h-4 w-4" />
            Novo paciente
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Link key={stat.title} href={stat.href}>
            <Card className="transition-shadow hover:shadow-card">
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="mt-1 text-3xl font-semibold text-foreground">{stat.value}</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-50">
                  <stat.icon className="h-5 w-5 text-primary-600" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Pacientes recentes</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/pacientes">
              Ver todos
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {pacientesRecentes && pacientesRecentes.length > 0 ? (
            <div className="divide-y divide-border">
              {pacientesRecentes.map((paciente) => (
                <Link
                  key={paciente.id}
                  href={`/pacientes/${paciente.id}`}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0 hover:opacity-80"
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>{getInitials(paciente.nome)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-foreground">{paciente.nome}</p>
                      <p className="text-xs text-muted-foreground">{paciente.email ?? "Sem e-mail"}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    desde {formatDate(paciente.created_at.slice(0, 10))}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Users}
              title="Nenhum paciente cadastrado ainda"
              description="Cadastre seu primeiro paciente para começar a usar a AuriNutri."
              action={
                <Button asChild size="sm">
                  <Link href="/pacientes/novo">Cadastrar paciente</Link>
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
