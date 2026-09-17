/**
 * Cálculo de gasto energético (TMB + fator de atividade).
 *
 * As equações só têm coeficientes publicados para "masculino" e "feminino"
 * — por isso `SexoParaFormula` deliberadamente NÃO aceita "outro". Um
 * paciente cadastrado com sexo "outro" (ou sem sexo informado) não pode ter
 * uma base assumida silenciosamente; a camada que chama este módulo deve
 * pedir ao profissional para escolher qual base usar (masculino/feminino)
 * ou permitir a entrada manual do GET, sem passar por aqui.
 */

export type SexoParaFormula = "masculino" | "feminino";
export type FormulaTMB = "mifflin_st_jeor" | "harris_benedict";

export const FORMULA_LABELS: Record<FormulaTMB, string> = {
  mifflin_st_jeor: "Mifflin-St Jeor",
  harris_benedict: "Harris-Benedict",
};

export type NivelAtividade = "sedentario" | "leve" | "moderado" | "intenso" | "muito_intenso";

/** Fatores de atividade física padrão, aplicados sobre a TMB para obter o GET. */
export const FATORES_ATIVIDADE: Record<NivelAtividade, number> = {
  sedentario: 1.2,
  leve: 1.375,
  moderado: 1.55,
  intenso: 1.725,
  muito_intenso: 1.9,
};

export const ATIVIDADE_LABELS: Record<NivelAtividade, string> = {
  sedentario: "Sedentário (pouco ou nenhum exercício)",
  leve: "Levemente ativo (exercício leve, 1 a 3x/semana)",
  moderado: "Moderadamente ativo (exercício moderado, 3 a 5x/semana)",
  intenso: "Muito ativo (exercício intenso, 6 a 7x/semana)",
  muito_intenso: "Extremamente ativo (exercício muito intenso ou trabalho físico)",
};

export interface CalcularTMBInput {
  pesoKg: number;
  alturaCm: number;
  idade: number;
  sexo: SexoParaFormula;
  formula?: FormulaTMB;
}

/**
 * Taxa Metabólica Basal (TMB), em kcal/dia.
 *
 * Mifflin-St Jeor (padrão, mais precisa para a população geral atual):
 *   homem:   10×peso + 6,25×altura − 5×idade + 5
 *   mulher:  10×peso + 6,25×altura − 5×idade − 161
 *
 * Harris-Benedict (equação original de 1919, alternativa selecionável):
 *   homem:   66,5 + 13,75×peso + 5,003×altura − 6,75×idade
 *   mulher:  655,1 + 9,563×peso + 1,850×altura − 4,676×idade
 */
export function calcularTMB({ pesoKg, alturaCm, idade, sexo, formula = "mifflin_st_jeor" }: CalcularTMBInput): number {
  if (formula === "harris_benedict") {
    return sexo === "masculino"
      ? 66.5 + 13.75 * pesoKg + 5.003 * alturaCm - 6.75 * idade
      : 655.1 + 9.563 * pesoKg + 1.85 * alturaCm - 4.676 * idade;
  }

  const base = 10 * pesoKg + 6.25 * alturaCm - 5 * idade;
  return sexo === "masculino" ? base + 5 : base - 161;
}

/** Gasto Energético Total (GET), em kcal/dia: TMB × fator de atividade física. */
export function calcularGET(tmb: number, nivelAtividade: NivelAtividade): number {
  return tmb * FATORES_ATIVIDADE[nivelAtividade];
}
