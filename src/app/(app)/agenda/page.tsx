import Link from "next/link";
import { CalendarCheck2, CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Clock, UserCheck } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TIME_ZONE, todayInTimeZone, zonedWallTimeToUtc } from "@/lib/timezone";
import {
  addDays,
  addMonths,
  formatMonthLabel,
  formatWeekRangeLabel,
  getMonthGridWeeks,
  getWeekDays,
  isSameMonth,
} from "@/lib/agenda";
import {
  calcularAgendaStats,
  fimDaJanelaDeStats,
  inicioDaJanelaDeStats,
  type AgendaStatsRow,
} from "@/lib/agenda-stats";
import type { AppointmentStatus, TaskWithPatient } from "@/lib/types/database.types";
import type { PatientPickerResult } from "@/lib/actions/patients";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard, type StatTrend } from "@/components/shared/stat-card";
import { StatusFilter } from "@/components/agenda/status-filter";
import { PatientFilter } from "@/components/agenda/patient-filter";
import { AgendaBoard } from "@/components/agenda/agenda-board";
import type { AgendaAppointment } from "@/components/agenda/agenda-side-panel";

interface AgendaPageProps {
  searchParams: Promise<{ visao?: string; data?: string; status?: string; paciente?: string }>;
}

function buildHref(params: { visao: string; data: string; status?: string; paciente?: string }) {
  const search = new URLSearchParams();
  search.set("visao", params.visao);
  search.set("data", params.data);
  if (params.status) search.set("status", params.status);
  if (params.paciente) search.set("paciente", params.paciente);
  return `/agenda?${search.toString()}`;
}

function tendencia(variacao: number | null, comparacao: string): StatTrend {
  if (variacao === null) return { text: `sem base ${comparacao}`, direction: "flat" };
  return {
    text: `${variacao > 0 ? "+" : ""}${variacao}% ${comparacao}`,
    direction: variacao > 0 ? "up" : variacao < 0 ? "down" : "flat",
  };
}

export default async function AgendaPage(props: AgendaPageProps) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();

  // Sem getUser() antes: a RLS de profiles (auth.uid() = id) já devolve só o
  // perfil de quem está logado, e o layout redireciona quem não está.
  const { data: profile } = await supabase
    .from("profiles")
    .select("fuso_horario")
    .single<{ fuso_horario: string | null }>();
  const timeZone = profile?.fuso_horario || DEFAULT_TIME_ZONE;
  const view = searchParams.visao === "semana" ? "semana" : "mes";
  const todayStr = todayInTimeZone(timeZone);
  const nowIso = new Date().toISOString();
  const anchor = searchParams.data && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.data) ? searchParams.data : todayStr;
  const status = searchParams.status as AppointmentStatus | undefined;
  const weeks = view === "mes" ? getMonthGridWeeks(anchor) : [];
  const days = view === "semana" ? getWeekDays(anchor) : [];
  const visibleDays = view === "mes" ? weeks.flat() : days;
  const rangeStart = visibleDays[0];
  const rangeEndExclusive = addDays(visibleDays[visibleDays.length - 1], 1);
  const startUtc = zonedWallTimeToUtc(`${rangeStart}T00:00`, timeZone).toISOString();
  const endUtc = zonedWallTimeToUtc(`${rangeEndExclusive}T00:00`, timeZone).toISOString();

  // Dados do paciente vêm junto para o painel de detalhes (telefone, idade...).
  let query = supabase
    .from("appointments")
    .select("*, patients(nome, telefone, email, data_nascimento, sexo)")
    .gte("data_hora", startUtc)
    .lt("data_hora", endUtc)
    .order("data_hora");

  if (status) query = query.eq("status", status);
  if (searchParams.paciente) query = query.eq("patient_id", searchParams.paciente);

  // Tarefas do mesmo período (data sem fuso: comparação direta de yyyy-mm-dd).
  // O filtro de status é de consulta e não se aplica a tarefa; o de paciente sim.
  let tasksQuery = supabase
    .from("tasks")
    .select("*, patients(nome)")
    .gte("data_limite", rangeStart)
    .lt("data_limite", rangeEndExclusive)
    .order("data_limite");
  if (searchParams.paciente) tasksQuery = tasksQuery.eq("patient_id", searchParams.paciente);

  // Números do topo: sempre em relação a hoje (não seguem a navegação nem os filtros).
  const statsQuery = supabase
    .from("appointments")
    .select("data_hora, status, patient_id")
    .gte("data_hora", zonedWallTimeToUtc(`${inicioDaJanelaDeStats(todayStr)}T00:00`, timeZone).toISOString())
    .lt("data_hora", zonedWallTimeToUtc(`${fimDaJanelaDeStats(todayStr)}T00:00`, timeZone).toISOString())
    .returns<AgendaStatsRow[]>();

  // O paciente do filtro, as tarefas e os números vêm junto com as consultas, não depois.
  const [{ data: appointments, error }, { data: tasks }, { data: statsRows }, patientFilter] = await Promise.all([
    query.returns<AgendaAppointment[]>(),
    tasksQuery.returns<TaskWithPatient[]>(),
    statsQuery,
    searchParams.paciente
      ? supabase
          .from("patients")
          .select("id, nome")
          .eq("id", searchParams.paciente)
          .single<PatientPickerResult>()
          .then(({ data }) => data ?? null)
      : Promise.resolve<PatientPickerResult | null>(null),
  ]);

  const prevHref =
    view === "mes"
      ? buildHref({ visao: view, data: addMonths(anchor, -1), status, paciente: searchParams.paciente })
      : buildHref({ visao: view, data: addDays(anchor, -7), status, paciente: searchParams.paciente });
  const nextHref =
    view === "mes"
      ? buildHref({ visao: view, data: addMonths(anchor, 1), status, paciente: searchParams.paciente })
      : buildHref({ visao: view, data: addDays(anchor, 7), status, paciente: searchParams.paciente });
  const todayHref = buildHref({ visao: view, data: todayStr, status, paciente: searchParams.paciente });
  const rangeLabel = view === "mes" ? formatMonthLabel(anchor) : formatWeekRangeLabel(days);

  // O painel abre em hoje quando hoje está no período; senão no dia navegado
  // (no mês, o dia 1 quando o dia navegado é de outro mês).
  const todayVisible = view === "mes" ? isSameMonth(todayStr, anchor) : days.includes(todayStr);
  const initialSelectedDate = todayVisible
    ? todayStr
    : view === "mes"
      ? `${anchor.slice(0, 7)}-01`
      : (days.includes(anchor) ? anchor : days[0]);

  const s = calcularAgendaStats(statsRows ?? [], todayStr, nowIso, timeZone);

  const stats = (
    <section aria-label="Resumo da agenda" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Consultas hoje"
        value={s.hoje.total}
        icon={CalendarCheck2}
        trend={{
          text: `${s.hoje.confirmadas} ${s.hoje.confirmadas === 1 ? "confirmada" : "confirmadas"} · ${s.hoje.agendadas} a confirmar`,
          direction: "flat",
        }}
      />
      <StatCard
        label="Próximas hoje"
        value={s.proximasHoje}
        icon={Clock}
        trend={{ text: "até o fim do dia", direction: "flat" }}
      />
      <StatCard
        label="Consultas da semana"
        value={s.semana.total}
        icon={CalendarRange}
        trend={tendencia(s.semana.variacao, "que a semana passada")}
      />
      <StatCard
        label="Pacientes atendidos (mês)"
        value={s.atendidosMes.total}
        icon={UserCheck}
        trend={tendencia(s.atendidosMes.variacao, "que o mês anterior")}
      />
    </section>
  );

  const toolbar = (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9" asChild>
            <Link href={prevHref} aria-label="Anterior">
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9" asChild>
            <Link href={nextHref} aria-label="Próximo">
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
          <span className="ml-1 flex items-center gap-2 text-lg font-semibold capitalize text-foreground">
            <CalendarDays className="h-5 w-5 text-muted-foreground" aria-hidden />
            {rangeLabel}
          </span>
          <Button variant="ghost" size="sm" asChild>
            <Link href={todayHref}>Hoje</Link>
          </Button>
        </div>

        <Tabs value={view}>
          <TabsList className="h-10 rounded-lg border border-border bg-card p-1">
            {(
              [
                { value: "mes", label: "Mês" },
                { value: "semana", label: "Semana" },
              ] as const
            ).map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                asChild
                className="px-5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Link href={buildHref({ visao: tab.value, data: anchor, status, paciente: searchParams.paciente })}>
                  {tab.label}
                </Link>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <StatusFilter value={status ?? null} />
        <PatientFilter selected={patientFilter} />
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          Erro ao carregar a agenda: {error.message}
        </p>
      )}
    </div>
  );

  return (
    <AgendaBoard
      // Navegar (outro mês/semana) recomeça a seleção do painel.
      key={`${view}-${anchor}`}
      view={view}
      weeks={weeks}
      days={days}
      monthAnchor={anchor}
      todayStr={todayStr}
      nowIso={nowIso}
      timeZone={timeZone}
      initialSelectedDate={initialSelectedDate}
      appointments={error ? [] : (appointments ?? [])}
      tasks={tasks ?? []}
      patientFilter={patientFilter}
      stats={stats}
      toolbar={toolbar}
      footnote={
        <p className="text-xs text-muted-foreground">Horários no seu fuso ({timeZone.replace("_", " ")}).</p>
      }
    />
  );
}
