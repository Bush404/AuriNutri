import type { LabReferenceRange } from "@/lib/types/database.types";

export interface ReferenceRangeOption {
  sexo: "M" | "F";
  unidade: string;
  valor_min: number | null;
  valor_max: number | null;
  fonte: string | null;
  /** "personalizada" = faixa própria do profissional (prevalece); "global" = catálogo padrão do sistema. */
  origem: "personalizada" | "global";
}

/**
 * Restringe candidatos à faixa etária do paciente. Se a idade não bater com
 * NENHUM candidato (ex.: paciente sem data de nascimento, ou marcador só
 * tem faixa pediátrica), devolve a lista original sem filtrar — melhor
 * sugerir algo plausível do que nada, o profissional sempre pode ajustar.
 */
export function filterByAge(candidatos: LabReferenceRange[], idade: number | null): LabReferenceRange[] {
  if (idade === null) return candidatos;

  const dentroDaFaixa = candidatos.filter(
    (r) => (r.idade_min_anos === null || idade >= r.idade_min_anos) && (r.idade_max_anos === null || idade <= r.idade_max_anos)
  );

  return dentroDaFaixa.length > 0 ? dentroDaFaixa : candidatos;
}

/**
 * Escolhe a melhor faixa dentre candidatos já filtrados por
 * nome_marcador + sexo compatível (sexoBucket ou 'ambos'): a faixa
 * PESSOAL do profissional prevalece sobre a global; entre faixas de mesma
 * origem, prefere a específica por sexo em vez da genérica 'ambos'.
 */
export function pickBestReferenceRange(
  candidatos: LabReferenceRange[],
  userId: string,
  sexoBucket: "M" | "F"
): ReferenceRangeOption | null {
  if (candidatos.length === 0) return null;

  const pessoais = candidatos.filter((r) => r.user_id === userId);
  const globais = candidatos.filter((r) => r.user_id === null);
  const ordenados = [...pessoais, ...globais].sort((a, b) => Number(a.sexo === "ambos") - Number(b.sexo === "ambos"));
  const melhor = ordenados[0];
  if (!melhor) return null;

  return {
    sexo: sexoBucket,
    unidade: melhor.unidade,
    valor_min: melhor.valor_min,
    valor_max: melhor.valor_max,
    fonte: melhor.fonte,
    origem: melhor.user_id ? "personalizada" : "global",
  };
}

/**
 * Resolve a faixa sugerida para um marcador + sexo + idade, a partir de uma
 * lista de candidatos JÁ carregados do banco (filtrados por nome_marcador e
 * sexo compatível). Função pura — quem chama cuida do SELECT.
 */
export function resolveReferenceRange(
  candidatos: LabReferenceRange[],
  userId: string,
  sexoBucket: "M" | "F",
  idade: number | null
): ReferenceRangeOption | null {
  const pool = filterByAge(candidatos, idade);
  return pickBestReferenceRange(pool, userId, sexoBucket);
}
