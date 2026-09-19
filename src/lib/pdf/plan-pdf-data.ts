import {
  buildFonteFooter,
  calculateMealTotals,
  calculateMealItemMacros,
  calculatePlanTotals,
  collectFontesUsadas,
  compareToGoal,
  type GoalComparison,
  type MacroTotals,
  type MealWithItems,
  type PlanMetas,
} from "@/lib/nutrition";
import type { ItemFonte, MealPlan } from "@/lib/types/database.types";

/**
 * Monta todos os dados que o PDF do plano precisa exibir. NENHUM total é
 * calculado aqui de forma independente — tudo passa pelas mesmas funções de
 * lib/nutrition.ts usadas na tela do plano (calculatePlanTotals,
 * calculateMealTotals, calculateMealItemMacros, buildFonteFooter,
 * compareToGoal). Isso é o que garante que o PDF nunca diverge da tela: se
 * um número aqui está errado, a tela também estaria, porque é o mesmo
 * código.
 *
 * Esta função é intencionalmente pura (sem I/O) para poder ser testada sem
 * precisar renderizar o PDF de verdade — ver plan-pdf-data.test.ts.
 */

export interface PlanPdfProfissional {
  nome: string;
  crn: string | null;
  crnUf: string | null;
  especialidade: string | null;
  telefone: string | null;
  endereco: string | null;
  corMarca: string | null;
  logoUrl: string | null;
  assinaturaUrl: string | null;
}

export interface PlanPdfItem {
  nomeAlimento: string;
  fonteAlimento: ItemFonte;
  quantidadeG: number;
  /** Só para item de receita — quando presente, a UI exibe porções em vez de gramas. */
  quantidadePorcoes: number | null;
  macros: MacroTotals;
}

export interface PlanPdfMeal {
  id: string;
  nome: string;
  horario: string | null;
  observacoes: string | null;
  itens: PlanPdfItem[];
  totais: MacroTotals;
}

export interface PlanPdfComparativos {
  calorias: GoalComparison | null;
  proteinas: GoalComparison | null;
  carboidratos: GoalComparison | null;
  gorduras: GoalComparison | null;
}

export interface PlanPdfViewModel {
  profissional: PlanPdfProfissional;
  pacienteNome: string;
  plano: {
    nome: string;
    dataInicio: string;
    observacoes: string | null;
  };
  refeicoes: PlanPdfMeal[];
  totais: MacroTotals;
  metas: PlanMetas;
  temMeta: boolean;
  comparativos: PlanPdfComparativos;
  fonteFooter: string | null;
  geradoEm: string;
}

export interface BuildPlanPdfViewModelInput {
  profissional: PlanPdfProfissional;
  pacienteNome: string;
  plano: Pick<
    MealPlan,
    "nome" | "data_inicio" | "observacoes" | "meta_kcal" | "meta_proteinas_g" | "meta_carboidratos_g" | "meta_gorduras_g"
  >;
  refeicoes: MealWithItems[];
}

export function buildPlanPdfViewModel({
  profissional,
  pacienteNome,
  plano,
  refeicoes,
}: BuildPlanPdfViewModelInput): PlanPdfViewModel {
  const refeicoesOrdenadas = refeicoes.slice().sort((a, b) => a.ordem - b.ordem);

  const refeicoesViewModel: PlanPdfMeal[] = refeicoesOrdenadas.map((meal) => ({
    id: meal.id,
    nome: meal.nome,
    horario: meal.horario,
    observacoes: meal.observacoes,
    itens: meal.items
      .slice()
      .sort((a, b) => a.ordem - b.ordem)
      .map((item) => ({
        nomeAlimento: item.nome_alimento,
        fonteAlimento: item.fonte_alimento,
        quantidadeG: item.quantidade_g,
        quantidadePorcoes: item.quantidade_porcoes,
        macros: calculateMealItemMacros(item),
      })),
    totais: calculateMealTotals(meal.items),
  }));

  const totais = calculatePlanTotals(refeicoes);
  const fonteFooter = buildFonteFooter(collectFontesUsadas(refeicoes));

  const temMeta = Boolean(
    plano.meta_kcal || plano.meta_proteinas_g || plano.meta_carboidratos_g || plano.meta_gorduras_g
  );

  return {
    profissional,
    pacienteNome,
    plano: {
      nome: plano.nome,
      dataInicio: plano.data_inicio,
      observacoes: plano.observacoes,
    },
    refeicoes: refeicoesViewModel,
    totais,
    metas: {
      meta_kcal: plano.meta_kcal,
      meta_proteinas_g: plano.meta_proteinas_g,
      meta_carboidratos_g: plano.meta_carboidratos_g,
      meta_gorduras_g: plano.meta_gorduras_g,
    },
    temMeta,
    comparativos: {
      calorias: compareToGoal(totais.calorias, plano.meta_kcal, "kcal", 0),
      proteinas: compareToGoal(totais.proteinas, plano.meta_proteinas_g, "g", 1),
      carboidratos: compareToGoal(totais.carboidratos, plano.meta_carboidratos_g, "g", 1),
      gorduras: compareToGoal(totais.gorduras, plano.meta_gorduras_g, "g", 1),
    },
    fonteFooter,
    geradoEm: new Date().toISOString(),
  };
}
