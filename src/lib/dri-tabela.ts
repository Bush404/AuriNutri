/**
 * Ingestão diária de referência (DRI) — Fase 17, Bloco F.
 *
 * GERADO a partir das tabelas-resumo oficiais (National Academies of Sciences,
 * Engineering, and Medicine. Dietary Reference Intakes for Sodium and Potassium,
 * 2019 — Appendix J: "Dietary Reference Intakes Summary Tables",
 * doi:10.17226/25353), extraídas do texto da publicação, não digitadas à mão.
 * Ver docs/FASE_17_DRI.md. Não editar os números aqui sem conferir na fonte.
 *
 * Cada linha: [recomendação, tipo ("RDA" ou "AI"), limite superior tolerável (UL)].
 * Unidades iguais às colunas da TACO (mg, mcg, g). Cobre: µg/d da tabela → mg.
 * Fósforo UL: g/d da tabela → mg. UL de magnésio, niacina e da vitamina A em RAE
 * ficam de fora de propósito (valem só para suplemento/forma sintética ou só
 * para retinol pré-formado — este vai em retinol_mcg).
 */

/** Faixas de vida da tabela (bebês < 1 ano ficam de fora). c = criança, m = masculino, f = feminino, g = gestante, l = lactante. */
export const FASES_DA_VIDA = ["c1","c4","m9","m14","m19","m31","m51","m70","f9","f14","f19","f31","f51","f70","g14","g19","g31","l14","l19","l31"] as const;
export type FaseDaVida = (typeof FASES_DA_VIDA)[number];

export type TipoReferencia = "RDA" | "AI";
type Linha = readonly [number | null, TipoReferencia | null, number | null];

export const DRI = {
  calcio_mg: [
    [700, "RDA", 2500], // c1
    [1000, "RDA", 2500], // c4
    [1300, "RDA", 3000], // m9
    [1300, "RDA", 3000], // m14
    [1000, "RDA", 2500], // m19
    [1000, "RDA", 2500], // m31
    [1000, "RDA", 2000], // m51
    [1200, "RDA", 2000], // m70
    [1300, "RDA", 3000], // f9
    [1300, "RDA", 3000], // f14
    [1000, "RDA", 2500], // f19
    [1000, "RDA", 2500], // f31
    [1200, "RDA", 2000], // f51
    [1200, "RDA", 2000], // f70
    [1300, "RDA", 3000], // g14
    [1000, "RDA", 2500], // g19
    [1000, "RDA", 2500], // g31
    [1300, "RDA", 3000], // l14
    [1000, "RDA", 2500], // l19
    [1000, "RDA", 2500], // l31
  ],
  ferro_mg: [
    [7, "RDA", 40], // c1
    [10, "RDA", 40], // c4
    [8, "RDA", 40], // m9
    [11, "RDA", 45], // m14
    [8, "RDA", 45], // m19
    [8, "RDA", 45], // m31
    [8, "RDA", 45], // m51
    [8, "RDA", 45], // m70
    [8, "RDA", 40], // f9
    [15, "RDA", 45], // f14
    [18, "RDA", 45], // f19
    [18, "RDA", 45], // f31
    [8, "RDA", 45], // f51
    [8, "RDA", 45], // f70
    [27, "RDA", 45], // g14
    [27, "RDA", 45], // g19
    [27, "RDA", 45], // g31
    [10, "RDA", 45], // l14
    [9, "RDA", 45], // l19
    [9, "RDA", 45], // l31
  ],
  magnesio_mg: [
    [80, "RDA", null], // c1
    [130, "RDA", null], // c4
    [240, "RDA", null], // m9
    [410, "RDA", null], // m14
    [400, "RDA", null], // m19
    [420, "RDA", null], // m31
    [420, "RDA", null], // m51
    [420, "RDA", null], // m70
    [240, "RDA", null], // f9
    [360, "RDA", null], // f14
    [310, "RDA", null], // f19
    [320, "RDA", null], // f31
    [320, "RDA", null], // f51
    [320, "RDA", null], // f70
    [400, "RDA", null], // g14
    [350, "RDA", null], // g19
    [360, "RDA", null], // g31
    [360, "RDA", null], // l14
    [310, "RDA", null], // l19
    [320, "RDA", null], // l31
  ],
  fosforo_mg: [
    [460, "RDA", 3000], // c1
    [500, "RDA", 3000], // c4
    [1250, "RDA", 4000], // m9
    [1250, "RDA", 4000], // m14
    [700, "RDA", 4000], // m19
    [700, "RDA", 4000], // m31
    [700, "RDA", 4000], // m51
    [700, "RDA", 3000], // m70
    [1250, "RDA", 4000], // f9
    [1250, "RDA", 4000], // f14
    [700, "RDA", 4000], // f19
    [700, "RDA", 4000], // f31
    [700, "RDA", 4000], // f51
    [700, "RDA", 3000], // f70
    [1250, "RDA", 3500], // g14
    [700, "RDA", 3500], // g19
    [700, "RDA", 3500], // g31
    [1250, "RDA", 4000], // l14
    [700, "RDA", 4000], // l19
    [700, "RDA", 4000], // l31
  ],
  zinco_mg: [
    [3, "RDA", 7], // c1
    [5, "RDA", 12], // c4
    [8, "RDA", 23], // m9
    [11, "RDA", 34], // m14
    [11, "RDA", 40], // m19
    [11, "RDA", 40], // m31
    [11, "RDA", 40], // m51
    [11, "RDA", 40], // m70
    [8, "RDA", 23], // f9
    [9, "RDA", 34], // f14
    [8, "RDA", 40], // f19
    [8, "RDA", 40], // f31
    [8, "RDA", 40], // f51
    [8, "RDA", 40], // f70
    [12, "RDA", 34], // g14
    [11, "RDA", 40], // g19
    [11, "RDA", 40], // g31
    [13, "RDA", 34], // l14
    [12, "RDA", 40], // l19
    [12, "RDA", 40], // l31
  ],
  cobre_mg: [
    [0.34, "RDA", 1], // c1
    [0.44, "RDA", 3], // c4
    [0.7, "RDA", 5], // m9
    [0.89, "RDA", 8], // m14
    [0.9, "RDA", 10], // m19
    [0.9, "RDA", 10], // m31
    [0.9, "RDA", 10], // m51
    [0.9, "RDA", 10], // m70
    [0.7, "RDA", 5], // f9
    [0.89, "RDA", 8], // f14
    [0.9, "RDA", 10], // f19
    [0.9, "RDA", 10], // f31
    [0.9, "RDA", 10], // f51
    [0.9, "RDA", 10], // f70
    [1, "RDA", 8], // g14
    [1, "RDA", 10], // g19
    [1, "RDA", 10], // g31
    [1.3, "RDA", 8], // l14
    [1.3, "RDA", 10], // l19
    [1.3, "RDA", 10], // l31
  ],
  manganes_mg: [
    [1.2, "AI", 2], // c1
    [1.5, "AI", 3], // c4
    [1.9, "AI", 6], // m9
    [2.2, "AI", 9], // m14
    [2.3, "AI", 11], // m19
    [2.3, "AI", 11], // m31
    [2.3, "AI", 11], // m51
    [2.3, "AI", 11], // m70
    [1.6, "AI", 6], // f9
    [1.6, "AI", 9], // f14
    [1.8, "AI", 11], // f19
    [1.8, "AI", 11], // f31
    [1.8, "AI", 11], // f51
    [1.8, "AI", 11], // f70
    [2, "AI", 9], // g14
    [2, "AI", 11], // g19
    [2, "AI", 11], // g31
    [2.6, "AI", 9], // l14
    [2.6, "AI", 11], // l19
    [2.6, "AI", 11], // l31
  ],
  potassio_mg: [
    [2000, "AI", null], // c1
    [2300, "AI", null], // c4
    [2500, "AI", null], // m9
    [3000, "AI", null], // m14
    [3400, "AI", null], // m19
    [3400, "AI", null], // m31
    [3400, "AI", null], // m51
    [3400, "AI", null], // m70
    [2300, "AI", null], // f9
    [2300, "AI", null], // f14
    [2600, "AI", null], // f19
    [2600, "AI", null], // f31
    [2600, "AI", null], // f51
    [2600, "AI", null], // f70
    [2600, "AI", null], // g14
    [2900, "AI", null], // g19
    [2900, "AI", null], // g31
    [2500, "AI", null], // l14
    [2800, "AI", null], // l19
    [2800, "AI", null], // l31
  ],
  sodio_mg: [
    [800, "AI", null], // c1
    [1000, "AI", null], // c4
    [1200, "AI", null], // m9
    [1500, "AI", null], // m14
    [1500, "AI", null], // m19
    [1500, "AI", null], // m31
    [1500, "AI", null], // m51
    [1500, "AI", null], // m70
    [1200, "AI", null], // f9
    [1500, "AI", null], // f14
    [1500, "AI", null], // f19
    [1500, "AI", null], // f31
    [1500, "AI", null], // f51
    [1500, "AI", null], // f70
    [1500, "AI", null], // g14
    [1500, "AI", null], // g19
    [1500, "AI", null], // g31
    [1500, "AI", null], // l14
    [1500, "AI", null], // l19
    [1500, "AI", null], // l31
  ],
  rae_mcg: [
    [300, "RDA", null], // c1
    [400, "RDA", null], // c4
    [600, "RDA", null], // m9
    [900, "RDA", null], // m14
    [900, "RDA", null], // m19
    [900, "RDA", null], // m31
    [900, "RDA", null], // m51
    [900, "RDA", null], // m70
    [600, "RDA", null], // f9
    [700, "RDA", null], // f14
    [700, "RDA", null], // f19
    [700, "RDA", null], // f31
    [700, "RDA", null], // f51
    [700, "RDA", null], // f70
    [750, "RDA", null], // g14
    [770, "RDA", null], // g19
    [770, "RDA", null], // g31
    [1200, "RDA", null], // l14
    [1300, "RDA", null], // l19
    [1300, "RDA", null], // l31
  ],
  retinol_mcg: [
    [null, null, 600], // c1
    [null, null, 900], // c4
    [null, null, 1700], // m9
    [null, null, 2800], // m14
    [null, null, 3000], // m19
    [null, null, 3000], // m31
    [null, null, 3000], // m51
    [null, null, 3000], // m70
    [null, null, 1700], // f9
    [null, null, 2800], // f14
    [null, null, 3000], // f19
    [null, null, 3000], // f31
    [null, null, 3000], // f51
    [null, null, 3000], // f70
    [null, null, 2800], // g14
    [null, null, 3000], // g19
    [null, null, 3000], // g31
    [null, null, 2800], // l14
    [null, null, 3000], // l19
    [null, null, 3000], // l31
  ],
  vitamina_c_mg: [
    [15, "RDA", 400], // c1
    [25, "RDA", 650], // c4
    [45, "RDA", 1200], // m9
    [75, "RDA", 1800], // m14
    [90, "RDA", 2000], // m19
    [90, "RDA", 2000], // m31
    [90, "RDA", 2000], // m51
    [90, "RDA", 2000], // m70
    [45, "RDA", 1200], // f9
    [65, "RDA", 1800], // f14
    [75, "RDA", 2000], // f19
    [75, "RDA", 2000], // f31
    [75, "RDA", 2000], // f51
    [75, "RDA", 2000], // f70
    [80, "RDA", 1800], // g14
    [85, "RDA", 2000], // g19
    [85, "RDA", 2000], // g31
    [115, "RDA", 1800], // l14
    [120, "RDA", 2000], // l19
    [120, "RDA", 2000], // l31
  ],
  tiamina_mg: [
    [0.5, "RDA", null], // c1
    [0.6, "RDA", null], // c4
    [0.9, "RDA", null], // m9
    [1.2, "RDA", null], // m14
    [1.2, "RDA", null], // m19
    [1.2, "RDA", null], // m31
    [1.2, "RDA", null], // m51
    [1.2, "RDA", null], // m70
    [0.9, "RDA", null], // f9
    [1, "RDA", null], // f14
    [1.1, "RDA", null], // f19
    [1.1, "RDA", null], // f31
    [1.1, "RDA", null], // f51
    [1.1, "RDA", null], // f70
    [1.4, "RDA", null], // g14
    [1.4, "RDA", null], // g19
    [1.4, "RDA", null], // g31
    [1.4, "RDA", null], // l14
    [1.4, "RDA", null], // l19
    [1.4, "RDA", null], // l31
  ],
  riboflavina_mg: [
    [0.5, "RDA", null], // c1
    [0.6, "RDA", null], // c4
    [0.9, "RDA", null], // m9
    [1.3, "RDA", null], // m14
    [1.3, "RDA", null], // m19
    [1.3, "RDA", null], // m31
    [1.3, "RDA", null], // m51
    [1.3, "RDA", null], // m70
    [0.9, "RDA", null], // f9
    [1, "RDA", null], // f14
    [1.1, "RDA", null], // f19
    [1.1, "RDA", null], // f31
    [1.1, "RDA", null], // f51
    [1.1, "RDA", null], // f70
    [1.4, "RDA", null], // g14
    [1.4, "RDA", null], // g19
    [1.4, "RDA", null], // g31
    [1.6, "RDA", null], // l14
    [1.6, "RDA", null], // l19
    [1.6, "RDA", null], // l31
  ],
  niacina_mg: [
    [6, "RDA", null], // c1
    [8, "RDA", null], // c4
    [12, "RDA", null], // m9
    [16, "RDA", null], // m14
    [16, "RDA", null], // m19
    [16, "RDA", null], // m31
    [16, "RDA", null], // m51
    [16, "RDA", null], // m70
    [12, "RDA", null], // f9
    [14, "RDA", null], // f14
    [14, "RDA", null], // f19
    [14, "RDA", null], // f31
    [14, "RDA", null], // f51
    [14, "RDA", null], // f70
    [18, "RDA", null], // g14
    [18, "RDA", null], // g19
    [18, "RDA", null], // g31
    [17, "RDA", null], // l14
    [17, "RDA", null], // l19
    [17, "RDA", null], // l31
  ],
  piridoxina_mg: [
    [0.5, "RDA", 30], // c1
    [0.6, "RDA", 40], // c4
    [1, "RDA", 60], // m9
    [1.3, "RDA", 80], // m14
    [1.3, "RDA", 100], // m19
    [1.3, "RDA", 100], // m31
    [1.7, "RDA", 100], // m51
    [1.7, "RDA", 100], // m70
    [1, "RDA", 60], // f9
    [1.2, "RDA", 80], // f14
    [1.3, "RDA", 100], // f19
    [1.3, "RDA", 100], // f31
    [1.5, "RDA", 100], // f51
    [1.5, "RDA", 100], // f70
    [1.9, "RDA", 80], // g14
    [1.9, "RDA", 100], // g19
    [1.9, "RDA", 100], // g31
    [2, "RDA", 80], // l14
    [2, "RDA", 100], // l19
    [2, "RDA", 100], // l31
  ],
  fibras_g: [
    [19, "AI", null], // c1
    [25, "AI", null], // c4
    [31, "AI", null], // m9
    [38, "AI", null], // m14
    [38, "AI", null], // m19
    [38, "AI", null], // m31
    [30, "AI", null], // m51
    [30, "AI", null], // m70
    [26, "AI", null], // f9
    [26, "AI", null], // f14
    [25, "AI", null], // f19
    [25, "AI", null], // f31
    [21, "AI", null], // f51
    [21, "AI", null], // f70
    [28, "AI", null], // g14
    [28, "AI", null], // g19
    [28, "AI", null], // g31
    [29, "AI", null], // l14
    [29, "AI", null], // l19
    [29, "AI", null], // l31
  ],
} as const satisfies Record<string, readonly Linha[]>;

export type NutrienteDri = keyof typeof DRI;
