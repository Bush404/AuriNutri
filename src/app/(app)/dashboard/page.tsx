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
  CheckSquare,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getPatientAgendaContext } from "@/lib/actions/patient-context";
import { PENDENCIA_META, PENDENCIA_ORDEM } from "@/lib/patient-context";
import { APPOINTMENT_STATUS_META, addDays, agendaItemSortKey, taskChipClassName, taskTimeLabel } from "@/lib/agenda";
import { DEFAULT_TIME_ZONE, todayInTimeZone, utcInstantToZonedDateTime } from "@/lib/timezone";
import { JANELA_BALANCO_DIAS, balancoUltimosDias, formatCurrencyBRL, sumCurrency } from "@/lib/finance";
import type { AppointmentStatus, TaskWithPatient } from "@/lib/types/database.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { WeekPreview, type WeekPreviewItem } from "@/components/dashboard/week-preview";
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
  const supabase = await createClient();

  const startIso = new Date().toISOString();
  const endIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const hoje = new Date();
  const inicioDoMesUtc = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1));
  const inicioDoProximoMesUtc = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 1));
  const inicioDoMesData = `${inicioDoMesUtc.getUTCFullYear()}-${pad2(inicioDoMesUtc.getUTCMonth() + 1)}-01`;
  const inicioDoProximoMesData = `${inicioDoProximoMesUtc.getUTCFullYear()}-${pad2(inicioDoProximoMesUtc.getUTCMonth() + 1)}-01`;
  const em30DiasData = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  // Janelas por data (yyyy-mm-dd) buscadas com folga de um dia para cada lado:
  // o fuso do profissional só é conhecido depois (vem do perfil, na mesma ida
  // ao banco), e o recorte exato é feito depois, no fuso certo.
  const janelaBalancoInicio = new Date(Date.now() - (JANELA_BALANCO_DIAS + 1) * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const tarefasInicio = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const tarefasFim = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Uma ida só ao banco para tudo (cada busca em fila soma ~0,2 s — ver
  // docs/ROADMAP_2.md, Fase 12).
  const [
    { data: profile },
    { count: totalPacientes },
    { count: totalAlimentos },
    { count: totalPlanos },
    { data: pacientesRecentes },
    { data: proximosAtendimentos },
    { data: pagamentosDoMes },
    { data: pagamentosPendentes },
    { data: recebimentosJanela },
    { data: despesasPagasJanela },
    { data: despesasAVencer },
    { data: tarefasProximas },
  ] = await Promise.all([
    // Sem getUser() antes: a RLS de profiles (auth.uid() = id) já devolve só
    // o perfil de quem está logado, e o layout redireciona quem não está.
    supabase
      .from("profiles")
      .select("nome, fuso_horario")
      .single<{ nome: string; fuso_horario: string | null }>(),
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
      .from("payments")
      .select("valor, data_pagamento")
      .gte("data_pagamento", janelaBalancoInicio)
      .returns<{ valor: number; data_pagamento: string | null }[]>(),
    supabase
      .from("expense_occurrences")
      .select("valor, data_pagamento")
      .gte("data_pagamento", janelaBalancoInicio)
      .returns<{ valor: number; data_pagamento: string | null }[]>(),
    supabase
      .from("expense_occurrences")
      .select("id, valor, data_vencimento")
      .is("data_pagamento", null)
      .lte("data_vencimento", em30DiasData)
      .returns<{ id: string; valor: number; data_vencimento: string }[]>(),
    supabase
      .from("tasks")
      .select("*, patients(nome)")
      .eq("concluida", false)
      .gte("data_limite", tarefasInicio)
      .lte("data_limite", tarefasFim)
      .order("data_limite")
      .returns<TaskWithPatient[]>(),
  ]);

  const timeZone = profile?.fuso_horario || DEFAULT_TIME_ZONE;
  const recebidoNoMes = sumCurrency((pagamentosDoMes ?? []).map((p) => p.valor));
  const totalPendente = sumCurrency((pagamentosPendentes ?? []).map((p) => p.valor));
  const hojeStr = todayInTimeZone(timeZone);
  // Substitui o antigo "Ticket médio" (Roadmap 2, Fase 13): entrou − saiu nos
  // últimos 30 dias, pela data do pagamento.
  const balanco = balancoUltimosDias(recebimentosJanela ?? [], despesasPagasJanela ?? [], hojeStr);

  // Próximos 7 dias no fuso do profissional: hoje + 6.
  const proximosDias = Array.from({ length: 7 }, (_, i) => addDays(hojeStr, i));
  const tarefasDaSemana = (tarefasProximas ?? []).filter(
    (t) => t.data_limite !== null && t.data_limite >= proximosDias[0] && t.data_limite <= proximosDias[6]
  );
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

  const diasDaSemana = new Set(proximosDias);
  const compromissos = [
    ...proximosComPendencias.map(({ agendamento, contexto }) => {
      const { dateStr, timeStr } = utcInstantToZonedDateTime(agendamento.data_hora, timeZone);
      return { kind: "consulta" as const, key: agendamento.id, dateStr, timeStr: timeStr as string | null, agendamento, contexto };
    }),
    ...tarefasDaSemana.map((task) => ({
      kind: "tarefa" as const,
      key: task.id,
      dateStr: task.data_limite as string,
      timeStr: taskTimeLabel(task.horario),
      task,
    })),
  ]
    .filter((item) => diasDaSemana.has(item.dateStr))
    .sort((a, b) => a.dateStr.localeCompare(b.dateStr) || agendaItemSortKey(a).localeCompare(agendaItemSortKey(b)));

  const itensDoCalendario: WeekPreviewItem[] = compromissos.map((item) =>
    item.kind === "tarefa"
      ? {
          key: item.key,
          dateStr: item.dateStr,
          timeStr: item.timeStr,
          label: item.task.titulo,
          kind: "tarefa",
          chipClassName: taskChipClassName(false),
        }
      : {
          key: item.key,
          dateStr: item.dateStr,
          timeStr: item.timeStr,
          label: item.agendamento.patients?.nome ?? "Paciente",
          kind: "consulta",
          chipClassName: APPOINTMENT_STATUS_META[item.agendamento.status].chipClassName,
        }
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
          <Card
            className="transition-shadow hover:shadow-card"
            title={`Recebido ${formatCurrencyBRL(balanco.recebido)} − despesas pagas ${formatCurrencyBRL(balanco.despesasPagas)}, de ${formatDate(balanco.inicio)} até hoje`}
          >
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">Balanço (30 dias)</p>
                <p
                  className={`mt-1 text-2xl font-semibold ${balanco.saldo < 0 ? "text-destructive" : "text-foreground"}`}
                >
                  {formatCurrencyBRL(balanco.saldo)}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">recebido − despesas pagas</p>
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Próximos 7 dias</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/agenda">
                Ver agenda completa
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <WeekPreview days={proximosDias} todayStr={hojeStr} items={itensDoCalendario} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Próximos compromissos (7 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            {compromissos.length > 0 ? (
              <div className="max-h-[420px] divide-y divide-border overflow-y-auto">
                {compromissos.map((item) => {
                  if (item.kind === "tarefa") {
                    const { task } = item;
                    return (
                      <Link
                        key={item.key}
                        href={`/agenda?visao=semana&data=${item.dateStr}`}
                        className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 hover:opacity-80"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-foreground/40">
                          <CheckSquare className="h-4 w-4 text-foreground" aria-hidden />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{task.titulo}</p>
                          <p className="text-xs text-muted-foreground">
                            Tarefa · {formatDate(item.dateStr)}
                            {item.timeStr ? ` às ${item.timeStr}` : ""}
                            {task.patients?.nome ? ` · ${task.patients.nome}` : ""}
                          </p>
                        </div>
                      </Link>
                    );
                  }
                  const { agendamento, contexto } = item;
                  const statusMeta = APPOINTMENT_STATUS_META[agendamento.status];
                  const pendencias = contexto ? PENDENCIA_ORDEM.filter((t) => contexto.pendencias.includes(t)) : [];
                  return (
                    <Link
                      key={item.key}
                      href={`/agenda?visao=semana&data=${item.dateStr}&paciente=${agendamento.patient_id}`}
                      className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 hover:opacity-80 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>{getInitials(agendamento.patients?.nome ?? "?")}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium text-foreground">{agendamento.patients?.nome ?? "Paciente"}</p>
                          <p className="text-xs text-muted-foreground">
                            Consulta · {formatDate(item.dateStr)} às {item.timeStr}
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
                title="Nada nos próximos 7 dias"
                description="Consultas e tarefas agendadas aparecem aqui."
                action={
                  <Button asChild size="sm">
                    <Link href="/agenda">Abrir agenda</Link>
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>
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
