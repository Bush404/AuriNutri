import { z } from "zod";

/** Número opcional vindo de um <input type="number"> — "" e undefined viram "não informado". */
const optionalPositiveNumber = () =>
  z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : val),
    z.coerce.number().positive("Deve ser maior que zero").optional()
  );

export const mealPlanSchema = z.object({
  nome: z.string().min(2, "Informe um nome para o plano"),
  data_inicio: z.string().min(1, "Informe a data de início"),
  observacoes: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" || v === undefined ? undefined : v)),
  meta_kcal: optionalPositiveNumber(),
  meta_proteinas_g: optionalPositiveNumber(),
  meta_carboidratos_g: optionalPositiveNumber(),
  meta_gorduras_g: optionalPositiveNumber(),
});
export type MealPlanInput = z.infer<typeof mealPlanSchema>;

export const mealSchema = z.object({
  nome: z.string().min(1, "Informe o nome da refeição"),
  horario: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" || v === undefined ? undefined : v)),
  observacoes: z
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

/** Mesma forma de mealItemSchema — reaproveitado para substituições (food_id + quantidade). */
export const mealItemSubstitutionSchema = mealItemSchema;
export type MealItemSubstitutionInput = MealItemInput;

/** Fase 6, Bloco C — versão de mealItemSchema para adicionar uma RECEITA como item, em porções (não gramas). */
export const mealItemRecipeSchema = z.object({
  recipe_id: z.string().min(1, "Selecione uma receita"),
  quantidade_porcoes: z.coerce
    .number({ invalid_type_error: "Informe a quantidade" })
    .positive("A quantidade deve ser maior que zero"),
});
export type MealItemRecipeInput = z.infer<typeof mealItemRecipeSchema>;

export const mealTemplateNameSchema = z.object({
  nome: z.string().min(2, "Informe um nome para o template"),
});
export type MealTemplateNameInput = z.infer<typeof mealTemplateNameSchema>;
