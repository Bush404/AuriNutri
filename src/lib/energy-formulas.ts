/**
 * Fórmulas de gasto energético da Fase 16 (lista aprovada em docs/FASE_16_FORMULAS.md).
 *
 * Cada coeficiente foi conferido na publicação original ou em documento
 * oficial (ver "Fontes conferidas" no mesmo arquivo) — não vem de memória.
 *
 * Dois tipos de fórmula:
 *  - as de TMB (taxa metabólica basal), que depois recebem o fator de
 *    atividade e o fator injúria;
 *  - as EER (IOM 2005 e 2023), que já dão o GET com o nível de atividade
 *    dentro da equação — nelas os fatores da tela não se aplicam.
 *
 * Como em src/lib/energy.ts, o sexo é sempre "masculino" | "feminino": um
 * paciente "outro" ou sem sexo tem a base escolhida pelo profissional.
 */

import type { SexoParaFormula } from "@/lib/energy";

/** 1 MJ em kcal (1 kcal = 4,184 kJ). Henry e Henry & Rees são publicadas em MJ/dia. */
const KCAL_POR_MJ = 1000 / 4.184;

export type FormulaEnergia =
  | "harris_benedict_1919"
  | "harris_benedict_1984"
  | "fao_oms_2004"
  | "eer_iom_2005"
  | "eer_2023"
  | "katch_mcardle"
  | "cunningham"
  | "mifflin_st_jeor"
  | "mifflin_st_jeor_mlg"
  | "henry_rees_1991"
  | "henry_oxford_2005"
  | "tinsley_peso"
  | "tinsley_mlg"
  | "schofield_1985"
  | "formula_de_bolso"
  | "tmb_manual"
  | "get_manual";

/** Nível de atividade das EER (categorias de PAL da IOM/National Academies). */
export type NivelEER = "inativo" | "pouco_ativo" | "ativo" | "muito_ativo";

export const NIVEL_EER_LABELS: Record<NivelEER, string> = {
  inativo: "Inativo / sedentário",
  pouco_ativo: "Pouco ativo",
  ativo: "Ativo",
  muito_ativo: "Muito ativo",
};

export interface DadosEnergia {
  sexo: SexoParaFormula;
  /** Anos completos na data do cálculo. */
  idadeAnos: number;
  /** Meses completos na data do cálculo (bebês e crianças pequenas). */
  idadeMeses: number;
  pesoKg: number | null;
  alturaCm: number | null;
  /** Massa livre de gordura (kg), da antropometria. */
  mlgKg: number | null;
  /** Só nas EER a partir de 3 anos. */
  nivelEER?: NivelEER | null;
  /** Fórmula de bolso: kcal por kg de peso. */
  kcalPorKg?: number | null;
  /** TMB ou GET digitados à mão. */
  valorManual?: number | null;
}

/** `tipo` diz se o valor é TMB (recebe fatores) ou já é o GET. */
export type ResultadoFormula =
  | { ok: true; tipo: "tmb" | "get"; kcal: number }
  | { ok: false; motivo: string };

export interface InfoFormula {
  label: string;
  /** Quem pode usar: adultos, crianças ou os dois (as que têm faixas para todas as idades). */
  publico: "adultos" | "criancas" | "todos";
  usa: string;
  referencia: string;
  /** Texto de "Ver referências". */
  sobre: string;
}

export const FORMULAS: Record<FormulaEnergia, InfoFormula> = {
  harris_benedict_1919: {
    label: "Harris-Benedict (1919)",
    publico: "adultos",
    usa: "peso, altura, idade e sexo",
    referencia: "Harris JA, Benedict FG. A biometric study of basal metabolism in man. Carnegie Institution, 1919.",
    sobre:
      "Equação original. Funciona bem para pessoas de composição corporal média; em pessoas muito magras, com muita gordura ou muito musculosas o resultado pode ser pouco preciso, porque não considera a composição corporal.",
  },
  harris_benedict_1984: {
    label: "Harris-Benedict (1984)",
    publico: "adultos",
    usa: "peso, altura, idade e sexo",
    referencia: "Roza AM, Shizgal HM. Am J Clin Nutr 1984;40:168-82.",
    sobre:
      "Revisão de Roza e Shizgal da equação de 1919, com uma amostra maior e mais equilibrada entre os sexos. Mesmas limitações quanto à composição corporal.",
  },
  fao_oms_2004: {
    label: "FAO/OMS (2004)",
    publico: "todos",
    usa: "peso, idade e sexo",
    referencia: "FAO/WHO/UNU. Human energy requirements, 2004 (Tabela 5.2; equações de Schofield, 1985).",
    sobre:
      "Equações por faixa de idade (de bebês a idosos) usadas pela FAO/OMS. Usam só o peso. A amostra original tem muitos dados antigos de populações europeias, e as equações tendem a superestimar a TMB em populações tropicais.",
  },
  eer_iom_2005: {
    label: "EER/IOM (2005)",
    publico: "todos",
    usa: "peso, altura, idade, sexo e nível de atividade",
    referencia: "Institute of Medicine. Dietary Reference Intakes for Energy, Carbohydrate, Fiber, Fat... 2002/2005.",
    sobre:
      "Necessidade energética estimada (EER) das DRIs: já dá o gasto energético total, com o nível de atividade dentro da equação. Para crianças, inclui o custo do crescimento. O fator de atividade e o fator injúria da tela não se aplicam.",
  },
  eer_2023: {
    label: "EER (2023)",
    publico: "todos",
    usa: "peso, altura, idade, sexo e nível de atividade",
    referencia: "National Academies of Sciences, Engineering, and Medicine. Dietary Reference Intakes for Energy, 2023.",
    sobre:
      "Atualização das DRIs de energia com dados de água duplamente marcada de populações mais diversas, incluindo pessoas com sobrepeso, obesidade e doenças crônicas. Já dá o gasto energético total; os fatores da tela não se aplicam. De 0 a 2 anos não usa nível de atividade.",
  },
  katch_mcardle: {
    label: "Katch-McArdle (1996)",
    publico: "adultos",
    usa: "massa livre de gordura",
    referencia: "McArdle WD, Katch FI, Katch VL. Exercise Physiology, 1996.",
    sobre:
      "Usa só a massa livre de gordura, por isso considera a composição corporal. Indicada para quem foge da média (pessoas musculosas ou com muita gordura).",
  },
  cunningham: {
    label: "Cunningham (1980)",
    publico: "adultos",
    usa: "massa livre de gordura",
    referencia: "Cunningham JJ. Am J Clin Nutr 1980;33:2372-4.",
    sobre:
      "Usa só a massa livre de gordura. Muito usada para atletas e praticantes de atividade física.",
  },
  mifflin_st_jeor: {
    label: "Mifflin-St Jeor (1990)",
    publico: "adultos",
    usa: "peso, altura, idade e sexo",
    referencia: "Mifflin MD, St Jeor ST, et al. Am J Clin Nutr 1990;51:241-7.",
    sobre:
      "Feita com adultos de peso normal e com obesidade. Em revisões, foi a que mais vezes acertou a TMB medida dentro de 10%.",
  },
  mifflin_st_jeor_mlg: {
    label: "Mifflin-St Jeor por MLG (1990)",
    publico: "adultos",
    usa: "massa livre de gordura",
    referencia: "Mifflin MD, St Jeor ST, et al. Am J Clin Nutr 1990;51:241-7.",
    sobre: "Equação do mesmo artigo que usa só a massa livre de gordura (o melhor preditor isolado no estudo).",
  },
  henry_rees_1991: {
    label: "Henry & Rees (1991)",
    publico: "todos",
    usa: "peso, idade e sexo",
    referencia: "Henry CJK, Rees DG. Eur J Clin Nutr 1991;45:177-85.",
    sobre:
      "Feita com populações de clima tropical, onde as equações da FAO/OMS costumam superestimar a TMB. Tem faixas de 3 a 60 anos.",
  },
  henry_oxford_2005: {
    label: "Henry/Oxford (2005)",
    publico: "todos",
    usa: "peso, altura, idade e sexo",
    referencia: "Henry CJK. Public Health Nutr 2005;8:1133-52 (via SACN, 2011, Tabela 18).",
    sobre:
      "Equações de Oxford, de um banco de cerca de 10 mil medidas de vários países, com menos peso dos dados antigos. Adotadas no Reino Unido (SACN, 2011). Costumam dar valores um pouco menores que a FAO/OMS.",
  },
  tinsley_peso: {
    label: "Tinsley — por peso (2018)",
    publico: "adultos",
    usa: "peso",
    referencia: "Tinsley GM, Graybeal AJ, Moore ML. Appl Physiol Nutr Metab 2019;44:397-406.",
    sobre: "Feita com atletas de fisiculturismo (homens e mulheres). Indicada para pessoas muito musculosas.",
  },
  tinsley_mlg: {
    label: "Tinsley — por MLG (2018)",
    publico: "adultos",
    usa: "massa livre de gordura",
    referencia: "Tinsley GM, Graybeal AJ, Moore ML. Appl Physiol Nutr Metab 2019;44:397-406.",
    sobre: "Mesma amostra de fisiculturistas, usando a massa livre de gordura.",
  },
  schofield_1985: {
    label: "Schofield (1985) — peso e altura",
    publico: "criancas",
    usa: "peso, altura, idade e sexo",
    referencia: "Schofield WN. Hum Nutr Clin Nutr 1985;39 Suppl 1:5-41.",
    sobre:
      "Versão de Schofield com peso e altura, para 0 a 18 anos (a versão só com peso é a da FAO/OMS). É a recomendada pela ESPGHAN para crianças menores de 10 anos.",
  },
  formula_de_bolso: {
    label: "GET por fórmula de bolso",
    publico: "todos",
    usa: "peso e kcal por kg",
    referencia: "—",
    sobre: "O profissional define as kcal por kg de peso; o resultado já é o gasto energético total.",
  },
  tmb_manual: {
    label: "Colocar TMB manualmente",
    publico: "todos",
    usa: "TMB digitada",
    referencia: "—",
    sobre: "Para TMB medida (calorimetria) ou calculada fora daqui. Recebe o fator de atividade e o fator injúria.",
  },
  get_manual: {
    label: "Colocar GET manualmente",
    publico: "todos",
    usa: "GET digitado",
    referencia: "—",
    sobre: "O gasto energético total definido pelo profissional.",
  },
};

const precisa = (motivo: string): ResultadoFormula => ({ ok: false, motivo });
const tmb = (kcal: number): ResultadoFormula => ({ ok: true, tipo: "tmb", kcal });
const get = (kcal: number): ResultadoFormula => ({ ok: true, tipo: "get", kcal });

const ADULTO = 18;
const SO_ADULTOS = "Fórmula para adultos (18 anos ou mais).";

/** Faixas [a partir de, até antes de) em anos, como nas tabelas originais. */
function faixa<T>(idade: number, linhas: [number, number, T][]): T | null {
  return linhas.find(([de, ate]) => idade >= de && idade < ate)?.[2] ?? null;
}

// FAO/WHO/UNU 2004, Tabela 5.2 (kcal/dia = a × peso + b).
const FAO: Record<SexoParaFormula, [number, number, [number, number]][]> = {
  masculino: [
    [0, 3, [59.512, -30.4]],
    [3, 10, [22.706, 504.3]],
    [10, 18, [17.686, 658.2]],
    [18, 30, [15.057, 692.2]],
    [30, 60, [11.472, 873.1]],
    [60, Infinity, [11.711, 587.7]],
  ],
  feminino: [
    [0, 3, [58.317, -31.1]],
    [3, 10, [20.315, 485.9]],
    [10, 18, [13.384, 692.6]],
    [18, 30, [14.818, 486.6]],
    [30, 60, [8.126, 845.6]],
    [60, Infinity, [9.082, 658.5]],
  ],
};

// Schofield 1985 com peso e altura (kcal/dia = a × peso + b × altura em m + c).
const SCHOFIELD_PA: Record<SexoParaFormula, [number, number, [number, number, number]][]> = {
  masculino: [
    [0, 3, [0.167, 1517.4, -617.6]],
    [3, 10, [19.6, 130.3, 414.9]],
    [10, 18, [16.25, 137.2, 515.5]],
  ],
  feminino: [
    [0, 3, [16.25, 1023.2, -413.5]],
    [3, 10, [16.97, 161.8, 371.2]],
    [10, 18, [8.365, 465, 200]],
  ],
};

// Henry & Rees 1991 (MJ/dia = a × peso + b). Sem faixas abaixo de 3 nem a partir de 60 anos.
const HENRY_REES: Record<SexoParaFormula, [number, number, [number, number]][]> = {
  masculino: [
    [3, 10, [0.113, 1.689]],
    [10, 18, [0.084, 2.122]],
    [18, 30, [0.056, 2.8]],
    [30, 60, [0.046, 3.16]],
  ],
  feminino: [
    [3, 10, [0.063, 2.466]],
    [10, 18, [0.047, 2.951]],
    [18, 30, [0.048, 2.562]],
    [30, 60, [0.048, 2.448]],
  ],
};

// Henry/Oxford 2005 com peso e altura — SACN 2011, Tabela 18 (MJ/dia = a × peso + b × altura em m + c).
const HENRY_OXFORD: Record<SexoParaFormula, [number, number, [number, number, number]][]> = {
  masculino: [
    [0, 3, [0.118, 3.59, -1.55]],
    [3, 10, [0.0632, 1.31, 1.28]],
    [10, 18, [0.0651, 1.11, 1.25]],
    [18, 30, [0.06, 1.31, 0.473]],
    [30, 60, [0.0476, 2.26, -0.574]],
    [60, Infinity, [0.0478, 2.26, -1.07]],
  ],
  feminino: [
    [0, 3, [0.127, 2.94, -1.2]],
    [3, 10, [0.0666, 0.878, 1.46]],
    [10, 18, [0.0393, 1.04, 1.93]],
    [18, 30, [0.0433, 2.57, -1.18]],
    [30, 60, [0.0342, 2.1, -0.0486]],
    [60, Infinity, [0.0356, 1.76, 0.0448]],
  ],
};

// EER/IOM 2005 — coeficientes de atividade (PA) por grupo.
const PA_IOM_ADULTO: Record<SexoParaFormula, Record<NivelEER, number>> = {
  masculino: { inativo: 1, pouco_ativo: 1.11, ativo: 1.25, muito_ativo: 1.48 },
  feminino: { inativo: 1, pouco_ativo: 1.12, ativo: 1.27, muito_ativo: 1.45 },
};
const PA_IOM_CRIANCA: Record<SexoParaFormula, Record<NivelEER, number>> = {
  masculino: { inativo: 1, pouco_ativo: 1.13, ativo: 1.26, muito_ativo: 1.42 },
  feminino: { inativo: 1, pouco_ativo: 1.16, ativo: 1.31, muito_ativo: 1.56 },
};

function eerIom2005(d: DadosEnergia, peso: number, alturaM: number | null): ResultadoFormula {
  const { sexo, idadeAnos: idade, idadeMeses: meses } = d;
  if (meses < 36) {
    // 0–35 meses: (89 × peso − 100) + energia de depósito.
    const deposito = meses <= 3 ? 175 : meses <= 6 ? 56 : meses <= 12 ? 22 : 20;
    return get(89 * peso - 100 + deposito);
  }
  if (alturaM === null) return precisa("Informe a altura.");
  if (!d.nivelEER) return precisa("Escolha o nível de atividade da EER.");
  if (idade < 19) {
    const pa = PA_IOM_CRIANCA[sexo][d.nivelEER];
    const crescimento = idade <= 8 ? 20 : 25;
    return get(
      sexo === "masculino"
        ? 88.5 - 61.9 * idade + pa * (26.7 * peso + 903 * alturaM) + crescimento
        : 135.3 - 30.8 * idade + pa * (10 * peso + 934 * alturaM) + crescimento
    );
  }
  const pa = PA_IOM_ADULTO[sexo][d.nivelEER];
  return get(
    sexo === "masculino"
      ? 662 - 9.53 * idade + pa * (15.91 * peso + 539.6 * alturaM)
      : 354 - 6.91 * idade + pa * (9.36 * peso + 726 * alturaM)
  );
}

// EER 2023 — National Academies, Tabelas S-1/S-2: intercepto + idade + altura (cm) + peso.
type Coef = [number, number, number, number];
const EER_2023: Record<"adulto" | "crianca", Record<SexoParaFormula, Record<NivelEER, Coef>>> = {
  adulto: {
    masculino: {
      inativo: [753.07, -10.83, 6.5, 14.1],
      pouco_ativo: [581.47, -10.83, 8.3, 14.94],
      ativo: [1004.82, -10.83, 6.52, 15.91],
      muito_ativo: [-517.88, -10.83, 15.61, 19.11],
    },
    feminino: {
      inativo: [584.9, -7.01, 5.72, 11.71],
      pouco_ativo: [575.77, -7.01, 6.6, 12.14],
      ativo: [710.25, -7.01, 6.54, 12.34],
      muito_ativo: [511.83, -7.01, 9.07, 12.56],
    },
  },
  crianca: {
    masculino: {
      inativo: [-447.51, 3.68, 13.01, 13.15],
      pouco_ativo: [19.12, 3.68, 8.62, 20.28],
      ativo: [-388.19, 3.68, 12.66, 20.46],
      muito_ativo: [-671.75, 3.68, 15.38, 23.25],
    },
    feminino: {
      inativo: [55.59, -22.25, 8.43, 17.07],
      pouco_ativo: [-297.54, -22.25, 12.77, 14.73],
      ativo: [-189.55, -22.25, 11.74, 18.34],
      muito_ativo: [-709.59, -22.25, 18.22, 14.25],
    },
  },
};
const EER_2023_BEBE: Record<SexoParaFormula, Coef> = {
  masculino: [-716.45, -1.0, 17.82, 15.06],
  feminino: [-69.15, 80.0, 2.65, 54.15],
};

/** Custo do crescimento (kcal/dia) da EER 2023, Tabela S-2 e notas a, b, c. */
function crescimento2023(sexo: SexoParaFormula, meses: number, idade: number): number {
  if (meses < 3) return sexo === "masculino" ? 200 : 180;
  if (meses < 6) return sexo === "masculino" ? 50 : 60;
  if (meses < 36) return sexo === "masculino" ? 20 : meses < 12 ? 20 : 15;
  if (idade < 4) return sexo === "masculino" ? 20 : 15;
  if (idade < 9) return 15;
  if (idade < 14) return sexo === "masculino" ? 25 : 30;
  return 20;
}

function eer2023(d: DadosEnergia, peso: number, alturaCm: number | null): ResultadoFormula {
  if (alturaCm === null) return precisa("Informe a altura.");
  const aplica = ([b, a, h, w]: Coef, idade: number) => b + a * idade + h * alturaCm + w * peso;
  if (d.idadeMeses < 36) {
    // 0–2 anos: sem nível de atividade; idade em anos com fração (ex.: 18 meses = 1,5).
    return get(aplica(EER_2023_BEBE[d.sexo], d.idadeMeses / 12) + crescimento2023(d.sexo, d.idadeMeses, d.idadeAnos));
  }
  if (!d.nivelEER) return precisa("Escolha o nível de atividade da EER.");
  if (d.idadeAnos < 19) {
    return get(
      aplica(EER_2023.crianca[d.sexo][d.nivelEER], d.idadeAnos) + crescimento2023(d.sexo, d.idadeMeses, d.idadeAnos)
    );
  }
  return get(aplica(EER_2023.adulto[d.sexo][d.nivelEER], d.idadeAnos));
}

/**
 * Calcula uma fórmula. Devolve TMB ou GET em kcal/dia, ou o motivo de não
 * poder calcular (dado faltando, idade fora da faixa da fórmula).
 */
export function calcularFormula(formula: FormulaEnergia, d: DadosEnergia): ResultadoFormula {
  const { sexo, idadeAnos: idade, pesoKg: peso, alturaCm, mlgKg: mlg } = d;
  const alturaM = alturaCm !== null ? alturaCm / 100 : null;
  const info = FORMULAS[formula];
  if (info.publico === "adultos" && idade < ADULTO) return precisa(SO_ADULTOS);
  if (info.publico === "criancas" && idade >= ADULTO) return precisa("Fórmula para crianças e adolescentes (até 18 anos).");

  switch (formula) {
    case "tmb_manual":
    case "get_manual": {
      const v = d.valorManual;
      if (!v || v <= 0) return precisa(formula === "tmb_manual" ? "Digite a TMB." : "Digite o GET.");
      return formula === "tmb_manual" ? tmb(v) : get(v);
    }
    case "katch_mcardle":
    case "cunningham":
    case "mifflin_st_jeor_mlg":
    case "tinsley_mlg": {
      if (!mlg) return precisa("Informe a massa livre de gordura.");
      const [a, b] = { katch_mcardle: [21.6, 370], cunningham: [22, 500], mifflin_st_jeor_mlg: [19.7, 413], tinsley_mlg: [25.9, 284] }[
        formula
      ];
      return tmb(a * mlg + b);
    }
  }

  if (!peso) return precisa("Informe o peso.");

  switch (formula) {
    case "formula_de_bolso":
      if (!d.kcalPorKg || d.kcalPorKg <= 0) return precisa("Digite as kcal por kg.");
      return get(d.kcalPorKg * peso);
    case "tinsley_peso":
      return tmb(24.8 * peso + 10);
    case "fao_oms_2004": {
      const [a, b] = faixa(idade, FAO[sexo])!;
      return tmb(a * peso + b);
    }
    case "henry_rees_1991": {
      const c = faixa(idade, HENRY_REES[sexo]);
      if (!c) return precisa("Henry & Rees só tem equações de 3 a 59 anos.");
      return tmb((c[0] * peso + c[1]) * KCAL_POR_MJ);
    }
    case "eer_iom_2005":
      return eerIom2005(d, peso, alturaM);
    case "eer_2023":
      return eer2023(d, peso, alturaCm);
  }

  if (alturaCm === null || alturaM === null) return precisa("Informe a altura.");

  switch (formula) {
    case "harris_benedict_1919":
      return tmb(
        sexo === "masculino"
          ? 66.5 + 13.75 * peso + 5.003 * alturaCm - 6.75 * idade
          : 655.1 + 9.563 * peso + 1.85 * alturaCm - 4.676 * idade
      );
    case "harris_benedict_1984":
      return tmb(
        sexo === "masculino"
          ? 88.362 + 13.397 * peso + 4.799 * alturaCm - 5.677 * idade
          : 447.593 + 9.247 * peso + 3.098 * alturaCm - 4.33 * idade
      );
    case "mifflin_st_jeor":
      return tmb(10 * peso + 6.25 * alturaCm - 5 * idade + (sexo === "masculino" ? 5 : -161));
    case "schofield_1985": {
      const [a, b, c] = faixa(idade, SCHOFIELD_PA[sexo])!;
      return tmb(a * peso + b * alturaM + c);
    }
    case "henry_oxford_2005": {
      const [a, b, c] = faixa(idade, HENRY_OXFORD[sexo])!;
      return tmb((a * peso + b * alturaM + c) * KCAL_POR_MJ);
    }
  }
  return precisa("Fórmula desconhecida.");
}

/** Fórmulas que servem para a idade (as "só adultos" somem para crianças e vice-versa). */
export function formulasParaIdade(idadeAnos: number): FormulaEnergia[] {
  return (Object.keys(FORMULAS) as FormulaEnergia[]).filter((f) => {
    const p = FORMULAS[f].publico;
    if (p === "adultos") return idadeAnos >= ADULTO;
    if (p === "criancas") return idadeAnos < ADULTO;
    if (f === "henry_rees_1991") return idadeAnos >= 3 && idadeAnos < 60;
    return true;
  });
}

/** Nas EER (que já dão o GET) os fatores de atividade e injúria não entram. */
export const usaNivelEER = (f: FormulaEnergia) => f === "eer_iom_2005" || f === "eer_2023";

// ---------------------------------------------------------------------------
// Fatores (seções 4 e 5 da lista aprovada)

export const FATORES_ATIVIDADE_FASE16: { valor: number; label: string }[] = [
  { valor: 1, label: "Não utilizar" },
  { valor: 1.2, label: "Sedentário" },
  { valor: 1.375, label: "Leve" },
  { valor: 1.55, label: "Moderada" },
  { valor: 1.725, label: "Intensa" },
  { valor: 1.9, label: "Muito intensa" },
];

/** Valores copiados do WebDiet — ver "Para revisar" em docs/FASE_16_FORMULAS.md. */
export const FATORES_INJURIA: { grupo: string; itens: { valor: number; label: string }[] }[] = [
  {
    grupo: "Harris-Benedict (1919)",
    itens: [
      { valor: 1, label: "Paciente não complicado" },
      { valor: 1.1, label: "Pós-operatório de câncer" },
      { valor: 1.2, label: "Fratura" },
      { valor: 1.3, label: "Sepse" },
      { valor: 1.4, label: "Peritonite" },
      { valor: 1.5, label: "Multitrauma + reabilitação" },
      { valor: 1.6, label: "Multitrauma + sepse" },
      { valor: 1.25, label: "Queimadura até 20%" },
      { valor: 1.7, label: "Queimadura (30% a 50%)" },
      { valor: 1.8, label: "Queimadura (50% a 70%)" },
      { valor: 2, label: "Queimadura (70% a 90%)" },
      { valor: 2.1, label: "Queimadura (100%)" },
    ],
  },
  {
    grupo: "Long (1979)",
    itens: [
      { valor: 1.27, label: "Câncer" },
      { valor: 1.1, label: "Cirurgia eletiva" },
      { valor: 1.5, label: "Desnutrição grave" },
      { valor: 0.9, label: "Doença cardiopulmonar" },
      { valor: 1.42, label: "Doença cardiopulmonar com cirurgia" },
      { valor: 1.27, label: "Fraturas múltiplas" },
      { valor: 1.32, label: "Infecção grave" },
      { valor: 1.4, label: "Insuficiência cardíaca" },
      { valor: 1.42, label: "Insuficiência hepática" },
      { valor: 1.3, label: "Insuficiência renal aguda" },
      { valor: 0.9, label: "Jejum" },
      { valor: 1.35, label: "Pós-operatório de cirurgia cardíaca" },
      { valor: 1.55, label: "Pancreatite" },
      { valor: 1.2, label: "Pequena cirurgia" },
      { valor: 1.25, label: "Pequeno trauma de tecido" },
      { valor: 1.25, label: "Pós-operatório (geral)" },
      { valor: 1.35, label: "Pós-operatório torácico" },
      { valor: 1.6, label: "Sepse" },
      { valor: 1.35, label: "Transplante de fígado" },
      { valor: 1.25, label: "Transplante de medula óssea" },
    ],
  },
];

/** Valor Energético do Tecido Adiposo: kcal por kg de peso corporal (método usado no WebDiet). */
export const KCAL_POR_KG_VENTA = 7700;

/** Ajuste diário (kcal) para ganhar (+) ou perder (−) `kg` em `dias`. */
export function ajusteVenta(kg: number, dias: number): number {
  if (!dias || dias <= 0) return 0;
  return (kg * KCAL_POR_KG_VENTA) / dias;
}

export interface ResultadoEnergia {
  tmb: number | null;
  get: number;
}

/**
 * GET final: TMB × fator de atividade × fator injúria (só nas fórmulas de TMB)
 * + adicionais em kcal/dia (MET, meta de peso, gestante).
 */
export function calcularGETFinal(
  r: Extract<ResultadoFormula, { ok: true }>,
  fatores: { atividade: number; injuria: number },
  adicionaisKcal: number
): ResultadoEnergia {
  if (r.tipo === "get") return { tmb: null, get: r.kcal + adicionaisKcal };
  return { tmb: r.kcal, get: r.kcal * fatores.atividade * fatores.injuria + adicionaisKcal };
}
