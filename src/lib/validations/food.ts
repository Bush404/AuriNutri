import { z } from "zod";

const optionalText = () =>
  z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" || v === undefined ? undefined : v));

const optionalNonNegativeNumber = () =>
  z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : val),
    z.coerce.number().min(0, "Não pode ser negativo").optional()
  );

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

/** Grupos de micronutrientes exibidos no accordion do formulário — mesma agrupação usada lá. */
export const MICRONUTRIENTE_GRUPOS = {
  Minerais: [
    "sodio_mg",
    "calcio_mg",
    "ferro_mg",
    "magnesio_mg",
    "potassio_mg",
    "zinco_mg",
    "fosforo_mg",
    "manganes_mg",
    "cobre_mg",
  ],
  Vitaminas: [
    "retinol_mcg",
    "re_mcg",
    "rae_mcg",
    "tiamina_mg",
    "riboflavina_mg",
    "piridoxina_mg",
    "niacina_mg",
    "vitamina_c_mg",
  ],
  Lipídios: ["colesterol_mg", "gordura_saturada_g", "gordura_monoinsaturada_g", "gordura_poliinsaturada_g"],
  Outros: ["umidade_g", "cinzas_g"],
} as const;

export const MICRONUTRIENTE_LABELS = {
  sodio_mg: { label: "Sódio", unit: "mg" },
  calcio_mg: { label: "Cálcio", unit: "mg" },
  ferro_mg: { label: "Ferro", unit: "mg" },
  magnesio_mg: { label: "Magnésio", unit: "mg" },
  potassio_mg: { label: "Potássio", unit: "mg" },
  zinco_mg: { label: "Zinco", unit: "mg" },
  fosforo_mg: { label: "Fósforo", unit: "mg" },
  manganes_mg: { label: "Manganês", unit: "mg" },
  cobre_mg: { label: "Cobre", unit: "mg" },
  retinol_mcg: { label: "Retinol", unit: "mcg" },
  re_mcg: { label: "Equivalente de retinol (RE)", unit: "mcg" },
  rae_mcg: { label: "Atividade equiv. de retinol (RAE)", unit: "mcg" },
  tiamina_mg: { label: "Tiamina (B1)", unit: "mg" },
  riboflavina_mg: { label: "Riboflavina (B2)", unit: "mg" },
  piridoxina_mg: { label: "Piridoxina (B6)", unit: "mg" },
  niacina_mg: { label: "Niacina", unit: "mg" },
  vitamina_c_mg: { label: "Vitamina C", unit: "mg" },
  colesterol_mg: { label: "Colesterol", unit: "mg" },
  gordura_saturada_g: { label: "Gordura saturada", unit: "g" },
  gordura_monoinsaturada_g: { label: "Gordura monoinsaturada", unit: "g" },
  gordura_poliinsaturada_g: { label: "Gordura poliinsaturada", unit: "g" },
  umidade_g: { label: "Umidade", unit: "g" },
  cinzas_g: { label: "Cinzas", unit: "g" },
} satisfies Record<string, { label: string; unit: string }>;

export type MicronutrienteKey = keyof typeof MICRONUTRIENTE_LABELS;

/** Lista achatada das 23 chaves de micronutriente — reusada onde for preciso iterar todas. */
export const MICRONUTRIENTE_KEYS = Object.values(MICRONUTRIENTE_GRUPOS).flat() as MicronutrienteKey[];

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
  fibras_g: optionalNonNegativeNumber(),
  // Micronutrientes — todos opcionais. Vazio vira `undefined` aqui e, na
  // Server Action, `undefined` vira NULL no banco, nunca 0 (ver
  // src/lib/actions/foods.ts): 0 afirmaria "não tem", NULL diz "não sabemos".
  umidade_g: optionalNonNegativeNumber(),
  cinzas_g: optionalNonNegativeNumber(),
  colesterol_mg: optionalNonNegativeNumber(),
  calcio_mg: optionalNonNegativeNumber(),
  magnesio_mg: optionalNonNegativeNumber(),
  manganes_mg: optionalNonNegativeNumber(),
  fosforo_mg: optionalNonNegativeNumber(),
  ferro_mg: optionalNonNegativeNumber(),
  sodio_mg: optionalNonNegativeNumber(),
  potassio_mg: optionalNonNegativeNumber(),
  cobre_mg: optionalNonNegativeNumber(),
  zinco_mg: optionalNonNegativeNumber(),
  retinol_mcg: optionalNonNegativeNumber(),
  re_mcg: optionalNonNegativeNumber(),
  rae_mcg: optionalNonNegativeNumber(),
  tiamina_mg: optionalNonNegativeNumber(),
  riboflavina_mg: optionalNonNegativeNumber(),
  piridoxina_mg: optionalNonNegativeNumber(),
  niacina_mg: optionalNonNegativeNumber(),
  vitamina_c_mg: optionalNonNegativeNumber(),
  gordura_saturada_g: optionalNonNegativeNumber(),
  gordura_monoinsaturada_g: optionalNonNegativeNumber(),
  gordura_poliinsaturada_g: optionalNonNegativeNumber(),
});

export type FoodInput = z.infer<typeof foodSchema>;
