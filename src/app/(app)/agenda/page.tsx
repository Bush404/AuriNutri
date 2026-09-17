import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TIME_ZONE, todayInTimeZone, zonedWallTimeToUtc } from "@/lib/timezone";
import { addDays, addMonths, formatMonthLabel, formatWeekRangeLabel, getMonthGridWeeks, getWeekDays } from "@/lib/agenda";
import type { AppointmentStatus, AppointmentWithPatient } from "@/lib/types/database.types";
import type { PatientPickerResult } from "@/lib/actions/patients";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusFilter } from "@/components/agenda/status-filter";
import { PatientFilter } from "@/components/agenda/patient-filter";
import { AgendaBoard } from "@/components/agenda/agenda-board";

interface AgendaPageProps {
  searchParams: { visao?: string; data?: string; status?: string; paciente?: string };
}

function buildHref(params: { visao: string; data: string; status?: string; paciente?: string }) {
  const search = new URLSearchParams();
  search.set("visao", params.visao);
  search.set("data", params.data);
  if (params.status) search.set("status", params.status);
  if (params.paciente) search.set("paciente", params.paciente);
  return `/agenda?${search.toString()}`;
}

export default async function AgendaPage({ searchParams }: AgendaPageProps) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("fuso_horario")
    .eq("id", user!.id)
    .single<{ fuso_horario: string | null }>();
  const timeZone = profile?.fuso_horario || DEFAULT_TIME_ZONE;

  const view = searchParams.visao === "semana" ? "semana" : "mes";
  const todayStr = todayInTimeZone(timeZone);
  const anchor = searchParams.data && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.data) ? searchParams.data : todayStr;
  const status = searchParams.status as AppointmentStatus | undefined;

  const weeks = view === "mes" ? getMonthGridWeeks(anchor) : [];
  const days = view === "semana" ? getWeekDays(anchor) : [];
  const visibleDays = view === "mes" ? weeks.flat() : days;
  const rangeStart = visibleDays[0];
  const rangeEndExclusive = addDays(visibleDays[visibleDays.length - 1], 1);

  const startUtc = zonedWallTimeToUtc(`${rangeStart}T00:00`, timeZone).toISOString();
  const endUtc = zonedWallTimeToUtc(`${rangeEndExclusive}T00:00`, timeZone).toISOString();

  let query = supabase
    .from("appointments")
    .select("*, patients(nome)")
    .gte("data_hora", startUtc)
    .lt("data_hora", endUtc)
    .order("data_hora");

  if (status) query = query.eq("status", status);
  if (searchParams.paciente) query = query.eq("patient_id", searchParams.paciente);

  const { data: appointments, error } = await query.returns<AppointmentWithPatient[]>();

  let patientFilter: PatientPickerResult | null = null;
  if (searchParams.paciente) {
    const { data: patientRow } = await supabase
      .from("patients")
      .select("id, nome")
      .eq("id", searchParams.paciente)
      .single<PatientPickerResult>();
    patientFilter = patientRow ?? null;
  }

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Agenda</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Consultas e horários — fuso horário: {timeZone.replace("_", " ")}.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" asChild>
                <Link href={prevHref} aria-label="Anterior">
                  <ChevronLeft className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={todayHref}>Hoje</Link>
              </Button>
              <Button variant="outline" size="icon" asChild>
                <Link href={nextHref} aria-label="Próximo">
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
              <span className="ml-2 text-sm font-medium capitalize text-foreground">{rangeLabel}</span>
            </div>

            <Tabs value={view}>
              <TabsList>
                <TabsTrigger value="mes" asChild>
                  <Link href={buildHref({ visao: "mes", data: anchor, status, paciente: searchParams.paciente })}>
                    Mês
                  </Link>
                </TabsTrigger>
                <TabsTrigger value="semana" asChild>
                  <Link href={buildHref({ visao: "semana", data: anchor, status, paciente: searchParams.paciente })}>
                    Semana
                  </Link>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <StatusFilter value={status ?? null} />
            <PatientFilter selected={patientFilter} />
          </div>

          {error && <p className="text-sm text-destructive">Erro ao carregar a agenda: {error.message}</p>}

          {!error && (
            <AgendaBoard
              view={view}
              weeks={weeks}
              days={days}
              monthAnchor={anchor}
              todayStr={todayStr}
              timeZone={timeZone}
              appointments={appointments ?? []}
              patientFilter={patientFilter}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
