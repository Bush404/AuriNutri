import type { createClient } from "@/lib/supabase/server";
import type { Food } from "@/lib/types/database.types";
import { origemDoAlimento, type MacroTotals } from "@/lib/nutrition";
import { medidasPorAlimento } from "@/lib/food-measures-db";
import { medidaUsual } from "@/lib/household-measures";
import {
  arredondarQuantidade,
  ehIngrediente,
  gramasEquivalentes,
  macrosEm,
  mesmoEstado,
  pontuacaoSugestao,
  type CriterioEquivalencia,
} from "@/lib/substitutions";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

export interface SugestaoSubstituto {
  foodId: string;
  nome: string;
  origem: "TACO" | "USDA" | "Seu alimento";
  medida: { id: string; nome: string; gramas: number } | null;
  medidaQuantidade: number | null;
  gramas: number;
  macros: MacroTotals;
}

const MAX_SUGESTOES = 6;

/**
 * "Sugestões rápidas" (Fase 17, Bloco E): alimentos do mesmo grupo da TACO
 * (ex.: "Cereais e derivados") e no mesmo estado (cru com cru), na quantidade
 * equivalente pelo critério escolhido, os mais parecidos nos outros macros
 * primeiro. Quantidades absurdas (mais de 4× ou menos de ¼ do original) ficam
 * de fora. Recebe o alimento base já resolvido, como está no rascunho da
 * janela da refeição (Fase 19, sugerirSubstitutosRascunho).
 */
export async function sugestoesParaAlimento(
  supabase: SupabaseServer,
  base: { food_id: string; nome_alimento: string; quantidade_g: number; macros: MacroTotals },
  jaUsados: Set<string | null>,
  criterio: CriterioEquivalencia,
): Promise<SugestaoSubstituto[]> {
  const { data: original } = await supabase
    .from("foods")
    .select("categoria")
    .eq("id", base.food_id)
    .maybeSingle<{ categoria: string }>();
  if (!original) return [];

  const { data: candidatos } = await supabase
    .from("foods")
    .select("*")
    .eq("categoria", original.categoria)
    .neq("id", base.food_id)
    .limit(400)
    .returns<Food[]>();

  const gramasOriginal = Number(base.quantidade_g);

  const ranqueados = (candidatos ?? [])
    .filter(
      (f) =>
        !jaUsados.has(f.id) &&
        mesmoEstado(base.nome_alimento, f.nome) &&
        (ehIngrediente(base.nome_alimento) || !ehIngrediente(f.nome)),
    )
    .flatMap((f) => {
      const g = gramasEquivalentes(base.macros, f, criterio);
      if (g === null || g > gramasOriginal * 4 || g < gramasOriginal / 4) return [];
      const pontos = pontuacaoSugestao(
        { nome: base.nome_alimento, gramas: gramasOriginal, macros: base.macros },
        { nome: f.nome, gramas: g, macros: macrosEm(f, g) },
      );
      return [{ food: f, gramas: g, pontos }];
    })
    .sort((a, b) => a.pontos - b.pontos)
    .slice(0, MAX_SUGESTOES);

  const medidas = await medidasPorAlimento(
    supabase,
    ranqueados.map((r) => r.food.id),
  );
  return ranqueados.map(({ food, gramas }) => {
    const m = medidaUsual(medidas[food.id] ?? []);
    const arredondado = arredondarQuantidade(gramas, m ? { gramas: Number(m.gramas) } : null);
    return {
      foodId: food.id,
      nome: food.nome,
      origem: origemDoAlimento(food),
      medida: m ? { id: m.id, nome: m.nome, gramas: Number(m.gramas) } : null,
      medidaQuantidade: arredondado.medidaQuantidade,
      gramas: arredondado.gramas,
      macros: macrosEm(food, arredondado.gramas),
    };
  });
}
