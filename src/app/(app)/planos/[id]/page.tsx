import { notFound } from "next/navigation";
import { UtensilsCrossed } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { calculatePlanTotals, collectFontesUsadas, buildFonteFooter } from "@/lib/nutrition";
import { kcalPorKg } from "@/lib/meal-planning";
import type { Meal, MealItemSubstitution, MealPlan, Patient } from "@/lib/types/database.types";
import { listMealTemplates } from "@/lib/actions/meal-templates";
import { listPlanShareLinks } from "@/lib/actions/plan-share";
import { medidasDosAlimentos } from "@/lib/actions/meal-food-search";

import { EmptyState } from "@/components/shared/empty-state";
import { MealPlanActions, MealPlanTitle } from "@/components/meal-plans/meal-plan-header";
import { PatientProfileHeader } from "@/components/patients/patient-profile-header";
import { PatientTabLinks } from "@/components/patients/patient-tab-links";
import { PlanSummaryBar } from "@/components/meal-plans/plan-summary-bar";
import type { MealItemWithSubstitutions, MealWithItemsAndSubstitutions } from "@/components/meal-plans/meal-card";
import { MealList } from "@/components/meal-plans/meal-list";
import { MedidasProvider } from "@/components/meal-plans/medidas-context";
import { NewMealDialog } from "@/components/meal-plans/new-meal-dialog";
import { NewMealFromTemplateDialog } from "@/components/meal-plans/new-meal-from-template-dialog";
import { NutrientAnalysisCard } from "@/components/meal-plans/nutrient-analysis-card";
import type { CalculoParaImportar } from "@/components/meal-plans/planejamento-dialog";

type PlanWithPatient = MealPlan & {
  patients: Pick<Patient, "id" | "nome" | "telefone" | "sexo" | "data_nascimento" | "ativo" | "objetivo">;
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
      .select("*, patients(id, nome, telefone, sexo, data_nascimento, ativo, objetivo)")
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
  // peso, não conta), os cálculos energéticos salvos (Fase 16) para importar e
  // as medidas caseiras dos alimentos do plano (Fase 17, Bloco D).
  const foodIds = (meals ?? [])
    .flatMap((m) => (m.meal_items ?? []).map((i) => i.food_id))
    .filter((id): id is string => !!id);
  const [{ data: latestAssessment }, { data: calculos }, medidas] = await Promise.all([
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
    medidasDosAlimentos(foodIds),
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

  const porKg = kcalPorKg(totals.calorias, plan.planejamento_peso_kg ?? latestAssessment?.peso_kg ?? null);

  return (
    // pb-16 deixa espaço para o resumo fixo do rodapé.
    <div className="space-y-6 pb-16">
      <PatientProfileHeader
        patient={plan.patients}
        voltar={{ href: `/pacientes/${plan.patients.id}?aba=planos`, rotulo: "Voltar para os planos" }}
        acoes={
          <MealPlanActions
            plan={plan}
            patientId={plan.patients.id}
            patientName={plan.patients.nome}
            patientTelefone={plan.patients.telefone}
            patientSexo={plan.patients.sexo}
            shareLinks={shareLinks}
          />
        }
      />

      <PatientTabLinks patientId={plan.patients.id} ativa="planos" />

      <section aria-labelledby="rotina-titulo" className="space-y-5 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <MealPlanTitle plan={plan} kcal={totals.calorias} porKg={porKg} />
          <div className="flex shrink-0 flex-wrap gap-2">
            <NewMealFromTemplateDialog planId={plan.id} nextOrdem={nextMealOrdem} templates={templates} />
            <NewMealDialog planId={plan.id} nextOrdem={nextMealOrdem} />
          </div>
        </div>

        <div className="space-y-3 border-t border-border pt-4">
          <div>
            <h3 id="rotina-titulo" className="text-base font-semibold text-foreground">
              Rotina do paciente
            </h3>
            <p className="text-sm text-muted-foreground">Clique em uma refeição para visualizar ou editar os alimentos.</p>
          </div>
          {mealsWithItems.length > 0 ? (
            <MedidasProvider medidas={medidas}>
              <MealList planId={plan.id} meals={mealsWithItems} />
            </MedidasProvider>
          ) : (
            <EmptyState
              icon={UtensilsCrossed}
              title="Nenhuma refeição adicionada ainda"
              description="Adicione refeições como café da manhã, almoço e jantar para começar a montar o plano."
            />
          )}
        </div>
      </section>

      <NutrientAnalysisCard
        planId={plan.id}
        patientId={plan.patients.id}
        itens={mealsWithItems.flatMap((m) => m.items)}
        paciente={{ sexo: plan.patients.sexo, data_nascimento: plan.patients.data_nascimento }}
        plan={plan}
        totais={totals}
        pesoTotalG={pesoTotalG}
        pesoPaciente={latestAssessment?.peso_kg ?? null}
        calculos={calculos ?? []}
      />

      {fonteFooter && (
        <p className="border-t border-border pt-4 text-center text-xs text-muted-foreground">{fonteFooter}</p>
      )}

      <PlanSummaryBar
        totais={totals}
        metas={{
          meta_kcal: plan.meta_kcal,
          meta_proteinas_g: plan.meta_proteinas_g,
          meta_carboidratos_g: plan.meta_carboidratos_g,
          meta_gorduras_g: plan.meta_gorduras_g,
        }}
      />
    </div>
  );
}
