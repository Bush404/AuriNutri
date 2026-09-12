import Link from "next/link";
import { UserPlus, Users } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { PatientSearch } from "@/components/patients/patient-search";
import { PatientTable } from "@/components/patients/patient-table";

const PAGE_SIZE = 20;

interface PacientesPageProps {
  searchParams: { busca?: string; pagina?: string };
}

export default async function PacientesPage({ searchParams }: PacientesPageProps) {
  const supabase = createClient();
  const busca = searchParams.busca?.trim() ?? "";
  const page = Math.max(1, Number(searchParams.pagina) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("patients")
    .select("*", { count: "exact" })
    .order("nome", { ascending: true })
    .range(from, to);

  if (busca) {
    query = query.ilike("nome", `%${busca}%`);
  }

  const { data: patients, error, count } = await query;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Pacientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie os pacientes cadastrados na sua clínica.
          </p>
        </div>
        <Button asChild>
          <Link href="/pacientes/novo">
            <UserPlus className="h-4 w-4" />
            Novo paciente
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="mb-5">
            <PatientSearch defaultValue={busca} />
          </div>

          {error && <p className="text-sm text-destructive">Erro ao carregar pacientes: {error.message}</p>}

          {!error && patients && patients.length > 0 && <PatientTable patients={patients} />}

          {!error && patients && patients.length === 0 && busca && (
            <EmptyState
              icon={Users}
              title="Nenhum paciente encontrado"
              description={`Não encontramos pacientes com o nome "${busca}".`}
            />
          )}

          {!error && patients && patients.length === 0 && !busca && (
            <EmptyState
              icon={Users}
              title="Nenhum paciente cadastrado ainda"
              description="Cadastre seu primeiro paciente para começar a organizar sua rotina clínica."
              action={
                <Button asChild size="sm">
                  <Link href="/pacientes/novo">Cadastrar paciente</Link>
                </Button>
              }
            />
          )}

          {!error && patients && patients.length > 0 && (
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              totalCount={count ?? 0}
              basePath="/pacientes"
              searchParams={{ busca: searchParams.busca }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
