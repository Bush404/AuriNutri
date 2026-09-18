import { z } from "zod";

const optionalText = () =>
  z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" || v === undefined ? undefined : v));

const optionalPositiveInt = () =>
  z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : val),
    z.coerce.number().int("Deve ser um número inteiro").min(0, "Não pode ser negativo").optional()
  );

/** "arroz, low carb, vegano" -> ["arroz", "low carb", "vegano"] — sem componente de chips novo. */
function parseTags(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    )
  );
}

// ETAPA 1 — Identificação
export const recipeIdentificationSchema = z.object({
  nome: z.string().min(2, "Informe o nome da receita"),
  descricao: optionalText(),
  tagsTexto: z.string().optional().default(""),
  tempo_preparo_min: optionalPositiveInt(),
  imagem_url: z.string().optional().nullable(),
});
export type RecipeIdentificationInput = z.infer<typeof recipeIdentificationSchema>;

export function tagsFromInput(input: RecipeIdentificationInput): string[] {
  return parseTags(input.tagsTexto ?? "");
}

// ETAPA 2 — Ingrediente
export const recipeIngredientSchema = z.object({
  food_id: z.string().uuid("Selecione um alimento"),
  quantidade_g: z.coerce
    .number({ invalid_type_error: "Informe a quantidade" })
    .positive("A quantidade deve ser maior que zero"),
});
export type RecipeIngredientInput = z.infer<typeof recipeIngredientSchema>;

// ETAPA 3 — Modo de preparo
export const recipeModoPreparoSchema = z.object({
  modo_preparo: optionalText(),
});
export type RecipeModoPreparoInput = z.infer<typeof recipeModoPreparoSchema>;

// ETAPA 4 — Resultado da preparação
export const recipeResultadoSchema = z.object({
  rendimento_g: z.coerce
    .number({ invalid_type_error: "Informe o peso da preparação pronta" })
    .positive("O rendimento deve ser maior que zero"),
  numero_porcoes: z.coerce
    .number({ invalid_type_error: "Informe o número de porções" })
    .int("Deve ser um número inteiro")
    .positive("O número de porções deve ser maior que zero"),
});
export type RecipeResultadoInput = z.infer<typeof recipeResultadoSchema>;

/** {campo: valor} sobrescrito manualmente — chaves são nomes de macro/micro, validadas na origem (nutrition.ts), não aqui. */
export const valoresSobrescritosSchema = z.record(z.string(), z.coerce.number());
export type ValoresSobrescritosInput = z.infer<typeof valoresSobrescritosSchema>;
