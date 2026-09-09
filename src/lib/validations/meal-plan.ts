import { z } from "zod";

export const mealPlanSchema = z.object({
  nome: z.string().min(2, "Informe um nome para o plano"),
  data_inicio: z.string().min(1, "Informe a data de início"),
  observacoes: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" || v === undefined ? undefined : v)),
});
export type MealPlanInput = z.infer<typeof mealPlanSchema>;

export const mealSchema = z.object({
  nome: z.string().min(1, "Informe o nome da refeição"),
  horario: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" || v === undefined ? undefined : v)),
});
export type MealInput = z.infer<typeof mealSchema>;

export const mealItemSchema = z.object({
  food_id: z.string().min(1, "Selecione um alimento"),
  quantidade_g: z.coerce
    .number({ invalid_type_error: "Informe a quantidade" })
    .positive("A quantidade deve ser maior que zero"),
});
export type MealItemInput = z.infer<typeof mealItemSchema>;
