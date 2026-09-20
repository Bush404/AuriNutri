import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { createClient } from "@/lib/supabase/server";

import { buildPlanPdfViewModel } from "@/lib/pdf/plan-pdf-data";
import { PlanPdfDocument } from "@/lib/pdf/plan-pdf-document";
import { buildProfissionalPdfHeaderData } from "@/lib/pdf/profissional-header";
import type { Meal, MealItem, MealPlan } from "@/lib/types/database.types";

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}

type PlanWithPatient = MealPlan & { patient_id: string; patients: { nome: string } };
type MealRow = Meal & { meal_items: MealItem[] };

export interface GeneratePlanPdfResult {
  buffer: Buffer;
  plan: PlanWithPatient;
  filename: string;
}

/**
 * Gera o PDF de um plano — usado tanto pela rota de download
 * (planos/[id]/pdf) quanto pela criação de link de compartilhamento
 * (createPlanShareLink), pra nunca duplicar essa lógica em dois lugares.
 *
 * Retorna null se o plano não existe OU não pertence ao usuário autenticado
 * (a query já é implicitamente restrita pela RLS de meal_plans).
 */
export async function generatePlanPdf(
  supabase: ReturnType<typeof createClient>,
  user: { id: string; email?: string | null },
  planId: string
): Promise<GeneratePlanPdfResult | null> {
  const { data: plan } = await supabase
    .from("meal_plans")
    .select("*, patients(nome)")
    .eq("id", planId)
    .single<PlanWithPatient>();

  if (!plan) {
    return null;
  }

  const [profissional, { data: meals }] = await Promise.all([
    buildProfissionalPdfHeaderData(supabase, user),
    supabase
      .from("meals")
      .select("*, meal_items(*)")
      .eq("meal_plan_id", planId)
      .order("ordem", { ascending: true })
      .returns<MealRow[]>(),
  ]);

  const refeicoes = (meals ?? []).map((meal) => ({
    ...meal,
    items: (meal.meal_items ?? []).slice().sort((a, b) => a.ordem - b.ordem),
  }));

  const viewModel = buildPlanPdfViewModel({
    profissional,
    pacienteNome: plan.patients.nome,
    plano: plan,
    refeicoes,
  });

  // @react-pdf/renderer tipa renderToBuffer para aceitar só um elemento
  // <Document>; PlanPdfDocument é um componente que RENDERIZA um <Document>,
  // então o cast abaixo só ajusta o tipo — o elemento real é o mesmo.
  const element = createElement(PlanPdfDocument, { data: viewModel }) as unknown as ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(element);

  const filename = `plano-${slugify(plan.patients.nome)}-${slugify(plan.nome)}.pdf`;

  return { buffer, plan, filename };
}
