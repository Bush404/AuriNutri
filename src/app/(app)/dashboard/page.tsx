import Image from "next/image";
import Link from "next/link";
import {
  Users,
  UserPlus,
  ClipboardList,
  ArrowRight,
  CalendarDays,
  Wallet,
  CheckSquare,
  CookingPot,
  ChevronRight,
  CircleDollarSign,
  HandCoins,
  Lightbulb,
  Plus,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getPatientAgendaContext } from "@/lib/actions/patient-context";
import { PENDENCIA_META, PENDENCIA_ORDEM } from "@/lib/patient-context";
import { APPOINTMENT_STATUS_META, APPOINTMENT_TIPO_LABELS, agendaItemSortKey, taskTimeLabel } from "@/lib/agenda";
import { DEFAULT_TIME_ZONE, todayInTimeZone, utcInstantToZonedDateTime } from "@/lib/timezone";
import { JANELA_BALANCO_DIAS, balancoUltimosDias, formatCurrencyBRL, sumCurrency } from "@/lib/finance";
import {
  contarNoMes,
  inicioDaJanela,
  serieAcumulada,
  somaPorMes,
  ultimosMeses,
  variacaoPercentual,
} from "@/lib/dashboard";
import { dicaDoDia } from "@/lib/dashboard-dicas";
import type { AppointmentStatus, AppointmentTipo, TaskWithPatient } from "@/lib/types/database.types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCard, type StatTrend } from "@/components/shared/stat-card";
import { Sparkline } from "@/components/shared/sparkline";
import { CornerLeaves } from "@/components/shared/leaf-decoration";
import { formatDate, getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Meses da minilinha dos cards. */
const MESES_TENDENCIA = 6;
const MES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function rotuloMes(chave: string): string {
  const [ano, mes] = chave.split("-");
  return `${MES_ABREV[Number(mes) - 1]}/${ano}`;
}

function tendenciaNovos(n: number): StatTrend {
  return n > 0 ? { text: `+${n} este mês`, direction: "up" } : { text: "nenhum novo este mês", direction: "flat" };
}

interface TodayAppointmentRow {
  id: string;
  data_hora: string;
  status: AppointmentStatus;
  tipo: AppointmentTipo;
  patient_id: string;
  patients: { nome: string } | null;
}

interface RecentPatientRow {
  id: string;
  nome: string;
  telefone: string | null;
  ativo: boolean;
  created_at: string;
}

export default async function DashboardPage() {
  const supabase = await createClient();

  // A agenda de hoje é recortada no fuso do profissional, que só chega junto
  // com o perfil: busca ±36 h em volta de agora e recorta o dia certo depois.
  const startIso = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
  const endIso = new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString();

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
  const tarefasFim = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  // Tendências: um mês a mais de folga pelo mesmo motivo (fuso ainda desconhecido).
  const tendenciaInicio = inicioDaJanela(ultimosMeses(hoje.toISOString().slice(0, 10), MESES_TENDENCIA + 1));

  // Uma ida só ao banco para tudo (cada busca em fila soma ~0,2 s — ver
  // docs/ROADMAP_2.md, Fase 12).
  const [
    { data: profile },
    { count: totalPacientes },
    { count: pacientesAtivos },
    { count: totalPlanos },
    { count: totalReceitas },
    { data: pacientesRecentes },
    { data: atendimentosProximos },
    { data: pagamentosDoMes },
    { data: pagamentosPendentes },
    { data: recebimentosJanela },
    { data: despesasPagasJanela },
    { data: despesasAVencer },
    { data: tarefasProximas },
    { data: pacientesCriados },
    { data: planosCriados },
    { data: receitasCriadas },
    { data: recebimentosTendencia },
  ] = await Promise.all([
    // Sem getUser() antes: a RLS de profiles (auth.uid() = id) já devolve só
    // o perfil de quem está logado, e o layout redireciona quem não está.
    supabase
      .from("profiles")
      .select("nome, fuso_horario")
      .single<{ nome: string; fuso_horario: string | null }>(),
    supabase.from("patients").select("*", { count: "exact", head: true }),
    supabase.from("patients").select("*", { count: "exact", head: true }).eq("ativo", true),
    supabase.from("meal_plans").select("*", { count: "exact", head: true }),
    supabase.from("recipes").select("*", { count: "exact", head: true }),
    supabase
      .from("patients")
      .select("id, nome, telefone, ativo, created_at")
      .order("created_at", { ascending: false })
      .limit(5)
      .returns<RecentPatientRow[]>(),
    supabase
      .from("appointments")
      .select("id, data_hora, status, tipo, patient_id, patients(nome)")
      .gte("data_hora", startIso)
      .lt("data_hora", endIso)
      .order("data_hora")
      .limit(60)
      .returns<TodayAppointmentRow[]>(),
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
    supabase.from("patients").select("created_at").gte("created_at", tendenciaInicio).returns<{ created_at: string }[]>(),
    supabase.from("meal_plans").select("created_at").gte("created_at", tendenciaInicio).returns<{ created_at: string }[]>(),
    supabase.from("recipes").select("created_at").gte("created_at", tendenciaInicio).returns<{ created_at: string }[]>(),
    supabase
      .from("payments")
      .select("valor, data_pagamento")
      .gte("data_pagamento", tendenciaInicio)
      .returns<{ valor: number; data_pagamento: string | null }[]>(),
  ]);

  const timeZone = profile?.fuso_horario || DEFAULT_TIME_ZONE;
  const recebidoNoMes = sumCurrency((pagamentosDoMes ?? []).map((p) => p.valor));
  const totalPendente = sumCurrency((pagamentosPendentes ?? []).map((p) => p.valor));
  const hojeStr = todayInTimeZone(timeZone);
  // Substitui o antigo "Ticket médio" (Roadmap 2, Fase 13): entrou − saiu nos
  // últimos 30 dias, pela data do pagamento.
  const balanco = balancoUltimosDias(recebimentosJanela ?? [], despesasPagasJanela ?? [], hojeStr);
  const despesasAVencerCount = despesasAVencer?.length ?? 0;
  const despesasAVencerTotal = sumCurrency((despesasAVencer ?? []).map((d) => d.valor));

  // Tendências (últimos 6 meses, no fuso do profissional).
  const meses = ultimosMeses(hojeStr, MESES_TENDENCIA);
  const mesAtual = meses[meses.length - 1];
  const paraData = (iso: string) => utcInstantToZonedDateTime(iso, timeZone).dateStr;
  const datasPacientes = (pacientesCriados ?? []).map((p) => paraData(p.created_at));
  const datasPlanos = (planosCriados ?? []).map((p) => paraData(p.created_at));
  const datasReceitas = (receitasCriadas ?? []).map((r) => paraData(r.created_at));
  const seriePacientes = serieAcumulada(totalPacientes ?? 0, datasPacientes, meses);
  const seriePlanos = serieAcumulada(totalPlanos ?? 0, datasPlanos, meses);
  const serieReceitas = serieAcumulada(totalReceitas ?? 0, datasReceitas, meses);
  const serieRecebido = somaPorMes(
    (recebimentosTendencia ?? []).map((p) => ({ data: p.data_pagamento, valor: p.valor })),
    meses
  );
  const variacaoRecebido = variacaoPercentual(serieRecebido[serieRecebido.length - 1], serieRecebido[serieRecebido.length - 2]);
  const tendenciaRecebido: StatTrend =
    variacaoRecebido === null
      ? { text: "sem recebimentos no mês anterior", direction: "flat" }
      : {
          text: `${variacaoRecebido > 0 ? "+" : ""}${variacaoRecebido}% em relação ao mês anterior`,
          direction: variacaoRecebido > 0 ? "up" : variacaoRecebido < 0 ? "down" : "flat",
        };
  const rotulos = (serie: number[], formatar: (v: number) => string = String) =>
    serie.map((v, i) => `${rotuloMes(meses[i])}: ${formatar(v)}`);

  // Agenda de hoje: consultas + tarefas do dia, no fuso do profissional.
  const consultasDeHoje = (atendimentosProximos ?? [])
    .map((agendamento) => ({ agendamento, ...utcInstantToZonedDateTime(agendamento.data_hora, timeZone) }))
    .filter(({ dateStr }) => dateStr === hojeStr);
  const consultasComPendencias = await Promise.all(
    consultasDeHoje.map(async ({ agendamento, dateStr, timeStr }) => ({
      agendamento,
      dateStr,
      timeStr,
      contexto: await getPatientAgendaContext(agendamento.patient_id, timeZone, {
        excludeAppointmentId: agendamento.id,
      }),
    }))
  );
  const tarefasDeHoje = (tarefasProximas ?? []).filter((t) => t.data_limite === hojeStr);
  const agendaDeHoje = [
    ...consultasComPendencias.map(({ agendamento, dateStr, timeStr, contexto }) => ({
      kind: "consulta" as const,
      key: agendamento.id,
      dateStr,
      timeStr: timeStr as string | null,
      agendamento,
      contexto,
    })),
    ...tarefasDeHoje.map((task) => ({
      kind: "tarefa" as const,
      key: task.id,
      dateStr: task.data_limite as string,
      timeStr: taskTimeLabel(task.horario),
      task,
    })),
  ].sort((a, b) => agendaItemSortKey(a).localeCompare(agendaItemSortKey(b)));

  // Última consulta dos pacientes recentes (consulta passada que não foi
  // cancelada nem falta). Depende dos ids acima, por isso vem depois.
  const idsRecentes = (pacientesRecentes ?? []).map((p) => p.id);
  const { data: consultasPassadas } = idsRecentes.length
    ? await supabase
        .from("appointments")
        .select("patient_id, data_hora")
        .in("patient_id", idsRecentes)
        .lte("data_hora", new Date().toISOString())
        .not("status", "in", "(cancelado,faltou)")
        .order("data_hora", { ascending: false })
        .returns<{ patient_id: string; data_hora: string }[]>()
    : { data: [] as { patient_id: string; data_hora: string }[] };
  const ultimaConsulta = new Map<string, string>();
  for (const c of consultasPassadas ?? []) {
    if (!ultimaConsulta.has(c.patient_id)) ultimaConsulta.set(c.patient_id, paraData(c.data_hora));
  }

  const firstName = (profile?.nome ?? "").split(" ")[0];
  const dica = dicaDoDia(hojeStr);

  // Atalhos só para destinos que existem sem escolher paciente antes (plano e
  // pagamento nascem dentro da ficha do paciente).
  const atalhos = [
    { label: "Novo paciente", href: "/pacientes/novo", icon: UserPlus },
    { label: "Abrir agenda", href: "/agenda", icon: CalendarDays },
    { label: "Nova receita", href: "/receitas/novo", icon: CookingPot },
    { label: "Financeiro", href: "/financeiro", icon: Wallet },
  ];

  // No computador (tela "desk": largura ≥ 1024 e altura ≥ 700) o painel ocupa
  // exatamente a altura disponível — 100dvh menos o topo (4rem) e o respiro do
  // <main> (3rem) — e as listas rolam por dentro. Em telas menores a página rola.
  return (
    <div className="relative desk:h-[calc(100dvh-7rem)]">
      {/* Folhas apagadas atrás do "Olá" e do botão, encostadas na barra do topo. */}
      <CornerLeaves className="absolute -top-6 right-16 hidden h-[130px] w-[300px] lg:block" />

      <div className="relative flex flex-col gap-4 desk:h-full">
        <div className="flex shrink-0 flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-[2rem] font-semibold leading-tight tracking-tight text-foreground">
              {firstName ? `Olá, ${firstName}` : "Olá"}
            </h1>
            <p className="mt-1 text-base text-muted-foreground">Aqui está um resumo da sua prática hoje.</p>
          </div>
          <Button asChild size="lg">
            <Link href="/pacientes/novo">
              <Plus className="h-4 w-4" />
              Novo paciente
            </Link>
          </Button>
        </div>

        <section aria-label="Visão geral" className="grid shrink-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Pacientes ativos"
            value={pacientesAtivos ?? 0}
            icon={Users}
            href="/pacientes"
            trend={tendenciaNovos(contarNoMes(datasPacientes, mesAtual))}
            chart={<Sparkline values={seriePacientes} pointLabels={rotulos(seriePacientes)} />}
          />
          <StatCard
            label="Meus planos alimentares"
            value={totalPlanos ?? 0}
            icon={ClipboardList}
            href="/planos"
            trend={tendenciaNovos(contarNoMes(datasPlanos, mesAtual))}
            chart={<Sparkline values={seriePlanos} pointLabels={rotulos(seriePlanos)} />}
          />
          <StatCard
            label="Minhas receitas"
            value={totalReceitas ?? 0}
            icon={CookingPot}
            href="/receitas"
            trend={tendenciaNovos(contarNoMes(datasReceitas, mesAtual))}
            chart={<Sparkline values={serieReceitas} pointLabels={rotulos(serieReceitas)} />}
          />
          <StatCard
            label="Recebido no mês"
            value={formatCurrencyBRL(recebidoNoMes)}
            icon={CircleDollarSign}
            iconTone="accent"
            href="/financeiro"
            valueClassName="text-[1.75rem]"
            trend={tendenciaRecebido}
            chart={<Sparkline values={serieRecebido} pointLabels={rotulos(serieRecebido, formatCurrencyBRL)} />}
          />
        </section>

        {/* Duas colunas quase iguais (≈51/49), como no layout de referência. */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.04fr)_minmax(0,1fr)] desk:min-h-0 desk:flex-1">
          {/* Coluna da esquerda: agenda e pacientes */}
          <div className="flex flex-col gap-4 desk:min-h-0">
            <Card className="flex flex-col desk:min-h-0 desk:flex-[3]">
              <div className="flex shrink-0 items-start justify-between gap-3 p-5 pb-3">
                <div>
                  <h2 className="text-h3 font-semibold text-foreground">Agenda de hoje</h2>
                  <p className="text-sm text-muted-foreground">Consultas e compromissos</p>
                </div>
                <Link href="/agenda" className="flex shrink-0 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
                  Ver agenda completa
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <CardContent className="px-5 pb-3 pt-0 desk:min-h-0 desk:flex-1 desk:overflow-y-auto">
                {agendaDeHoje.length > 0 ? (
                  <ul className="max-h-[440px] divide-y divide-border overflow-y-auto border-t border-border desk:max-h-none desk:overflow-visible">
                    {agendaDeHoje.map((item) => {
                      if (item.kind === "tarefa") {
                        const { task } = item;
                        return (
                          <li key={item.key}>
                            <Link
                              href={`/agenda?visao=semana&data=${item.dateStr}`}
                              className="-mx-2 flex items-center gap-4 rounded-md px-2 py-3 transition-colors hover:bg-muted/60"
                            >
                              <span className="h-2 w-2 shrink-0 rounded-full border border-foreground/50" aria-hidden />
                              <span className="w-12 shrink-0 text-sm font-medium tabular-nums text-foreground">
                                {item.timeStr ?? "—"}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-foreground">{task.titulo}</span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  Tarefa{task.patients?.nome ? ` · ${task.patients.nome}` : ""}
                                </span>
                              </span>
                              <Badge variant="neutral" className="shrink-0">
                                <CheckSquare aria-hidden />
                                Tarefa
                              </Badge>
                              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                            </Link>
                          </li>
                        );
                      }
                      const { agendamento, contexto } = item;
                      const statusMeta = APPOINTMENT_STATUS_META[agendamento.status];
                      const pendencias = contexto ? PENDENCIA_ORDEM.filter((t) => contexto.pendencias.includes(t)) : [];
                      return (
                        <li key={item.key}>
                          <Link
                            href={`/agenda?visao=semana&data=${item.dateStr}&paciente=${agendamento.patient_id}`}
                            className="-mx-2 flex items-center gap-4 rounded-md px-2 py-3 transition-colors hover:bg-muted/60"
                          >
                            <span className={`h-2 w-2 shrink-0 rounded-full ${statusMeta.dotClassName}`} aria-hidden />
                            <span className="w-12 shrink-0 text-sm font-medium tabular-nums text-foreground">{item.timeStr}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-foreground">
                                {agendamento.patients?.nome ?? "Paciente"}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {APPOINTMENT_TIPO_LABELS[agendamento.tipo]}
                              </span>
                            </span>
                            <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                              {pendencias.map((tipo) => {
                                const meta = PENDENCIA_META[tipo];
                                const Icon = meta.icon;
                                return (
                                  <Badge key={tipo} variant="warning" title={meta.label}>
                                    <Icon aria-label={meta.label} />
                                  </Badge>
                                );
                              })}
                              <Badge variant={statusMeta.badgeVariant}>{statusMeta.label}</Badge>
                            </span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <EmptyState
                    icon={CalendarDays}
                    title="Nada marcado para hoje"
                    description="Consultas e tarefas de hoje aparecem aqui."
                    className="mb-2 py-10"
                    action={
                      <Button asChild size="sm" variant="outline">
                        <Link href="/agenda">Abrir agenda</Link>
                      </Button>
                    }
                  />
                )}
              </CardContent>
            </Card>

            <Card className="flex flex-col desk:min-h-0 desk:flex-[2]">
              <div className="flex shrink-0 items-start justify-between gap-3 p-5 pb-3">
                <div>
                  <h2 className="text-h3 font-semibold text-foreground">Pacientes recentes</h2>
                  <p className="text-sm text-muted-foreground">Últimos pacientes cadastrados</p>
                </div>
                <Link href="/pacientes" className="flex shrink-0 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
                  Ver todos
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <CardContent className="px-5 pb-3 pt-0 desk:min-h-0 desk:flex-1 desk:overflow-y-auto">
                {pacientesRecentes && pacientesRecentes.length > 0 ? (
                  <div className="border-t border-border">
                    <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_4rem_1rem] gap-4 border-b border-border py-2.5 text-xs font-medium text-muted-foreground sm:grid">
                      <span>Nome</span>
                      <span>Telefone</span>
                      <span>Última consulta</span>
                      <span>Status</span>
                      <span />
                    </div>
                    <ul className="divide-y divide-border">
                      {pacientesRecentes.map((paciente) => {
                        const ultima = ultimaConsulta.get(paciente.id);
                        return (
                          <li key={paciente.id}>
                            <Link
                              href={`/pacientes/${paciente.id}`}
                              className="-mx-2 grid grid-cols-[minmax(0,1fr)_4rem_1rem] items-center gap-4 rounded-md px-2 py-3 transition-colors hover:bg-muted/60 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_4rem_1rem]"
                            >
                              <span className="flex min-w-0 items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="text-xs">{getInitials(paciente.nome)}</AvatarFallback>
                                </Avatar>
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-medium text-foreground">{paciente.nome}</span>
                                  <span className="block truncate text-xs text-muted-foreground sm:hidden">
                                    {ultima ? `Última consulta ${formatDate(ultima)}` : "Sem consultas ainda"}
                                  </span>
                                </span>
                              </span>
                              <span className="hidden truncate text-sm tabular-nums text-muted-foreground sm:block">
                                {paciente.telefone || "—"}
                              </span>
                              <span className="hidden text-sm tabular-nums text-muted-foreground sm:block">
                                {ultima ? formatDate(ultima) : "—"}
                              </span>
                              <span>
                                <Badge variant={paciente.ativo ? "success" : "neutral"}>
                                  {paciente.ativo ? "Ativo" : "Inativo"}
                                </Badge>
                              </span>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : (
                  <EmptyState
                    icon={Users}
                    title="Nenhum paciente cadastrado ainda"
                    description="Cadastre seu primeiro paciente para começar a usar a AuriNutri."
                    className="mb-2"
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

          {/* Coluna da direita: financeiro, atalhos e dica */}
          <div className="flex flex-col gap-4 desk:min-h-0">
            <Card className="shrink-0 overflow-hidden">
              <div className="flex items-center gap-3 border-b border-border bg-secondary/60 px-5 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card">
                  <HandCoins className="h-5 w-5 text-primary" aria-hidden />
                </span>
                <div>
                  <h2 className="text-h3 font-semibold text-foreground">Financeiro</h2>
                  <p className="text-xs text-muted-foreground">Balanço, pendências e despesas</p>
                </div>
              </div>
              <CardContent className="px-5 py-4">
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:divide-x sm:divide-border">
                  {/* "Recebido no mês" já está no card de cima; aqui entra o balanço. */}
                  <div
                    title={`Recebido ${formatCurrencyBRL(balanco.recebido)} − despesas pagas ${formatCurrencyBRL(balanco.despesasPagas)}, de ${formatDate(balanco.inicio)} até hoje`}
                  >
                    <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="h-2 w-2 rounded-full bg-brand-green" aria-hidden />
                      Balanço (30 dias)
                    </dt>
                    <dd
                      className={`mt-1 text-lg font-semibold tabular-nums ${balanco.saldo < 0 ? "text-destructive" : "text-foreground"}`}
                    >
                      {formatCurrencyBRL(balanco.saldo)}
                    </dd>
                  </div>
                  <div className="sm:pl-4">
                    <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
                      Pendente
                    </dt>
                    <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">{formatCurrencyBRL(totalPendente)}</dd>
                  </div>
                  <div
                    className="sm:pl-4"
                    title={`${despesasAVencerCount} ${despesasAVencerCount === 1 ? "lançamento" : "lançamentos"} nos próximos 30 dias (inclui vencidas)`}
                  >
                    <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="h-2 w-2 rounded-full bg-destructive" aria-hidden />
                      Despesas a vencer
                    </dt>
                    <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                      {formatCurrencyBRL(despesasAVencerTotal)}
                    </dd>
                  </div>
                </dl>
                <Button variant="outline" className="mt-4 w-full justify-between" asChild>
                  <Link href="/financeiro">
                    Ver detalhes do financeiro
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="shrink-0">
              <div className="px-5 pb-3 pt-4">
                <h2 className="text-h3 font-semibold text-foreground">Atalhos rápidos</h2>
              </div>
              <CardContent className="grid grid-cols-2 gap-3 px-5 pb-4 pt-0 sm:grid-cols-4">
                {atalhos.map((atalho) => (
                  <Link
                    key={atalho.href}
                    href={atalho.href}
                    className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card px-2 py-3 text-center text-xs font-medium text-foreground shadow-card transition-colors hover:border-primary-200 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <atalho.icon className="h-5 w-5 text-primary" aria-hidden />
                    {atalho.label}
                  </Link>
                ))}
              </CardContent>
            </Card>

            {/* Dica do dia: um recurso do AuriNutri por dia, com link para ele. */}
            <Link
              href={dica.href}
              className="group relative flex min-h-[170px] overflow-hidden desk:min-h-[160px] desk:flex-1 rounded-lg border border-border bg-gradient-to-br from-secondary via-card to-card shadow-card transition-colors hover:border-primary-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="relative z-10 flex max-w-[66%] flex-col justify-center gap-1.5 px-5 py-4">
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-[11px] font-medium text-primary-800 shadow-card">
                  <Lightbulb className="h-3.5 w-3.5 text-primary" aria-hidden />
                  Dica do AuriNutri
                </span>
                <p className="text-base font-semibold leading-snug text-foreground">{dica.titulo}</p>
                <p className="line-clamp-2 text-sm text-muted-foreground">{dica.texto}</p>
                <span className="flex items-center gap-1 text-sm font-medium text-primary">
                  {dica.acao}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </div>
              <Image
                src="/brand/banner-prato.jpg"
                alt=""
                width={360}
                height={360}
                className="absolute -right-12 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full object-cover shadow-md"
              />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
