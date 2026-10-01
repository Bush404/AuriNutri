import { notFound } from "next/navigation";
import { UtensilsCrossed } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { calculatePlanTotals, collectFontesUsadas, buildFonteFooter } from "@/lib/nutrition";
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
import { NutrientAnalysisCard } from "@/components/meal-plans/nutrient-analysis-card";
import type { CalculoParaImportar } from "@/components/meal-plans/planejamento-dialog";

type PlanWithPatient = MealPlan & {
  patients: { id: string; nome: string; telefone: string | null; sexo: Sexo | null; data_nascimento: string | null };
};

export default async function PlanoDetalhePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();

  // Os itens de refeição já trazem seu próprio snapshot nutricional
  // (nome, fonte e macros no momento em que foram adicionados), então não
  // é mais necessário (nem correto) fazer join "ao vivo" com `foods` aqui.
  // As substituições (meal_item_substitutions) também são snapshot próprio.
  type MealRow = Meal & { meal_items: MealItemWithSubstitutions[] };

  // Tudo que depende só do id do plano vai junto, numa ida ao banco: o site
  // roda longe do banco (ver docs/ROADMAP_2.md, Fase 12), e cada busca em fila
  // soma ~0,2 s. Sem acesso ao plano, a RLS devolve as outras buscas vazias.
  const [{ data: plan }, { data: meals }, templates, shareLinks] = await Promise.all([
    supabase
      .from("meal_plans")
      .select("*, patients(id, nome, telefone, sexo, data_nascimento)")
      .eq("id", params.id)
      .single<PlanWithPatient>(),
    supabase
      .from("meals")
      .select("*, meal_items(*, meal_item_substitutions(*))")
      .eq("meal_plan_id", params.id)
      .order("ordem", { ascending: true })
      .returns<MealRow[]>(),
    listMealTemplates(),
    listPlanShareLinks(params.id),
  ]);

  if (!plan) {
    notFound();
  }

  // Peso mais recente (padrão do planejamento — avaliação recém-aberta, ainda sem
  // peso, não conta) e os cálculos energéticos salvos (Fase 16) para importar.
  const [{ data: latestAssessment }, { data: calculos }] = await Promise.all([
    supabase
      .from("anthropometric_assessments")
      .select("peso_kg")
      .eq("patient_id", plan.patients.id)
      .not("peso_kg", "is", null)
      .order("data_avaliacao", { ascending: false })
      .limit(1)
      .maybeSingle<{ peso_kg: number }>(),
    supabase
      .from("energy_calculations")
      .select("id, nome, data_calculo, get_kcal, peso_kg")
      .eq("patient_id", plan.patients.id)
      .not("get_kcal", "is", null)
      .order("data_calculo", { ascending: false })
      .order("created_at", { ascending: false })
      .returns<CalculoParaImportar[]>(),
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
  const pesoTotalG = mealsWithItems.reduce((s, m) => s + m.items.reduce((t, i) => t + Number(i.quantidade_g), 0), 0);

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

      <NutrientAnalysisCard
        planId={plan.id}
        patientId={plan.patients.id}
        plan={plan}
        totais={totals}
        pesoTotalG={pesoTotalG}
        pesoPaciente={latestAssessment?.peso_kg ?? null}
        calculos={calculos ?? []}
      />

      {fonteFooter && (
        <p className="border-t border-border pt-4 text-center text-xs text-muted-foreground">
          {fonteFooter}
        </p>
      )}
    </div>
  );
}
