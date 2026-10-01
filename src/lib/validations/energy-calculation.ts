import { z } from "zod";

import { FORMULAS } from "@/lib/energy-formulas";
import { optionalPositiveNumber, optionalText } from "@/lib/validations/patient";

/** "" (select sem escolha) vira undefined. */
const opcional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), schema.optional());

const numero = (msg: string) =>
  z.preprocess((v) => (typeof v === "string" ? v.replace(",", ".") : v), z.coerce.number({ invalid_type_error: msg }));

export const atividadeMetSchema = z.object({
  codigo: z.string().max(20).default(""),
  nome: z.string().trim().min(1, "Dê um nome à atividade").max(300),
  met: numero("Informe o MET").pipe(z.number().positive("MET deve ser maior que zero").max(30)),
  minutos: z.coerce.number().int("Minutos inteiros").positive("Informe os minutos").max(1440, "No máximo 1.440 minutos por dia"),
});

export const energyCalculationSchema = z.object({
  nome: optionalText(),
  data_calculo: z.string().min(1, "Informe a data do cálculo"),
  assessment_id: opcional(z.string().uuid()),
  peso_kg: optionalPositiveNumber(),
  altura_cm: optionalPositiveNumber(),
  massa_livre_gordura_kg: optionalPositiveNumber(),
  sexo_referencia: opcional(z.enum(["masculino", "feminino"])),
  formula: opcional(z.enum(Object.keys(FORMULAS) as [string, ...string[]])),
  nivel_eer: opcional(z.enum(["inativo", "pouco_ativo", "ativo", "muito_ativo"])),
  kcal_por_kg: optionalPositiveNumber(),
  valor_manual_kcal: optionalPositiveNumber(),
  fator_atividade: numero("Escolha o fator de atividade").pipe(z.number().positive()),
  fator_injuria: numero("Escolha o fator injúria").pipe(z.number().positive()),
  fator_injuria_label: optionalText(),
  atividades_met: z.array(atividadeMetSchema).max(30).default([]),
  // Meta de peso: negativo = perder. Zero ou vazio = sem meta.
  venta_kg: opcional(numero("Informe os kg").pipe(z.number().min(-100).max(100))),
  venta_dias: opcional(numero("Informe os dias").pipe(z.number().int("Dias inteiros").positive().max(3650))),
  adicional_gestante_kcal: opcional(numero("Informe as kcal").pipe(z.number().min(0).max(2000))),
  observacoes: optionalText(),
});

export type EnergyCalculationInput = z.input<typeof energyCalculationSchema>;
export type EnergyCalculationData = z.output<typeof energyCalculationSchema>;
