import Link from "next/link";
import {
  Users,
  UserPlus,
  Apple,
  ClipboardList,
  ArrowRight,
  CalendarDays,
  Wallet,
  CircleDollarSign,
  TrendingUp,
  CalendarClock,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getPatientAgendaContext } from "@/lib/actions/patient-context";
import { PENDENCIA_META, PENDENCIA_ORDEM } from "@/lib/patient-context";
import { APPOINTMENT_STATUS_META } from "@/lib/agenda";
import { DEFAULT_TIME_ZONE, utcInstantToZonedDateTime } from "@/lib/timezone";
import { formatCurrencyBRL, sumCurrency } from "@/lib/finance";
import type { AppointmentStatus } from "@/lib/types/database.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDate, getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

interface UpcomingAppointmentRow {
  id: string;
  data_hora: string;
  status: AppointmentStatus;
  patient_id: string;
  patients: { nome: string } | null;
}

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("nome, fuso_horario")
    .eq("id", user!.id)
    .single<{ nome: string; fuso_horario: string | null }>();

  const timeZone = profile?.fuso_horario || DEFAULT_TIME_ZONE;
  const startIso = new Date().toISOString();
  const endIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const hoje = new Date();
  const inicioDoMesUtc = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1));
  const inicioDoProximoMesUtc = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 1));
  const inicioDoMesData = `${inicioDoMesUtc.getUTCFullYear()}-${pad2(inicioDoMesUtc.getUTCMonth() + 1)}-01`;
  const inicioDoProximoMesData = `${inicioDoProximoMesUtc.getUTCFullYear()}-${pad2(inicioDoProximoMesUtc.getUTCMonth() + 1)}-01`;
  const em30DiasData = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [
    { count: totalPacientes },
    { count: totalAlimentos },
    { count: totalPlanos },
    { data: pacientesRecentes },
    { data: proximosAtendimentos },
    { data: pagamentosDoMes },
    { data: pagamentosPendentes },
    { count: consultasRealizadasNoMes },
    { data: despesasAVencer },
  ] = await Promise.all([
    supabase.from("patients").select("*", { count: "exact", head: true }),
    supabase.from("foods").select("*", { count: "exact", head: true }).eq("is_global", false),
    supabase.from("meal_plans").select("*", { count: "exact", head: true }),
    supabase
      .from("patients")
      .select("id, nome, email, created_at")
      .order("created_at", { ascending: false })
      .limit(5)
      .returns<{ id: string; nome: string; email: string | null; created_at: string }[]>(),
    supabase
      .from("appointments")
      .select("id, data_hora, status, patient_id, patients(nome)")
      .gte("data_hora", startIso)
      .lt("data_hora", endIso)
      .order("data_hora")
      .limit(10)
      .returns<UpcomingAppointmentRow[]>(),
    supabase
      .from("payments")
      .select("valor")
      .gte("data_pagamento", inicioDoMesData)
      .lt("data_pagamento", inicioDoProximoMesData)
      .returns<{ valor: number }[]>(),
    supabase.from("payments").select("valor").is("data_pagamento", null).returns<{ valor: number }[]>(),
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("status", "realizado")
      .gte("data_hora", inicioDoMesUtc.toISOString())
      .lt("data_hora", inicioDoProximoMesUtc.toISOString()),
    supabase
      .from("expense_occurrences")
      .select("id, valor, data_vencimento")
      .is("data_pagamento", null)
      .lte("data_vencimento", em30DiasData)
      .returns<{ id: string; valor: number; data_vencimento: string }[]>(),
  ]);

  const recebidoNoMes = sumCurrency((pagamentosDoMes ?? []).map((p) => p.valor));
  const totalPendente = sumCurrency((pagamentosPendentes ?? []).map((p) => p.valor));
  /**
   * Ticket médio = receitas recebidas no mês ÷ CONSULTAS REALIZADAS no mês
   * (não pacientes distintos atendidos) — um mesmo paciente pode ter mais de
   * um atendimento no mês, e o ticket médio "por atendimento" é o que se
   * paga por sessão, não por pessoa. Consistente com o "custo por
   * atendimento" já usado em /financeiro (mesma unidade: por consulta).
   */
  const ticketMedio = consultasRealizadasNoMes && consultasRealizadasNoMes > 0 ? recebidoNoMes / consultasRealizadasNoMes : 0;
  const despesasAVencerCount = despesasAVencer?.length ?? 0;
  const despesasAVencerTotal = sumCurrency((despesasAVencer ?? []).map((d) => d.valor));

  const proximosComPendencias = await Promise.all(
    (proximosAtendimentos ?? []).map(async (agendamento) => ({
      agendamento,
      contexto: await getPatientAgendaContext(agendamento.patient_id, timeZone, {
        excludeAppointmentId: agendamento.id,
      }),
    }))
  );

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/financeiro">
          <Card className="transition-shadow hover:shadow-card">
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">Recebido no mês</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{formatCurrencyBRL(recebidoNoMes)}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-50">
                <Wallet className="h-5 w-5 text-primary-600" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/financeiro">
          <Card className="transition-shadow hover:shadow-card">
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">Pendente</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{formatCurrencyBRL(totalPendente)}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-50">
                <CircleDollarSign className="h-5 w-5 text-primary-600" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/financeiro">
          <Card className="transition-shadow hover:shadow-card">
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">Ticket médio</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{formatCurrencyBRL(ticketMedio)}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">por consulta realizada no mês</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-50">
                <TrendingUp className="h-5 w-5 text-primary-600" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/financeiro">
          <Card className="transition-shadow hover:shadow-card">
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">Despesas a vencer (30 dias)</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{formatCurrencyBRL(despesasAVencerTotal)}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {despesasAVencerCount} {despesasAVencerCount === 1 ? "lançamento" : "lançamentos"} (inclui vencidas)
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-50">
                <CalendarClock className="h-5 w-5 text-primary-600" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Próximos atendimentos (7 dias)</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/agenda">
              Ver agenda
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {proximosComPendencias.length > 0 ? (
            <div className="divide-y divide-border">
              {proximosComPendencias.map(({ agendamento, contexto }) => {
                const { dateStr, timeStr } = utcInstantToZonedDateTime(agendamento.data_hora, timeZone);
                const statusMeta = APPOINTMENT_STATUS_META[agendamento.status];
                const pendencias = contexto ? PENDENCIA_ORDEM.filter((t) => contexto.pendencias.includes(t)) : [];
                return (
                  <Link
                    key={agendamento.id}
                    href={`/agenda?visao=semana&data=${dateStr}&paciente=${agendamento.patient_id}`}
                    className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 hover:opacity-80 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>{getInitials(agendamento.patients?.nome ?? "?")}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {agendamento.patients?.nome ?? "Paciente"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(dateStr)} às {timeStr}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                      <Badge variant={statusMeta.badgeVariant} className="text-[10px]">
                        {statusMeta.label}
                      </Badge>
                      {pendencias.map((tipo) => {
                        const meta = PENDENCIA_META[tipo];
                        const Icon = meta.icon;
                        return (
                          <Badge key={tipo} variant="warning" className="gap-1 text-[10px]" title={meta.label}>
                            <Icon className="h-3 w-3" />
                          </Badge>
                        );
                      })}
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={CalendarDays}
              title="Nenhum atendimento nos próximos 7 dias"
              description="Agende uma consulta para vê-la aparecer aqui."
              action={
                <Button asChild size="sm">
                  <Link href="/agenda">Abrir agenda</Link>
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>

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
