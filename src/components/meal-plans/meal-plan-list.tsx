import Link from "next/link";
import { ClipboardList, ChevronRight, Plus } from "lucide-react";

import type { MealPlan } from "@/lib/types/database.types";
import { formatDate } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { NewMealPlanDialog } from "@/components/meal-plans/new-meal-plan-dialog";

export function MealPlanList({ patientId, mealPlans }: { patientId: string; mealPlans: MealPlan[] }) {
  if (mealPlans.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Nenhum plano alimentar criado ainda"
        description="Monte o primeiro plano alimentar deste paciente, com refeições e cálculo automático de macros."
        action={
          <NewMealPlanDialog
            patientId={patientId}
            trigger={
              <Button size="sm">
                <Plus className="h-4 w-4" />
                Criar plano alimentar
              </Button>
            }
          />
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <NewMealPlanDialog
          patientId={patientId}
          trigger={
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Novo plano
            </Button>
          }
        />
      </div>

      <div className="space-y-3">
        {mealPlans.map((plan) => (
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
                    Início em {formatDate(plan.data_inicio)}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
