import { z } from "zod";

const optionalText = () =>
  z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" || v === undefined ? undefined : v));

export const CATEGORIAS_ALIMENTOS = [
  "Cereais e grãos",
  "Frutas",
  "Vegetais e legumes",
  "Carnes e ovos",
  "Laticínios",
  "Leguminosas",
  "Oleaginosas e sementes",
  "Óleos e gorduras",
  "Pães e massas",
  "Bebidas",
  "Suplementos",
  "Doces e sobremesas",
  "Outros",
] as const;

export const foodSchema = z.object({
  nome: z.string().min(2, "Informe o nome do alimento"),
  categoria: z.string().min(1, "Selecione uma categoria"),
  marca: optionalText(),
  porcao_referencia_g: z.coerce
    .number({ invalid_type_error: "Informe a porção de referência" })
    .positive("A porção deve ser maior que zero"),
  calorias_kcal: z.coerce.number({ invalid_type_error: "Informe as calorias" }).min(0, "Não pode ser negativo"),
  proteinas_g: z.coerce.number({ invalid_type_error: "Informe as proteínas" }).min(0, "Não pode ser negativo"),
  carboidratos_g: z.coerce
    .number({ invalid_type_error: "Informe os carboidratos" })
    .min(0, "Não pode ser negativo"),
  gorduras_g: z.coerce.number({ invalid_type_error: "Informe as gorduras" }).min(0, "Não pode ser negativo"),
  fibras_g: z.coerce.number().min(0, "Não pode ser negativo").optional(),
});

export type FoodInput = z.infer<typeof foodSchema>;
