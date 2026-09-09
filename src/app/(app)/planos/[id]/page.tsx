import { notFound } from "next/navigation";
import { UtensilsCrossed } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { calculatePlanTotals, collectFontesUsadas, buildFonteFooter, type MealWithItems } from "@/lib/nutrition";
import type { Meal, MealItem, MealPlan } from "@/lib/types/database.types";

import { EmptyState } from "@/components/shared/empty-state";
import { MealPlanHeader } from "@/components/meal-plans/meal-plan-header";
import { DailyTotalsCard } from "@/components/meal-plans/daily-totals-card";
import { MealCard } from "@/components/meal-plans/meal-card";
import { NewMealDialog } from "@/components/meal-plans/new-meal-dialog";

type PlanWithPatient = MealPlan & { patients: { id: string; nome: string } };

export default async function PlanoDetalhePage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: plan } = await supabase
    .from("meal_plans")
    .select("*, patients(id, nome)")
    .eq("id", params.id)
    .single<PlanWithPatient>();

  if (!plan) {
    notFound();
  }

  // Os itens de refeição já trazem seu próprio snapshot nutricional
  // (nome, fonte e macros no momento em que foram adicionados), então não
  // é mais necessário (nem correto) fazer join "ao vivo" com `foods` aqui.
  type MealRow = Meal & { meal_items: MealItem[] };

  const { data: meals } = await supabase
    .from("meals")
    .select("*, meal_items(*)")
    .eq("meal_plan_id", params.id)
    .order("ordem", { ascending: true })
    .returns<MealRow[]>();

  const mealsWithItems: MealWithItems[] = (meals ?? []).map((meal) => ({
    ...meal,
    items: (meal.meal_items ?? []).slice().sort((a, b) => a.ordem - b.ordem),
  }));

  const totals = calculatePlanTotals(mealsWithItems);
  const fonteFooter = buildFonteFooter(collectFontesUsadas(mealsWithItems));
  const nextMealOrdem = mealsWithItems.length;

  return (
    <div className="space-y-6">
      <MealPlanHeader plan={plan} patientId={plan.patients.id} patientName={plan.patients.nome} />

      <DailyTotalsCard totals={totals} />

      <div className="space-y-4">
        {mealsWithItems.length > 0 ? (
          mealsWithItems.map((meal) => <MealCard key={meal.id} planId={plan.id} meal={meal} />)
        ) : (
          <EmptyState
            icon={UtensilsCrossed}
            title="Nenhuma refeição adicionada ainda"
            description="Adicione refeições como café da manhã, almoço e jantar para começar a montar o plano."
          />
        )}

        <div className="flex justify-center pt-2">
          <NewMealDialog planId={plan.id} nextOrdem={nextMealOrdem} />
        </div>
      </div>

      {fonteFooter && (
        <p className="border-t border-border pt-4 text-center text-xs text-muted-foreground">
          {fonteFooter}
        </p>
      )}
    </div>
  );
}
