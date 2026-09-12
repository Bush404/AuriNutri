import Link from "next/link";
import { ClipboardList, ChevronRight } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";

const PAGE_SIZE = 20;

interface PlanosPageProps {
  searchParams: { pagina?: string };
}

export default async function PlanosPage({ searchParams }: PlanosPageProps) {
  const supabase = createClient();
  const page = Math.max(1, Number(searchParams.pagina) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: plans, count } = await supabase
    .from("meal_plans")
    .select("*, patients(nome)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to)
    .returns<
      Array<{
        id: string;
        nome: string;
        data_inicio: string;
        ativo: boolean;
        patients: { nome: string } | null;
      }>
    >();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Planos Alimentares</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Todos os planos alimentares criados para os seus pacientes.
        </p>
      </div>

      {plans && plans.length > 0 ? (
        <div className="space-y-3">
          {plans.map((plan) => (
            <Link key={plan.id} href={`/planos/${plan.id}`}>
              <Card className="transition-shadow hover:shadow-card">
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{plan.nome}</p>
                      <Badge variant={plan.ativo ? "success" : "outline"}>
                        {plan.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {plan.patients?.nome ?? "Paciente removido"} · Início em {formatDate(plan.data_inicio)}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            totalCount={count ?? 0}
            basePath="/planos"
            searchParams={{}}
          />
        </div>
      ) : (
        <EmptyState
          icon={ClipboardList}
          title="Nenhum plano alimentar criado ainda"
          description="Acesse o perfil de um paciente para criar o primeiro plano alimentar."
        />
      )}
    </div>
  );
}
