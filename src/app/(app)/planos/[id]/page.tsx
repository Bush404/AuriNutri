import { notFound } from "next/navigation";
import { UtensilsCrossed } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { calculatePlanTotals, collectFontesUsadas, buildFonteFooter } from "@/lib/nutrition";
import { calculateAge } from "@/lib/utils";
import type { Meal, MealItemSubstitution, MealPlan, Sexo } from "@/lib/types/database.types";
import { listMealTemplates } from "@/lib/actions/meal-templates";
import { listPlanShareLinks } from "@/lib/actions/plan-share";

import { EmptyState } from "@/components/shared/empty-state";
import { MealPlanHeader } from "@/components/meal-plans/meal-plan-header";
import { DailyTotalsCard } from "@/components/meal-plans/daily-totals-card";
import { MealCard, type MealWithItemsAndSubstitutions } from "@/components/meal-plans/meal-card";
import type { MealItemWithSubstitutions } from "@/components/meal-plans/meal-item-row";
import { NewMealDialog } from "@/components/meal-plans/new-meal-dialog";
import { NewMealFromTemplateDialog } from "@/components/meal-plans/new-meal-from-template-dialog";
import { EnergyCalculatorCard } from "@/components/meal-plans/energy-calculator-card";

type PlanWithPatient = MealPlan & {
  patients: { id: string; nome: string; telefone: string | null; sexo: Sexo | null; data_nascimento: string | null };
};

export default async function PlanoDetalhePage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: plan } = await supabase
    .from("meal_plans")
    .select("*, patients(id, nome, telefone, sexo, data_nascimento)")
    .eq("id", params.id)
    .single<PlanWithPatient>();

  if (!plan) {
    notFound();
  }

  const shareLinks = await listPlanShareLinks(plan.id);

  const { data: latestAssessment } = await supabase
    .from("anthropometric_assessments")
    .select("peso_kg, altura_cm")
    .eq("patient_id", plan.patients.id)
    .order("data_avaliacao", { ascending: false })
    .limit(1)
    .maybeSingle<{ peso_kg: number; altura_cm: number }>();

  // Os itens de refeição já trazem seu próprio snapshot nutricional
  // (nome, fonte e macros no momento em que foram adicionados), então não
  // é mais necessário (nem correto) fazer join "ao vivo" com `foods` aqui.
  // As substituições (meal_item_substitutions) também são snapshot próprio.
  type MealRow = Meal & { meal_items: MealItemWithSubstitutions[] };

  const [{ data: meals }, templates] = await Promise.all([
    supabase
      .from("meals")
      .select("*, meal_items(*, meal_item_substitutions(*))")
      .eq("meal_plan_id", params.id)
      .order("ordem", { ascending: true })
      .returns<MealRow[]>(),
    listMealTemplates(),
  ]);

  const mealsWithItems: MealWithItemsAndSubstitutions[] = (meals ?? []).map((meal) => ({
    ...meal,
    items: (meal.meal_items ?? [])
      .slice()
      .sort((a, b) => a.ordem - b.ordem)
      .map((item) => ({
        ...item,
        meal_item_substitutions: ((item.meal_item_substitutions ?? []) as MealItemSubstitution[])
          .slice()
          .sort((a, b) => a.ordem - b.ordem),
      })),
  }));

  const totals = calculatePlanTotals(mealsWithItems);
  const fonteFooter = buildFonteFooter(collectFontesUsadas(mealsWithItems));
  const nextMealOrdem = mealsWithItems.length;
  const idade = calculateAge(plan.patients.data_nascimento);

  return (
    <div className="space-y-6">
      <MealPlanHeader
        plan={plan}
        patientId={plan.patients.id}
        patientName={plan.patients.nome}
        patientTelefone={plan.patients.telefone}
        shareLinks={shareLinks}
      />

      <DailyTotalsCard
        totals={totals}
        metas={{
          meta_kcal: plan.meta_kcal,
          meta_proteinas_g: plan.meta_proteinas_g,
          meta_carboidratos_g: plan.meta_carboidratos_g,
          meta_gorduras_g: plan.meta_gorduras_g,
        }}
      />

      <EnergyCalculatorCard
        planId={plan.id}
        patientId={plan.patients.id}
        sexo={plan.patients.sexo}
        idade={idade}
        pesoKg={latestAssessment?.peso_kg ?? null}
        alturaCm={latestAssessment?.altura_cm ?? null}
      />

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

        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <NewMealDialog planId={plan.id} nextOrdem={nextMealOrdem} />
          <NewMealFromTemplateDialog planId={plan.id} nextOrdem={nextMealOrdem} templates={templates} />
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
