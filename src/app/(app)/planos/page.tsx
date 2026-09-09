import Link from "next/link";
import { ClipboardList, ChevronRight } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";

export default async function PlanosPage() {
  const supabase = createClient();

  const { data: plans } = await supabase
    .from("meal_plans")
    .select("*, patients(nome)")
    .order("created_at", { ascending: false })
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
