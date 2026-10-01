/**
 * Junta um cálculo energético salvo (ou o formulário dele) com o cadastro do
 * paciente e devolve TMB e GET. Usado ao vivo na tela e no servidor, que
 * grava o resultado como foto do momento (ver migration 0042).
 */

import { idadeNaData } from "@/lib/anthropometry";
import { sexoDasFormulas } from "@/lib/anthropometry-results";
import {
  ajusteVenta,
  calcularFormula,
  calcularGETFinal,
  FORMULAS,
  type DadosEnergia,
  type FormulaEnergia,
  type ResultadoFormula,
} from "@/lib/energy-formulas";
import { idadeEmMeses } from "@/lib/growth/growth";
import type { AtividadeMet, EnergyCalculation, Patient } from "@/lib/types/database.types";

export type EntradasCalculo = Pick<
  EnergyCalculation,
  | "data_calculo"
  | "peso_kg"
  | "altura_cm"
  | "massa_livre_gordura_kg"
  | "sexo_referencia"
  | "formula"
  | "nivel_eer"
  | "kcal_por_kg"
  | "valor_manual_kcal"
  | "fator_atividade"
  | "fator_injuria"
  | "atividades_met"
  | "venta_kg"
  | "venta_dias"
  | "adicional_gestante_kcal"
>;

export const ehFormula = (f: string | null | undefined): f is FormulaEnergia => !!f && f in FORMULAS;

/** kcal/dia de uma atividade: MET × peso (kg) × horas por dia (1 MET ≈ 1 kcal/kg/h). */
export function kcalAtividade(a: Pick<AtividadeMet, "met" | "minutos">, pesoKg: number | null): number {
  if (!pesoKg || !a.met || !a.minutos) return 0;
  return a.met * pesoKg * (a.minutos / 60);
}

export interface Adicionais {
  met: number;
  venta: number;
  gestante: number;
  total: number;
}

export function adicionaisDoCalculo(e: EntradasCalculo): Adicionais {
  const met = (e.atividades_met ?? []).reduce((s, a) => s + kcalAtividade(a, e.peso_kg), 0);
  const venta = e.venta_kg && e.venta_dias ? ajusteVenta(e.venta_kg, e.venta_dias) : 0;
  const gestante = e.adicional_gestante_kcal ?? 0;
  return { met, venta, gestante, total: met + venta + gestante };
}

/**
 * Dados para as fórmulas. `null` com o motivo quando falta algo do cadastro
 * (data de nascimento) ou a base das fórmulas.
 */
export function dadosDoCalculo(
  e: EntradasCalculo,
  paciente: Pick<Patient, "sexo" | "data_nascimento">
): { dados: DadosEnergia } | { motivo: string } {
  const sexo = sexoDasFormulas(paciente.sexo, e.sexo_referencia);
  if (!sexo) return { motivo: "Escolha a base (masculino ou feminino) para as fórmulas." };
  const idadeAnos = idadeNaData(paciente.data_nascimento, e.data_calculo);
  const meses = idadeEmMeses(paciente.data_nascimento, e.data_calculo);
  if (idadeAnos === null || meses === null) return { motivo: "Cadastre a data de nascimento do paciente." };
  return {
    dados: {
      sexo,
      idadeAnos,
      idadeMeses: Math.floor(meses),
      pesoKg: e.peso_kg,
      alturaCm: e.altura_cm,
      mlgKg: e.massa_livre_gordura_kg,
      nivelEER: e.nivel_eer,
      kcalPorKg: e.kcal_por_kg,
      valorManual: e.valor_manual_kcal,
    },
  };
}

export interface ResultadoCalculo {
  /** Motivo de não haver resultado (dado faltando, fórmula fora da idade...). */
  motivo: string | null;
  tmb: number | null;
  get: number | null;
  adicionais: Adicionais;
}

export function resultadoDoCalculo(e: EntradasCalculo, paciente: Pick<Patient, "sexo" | "data_nascimento">): ResultadoCalculo {
  const adicionais = adicionaisDoCalculo(e);
  const vazio = (motivo: string): ResultadoCalculo => ({ motivo, tmb: null, get: null, adicionais });
  if (!ehFormula(e.formula)) return vazio("Escolha a fórmula.");
  const d = dadosDoCalculo(e, paciente);
  if ("motivo" in d) return vazio(d.motivo);
  const r: ResultadoFormula = calcularFormula(e.formula, d.dados);
  if (!r.ok) return vazio(r.motivo);
  const final = calcularGETFinal(r, { atividade: e.fator_atividade, injuria: e.fator_injuria }, adicionais.total);
  return { motivo: null, tmb: final.tmb, get: final.get, adicionais };
}
