/**
 * Crescimento de crianças e adolescentes (Fase 15, Bloco B).
 *
 * Escore-z pelo método LMS da OMS: z = ((X/M)^L − 1) / (L·S), com os
 * coeficientes oficiais em `who-lms-data.ts`, interpolados linearmente entre
 * meses (ou entre meio centímetro, em peso/comprimento). Para peso e IMC, acima
 * de +3 ou abaixo de −3 a OMS usa o "z restrito" (distância medida em unidades
 * do intervalo entre 2 e 3 DP), aplicado aqui — ver WHO Child Growth
 * Standards: Methods and development, 2006, cap. 7.
 *
 * Classificações: Ministério da Saúde, Protocolos do SISVAN na assistência à
 * saúde, 2008 (as mesmas que o WebDiet cita).
 */

import type { SexoParaFormula } from "@/lib/energy";
import type { Classificacao } from "@/lib/anthropometry";
import { WHO_LMS, type IndicadorCrescimento, type Lms } from "@/lib/growth/who-lms-data";

export type { IndicadorCrescimento };

/** Idade máxima do protocolo infantil: 19 anos (228 meses), recomendação da OMS. */
export const MESES_MAXIMO_INFANTIL = 228;

export const INDICADOR_LABELS: Record<IndicadorCrescimento, string> = {
  peso_idade: "Peso por idade",
  altura_idade: "Altura por idade",
  imc_idade: "IMC por idade",
  peso_comprimento: "Peso por comprimento",
  peso_estatura: "Peso por estatura",
};

/** Idade em meses (com fração), da data de nascimento até a data da avaliação. Datas yyyy-mm-dd. */
export function idadeEmMeses(dataNascimento: string | null | undefined, data: string): number | null {
  if (!dataNascimento || !data) return null;
  const dias = (Date.parse(`${data}T00:00:00Z`) - Date.parse(`${dataNascimento}T00:00:00Z`)) / 86_400_000;
  if (!Number.isFinite(dias) || dias < 0) return null;
  return dias / 30.4375;
}

/** "12 anos e 5 meses" / "8 meses". */
export function formatarIdadeMeses(meses: number): string {
  const inteiros = Math.floor(meses);
  const anos = Math.floor(inteiros / 12);
  const resto = inteiros % 12;
  const m = `${resto} ${resto === 1 ? "mês" : "meses"}`;
  if (anos === 0) return m;
  const a = `${anos} ${anos === 1 ? "ano" : "anos"}`;
  return resto === 0 ? a : `${a} e ${m}`;
}

/** Coeficientes LMS em `x` (interpolação linear). Nulo fora da faixa da tabela. */
export function lmsEm(indicador: IndicadorCrescimento, sexo: SexoParaFormula, x: number): Lms | null {
  const tabela = WHO_LMS[indicador][sexo];
  if (x < tabela[0][0] || x > tabela[tabela.length - 1][0]) return null;
  let i = 0;
  while (i < tabela.length - 1 && tabela[i + 1][0] <= x) i++;
  const a = tabela[i];
  if (a[0] === x || i === tabela.length - 1) return a;
  const b = tabela[i + 1];
  const t = (x - a[0]) / (b[0] - a[0]);
  return [x, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
}

/** Valor da medida que corresponde ao escore-z `z` (para desenhar as curvas). */
export function valorNoZ([, l, m, s]: Lms, z: number): number {
  return l === 0 ? m * Math.exp(s * z) : m * (1 + l * s * z) ** (1 / l);
}

/** Altura/idade usa o LMS puro; peso e IMC usam o z restrito fora de ±3 (OMS). */
const Z_RESTRITO: Record<IndicadorCrescimento, boolean> = {
  peso_idade: true,
  altura_idade: false,
  imc_idade: true,
  peso_comprimento: true,
  peso_estatura: true,
};

export function escoreZ(indicador: IndicadorCrescimento, sexo: SexoParaFormula, x: number, valor: number): number | null {
  const lms = lmsEm(indicador, sexo, x);
  if (!lms || !(valor > 0)) return null;
  const [, l, m, s] = lms;
  const z = l === 0 ? Math.log(valor / m) / s : ((valor / m) ** l - 1) / (l * s);
  if (!Z_RESTRITO[indicador]) return z;
  if (z > 3) {
    const sd3 = valorNoZ(lms, 3);
    return 3 + (valor - sd3) / (sd3 - valorNoZ(lms, 2));
  }
  if (z < -3) {
    const sd3neg = valorNoZ(lms, -3);
    return -3 + (valor - sd3neg) / (valorNoZ(lms, -2) - sd3neg);
  }
  return z;
}

/** Percentil a partir do escore-z (função de distribuição normal). */
export function percentil(z: number): number {
  // Abramowitz & Stegun 7.1.26 — erro < 1,5e-7.
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf =
    1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 50 * (1 + (z >= 0 ? erf : -erf));
}

// ---------------------------------------------------------------------------
// Classificações do SISVAN (Ministério da Saúde, 2008)
// ---------------------------------------------------------------------------

const FONTE_SISVAN = "SISVAN, 2008";
const c = (label: string, tom: Classificacao["tom"]): Classificacao => ({ label, tom, fonte: FONTE_SISVAN });

export function classificarCrescimento(indicador: IndicadorCrescimento, z: number, meses: number): Classificacao {
  switch (indicador) {
    case "peso_idade":
      if (z < -3) return c("Muito baixo peso para a idade", "destructive");
      if (z < -2) return c("Baixo peso para a idade", "destructive");
      if (z <= 2) return c("Peso adequado para a idade", "success");
      return c("Peso elevado para a idade", "warning");
    case "altura_idade":
      if (z < -3) return c("Muito baixa estatura para a idade", "destructive");
      if (z < -2) return c("Baixa estatura para a idade", "destructive");
      return c("Estatura adequada para a idade", "success");
    case "imc_idade":
      // De 5 anos em diante (60 meses) os nomes mudam: o que abaixo de 5 é
      // "risco de sobrepeso / sobrepeso / obesidade" vira "sobrepeso / obesidade / obesidade grave".
      if (meses >= 60) {
        if (z < -3) return c("Magreza acentuada", "destructive");
        if (z < -2) return c("Magreza", "destructive");
        if (z <= 1) return c("Eutrofia", "success");
        if (z <= 2) return c("Sobrepeso", "warning");
        if (z <= 3) return c("Obesidade", "destructive");
        return c("Obesidade grave", "destructive");
      }
      return classificarPesoEstatura(z);
    case "peso_comprimento":
    case "peso_estatura":
      return classificarPesoEstatura(z);
  }
}

function classificarPesoEstatura(z: number): Classificacao {
  if (z < -3) return c("Magreza acentuada", "destructive");
  if (z < -2) return c("Magreza", "destructive");
  if (z <= 1) return c("Eutrofia", "success");
  if (z <= 2) return c("Risco de sobrepeso", "warning");
  if (z <= 3) return c("Sobrepeso", "warning");
  return c("Obesidade", "destructive");
}

// ---------------------------------------------------------------------------
// Avaliação completa de uma criança
// ---------------------------------------------------------------------------

export interface ResultadoIndicador {
  indicador: IndicadorCrescimento;
  /** Idade em meses, ou comprimento/estatura em cm (peso/comprimento e peso/estatura). */
  x: number;
  valor: number;
  z: number;
  percentil: number;
  classificacao: Classificacao;
}

export interface ResultadosCrianca {
  meses: number;
  imc: number | null;
  indicadores: ResultadoIndicador[];
  /** Indicadores que não se aplicam nesta idade, com o motivo. */
  foraDaFaixa: { indicador: IndicadorCrescimento; motivo: string }[];
}

/** Peso/comprimento abaixo de 2 anos, peso/estatura de 2 a 5 anos; não se aplica depois. */
export function indicadorPesoAltura(meses: number): "peso_comprimento" | "peso_estatura" | null {
  if (meses < 24) return "peso_comprimento";
  if (meses <= 60) return "peso_estatura";
  return null;
}

export function calcularResultadosCrianca(input: {
  sexo: SexoParaFormula;
  meses: number;
  pesoKg: number | null;
  alturaCm: number | null;
}): ResultadosCrianca {
  const { sexo, meses, pesoKg, alturaCm } = input;
  const imc = pesoKg && alturaCm ? pesoKg / (alturaCm / 100) ** 2 : null;
  const indicadores: ResultadoIndicador[] = [];
  const foraDaFaixa: ResultadosCrianca["foraDaFaixa"] = [];

  function add(indicador: IndicadorCrescimento, x: number, valor: number | null) {
    if (valor === null) return;
    const z = escoreZ(indicador, sexo, x, valor);
    if (z === null) {
      foraDaFaixa.push({ indicador, motivo: "Fora da faixa da tabela da OMS." });
      return;
    }
    indicadores.push({ indicador, x, valor, z, percentil: percentil(z), classificacao: classificarCrescimento(indicador, z, meses) });
  }

  if (meses <= 120) add("peso_idade", meses, pesoKg);
  else foraDaFaixa.push({ indicador: "peso_idade", motivo: "A OMS só tem peso por idade até 10 anos." });
  add("altura_idade", meses, alturaCm);
  add("imc_idade", meses, imc);
  const pa = indicadorPesoAltura(meses);
  if (pa && alturaCm !== null) add(pa, alturaCm, pesoKg);

  return { meses, imc, indicadores, foraDaFaixa };
}

// ---------------------------------------------------------------------------
// % de gordura infantil — Slaughter et al., 1988; classificação Lohman, 1987
// ---------------------------------------------------------------------------

export type ResultadoGorduraInfantil =
  | { ok: true; percentualGordura: number; dobras: string; fonte: string; classificacao: Classificacao }
  | { ok: false; motivo: string };

/**
 * Prefere tríceps + panturrilha (a equação não depende de maturação sexual).
 * Com tríceps + subescapular: meninas sempre; meninos só com soma > 35 mm —
 * abaixo disso a equação de Slaughter depende do estágio de maturação e da
 * etnia, que não são coletados aqui.
 */
export function gorduraInfantil(input: {
  sexo: SexoParaFormula;
  idadeAnos: number;
  tricepsMm: number | null;
  subescapularMm: number | null;
  panturrilhaMm: number | null;
}): ResultadoGorduraInfantil | null {
  const { sexo, idadeAnos, tricepsMm: tr, subescapularMm: se, panturrilhaMm: pa } = input;
  if (!tr || (!se && !pa)) return null;
  if (idadeAnos < 8 || idadeAnos > 18) {
    return { ok: false, motivo: "A equação de Slaughter foi feita com crianças e jovens de 8 a 18 anos." };
  }

  let pg: number;
  let dobras: string;
  if (pa) {
    const s = tr + pa;
    pg = sexo === "masculino" ? 0.735 * s + 1.0 : 0.61 * s + 5.1;
    dobras = "tricipital + panturrilha";
  } else {
    const s = tr + (se as number);
    dobras = "tricipital + subescapular";
    if (sexo === "feminino") {
      pg = s > 35 ? 0.546 * s + 9.7 : 1.33 * s - 0.013 * s * s - 2.5;
    } else if (s > 35) {
      pg = 0.783 * s + 1.6;
    } else {
      return {
        ok: false,
        motivo: "Para meninos com tricipital + subescapular até 35 mm, preencha a dobra da panturrilha (a outra equação depende da maturação sexual).",
      };
    }
  }

  return { ok: true, percentualGordura: pg, dobras, fonte: "Slaughter et al., 1988", classificacao: classificarGorduraInfantil(pg, sexo) };
}

/** Lohman, 1987 — meninos: ≤6 · 6–10 · 10–20 · 20–25 · 25–31 · >31; meninas: ≤12 · 12–15 · 15–25 · 25–30 · 30–36 · >36. */
export function classificarGorduraInfantil(pg: number, sexo: SexoParaFormula): Classificacao {
  const fonte = "Lohman, 1987";
  const cortes = sexo === "masculino" ? [6, 10, 20, 25, 31] : [12, 15, 25, 30, 36];
  if (pg <= cortes[0]) return { label: "Excessivamente baixa", tom: "destructive", fonte };
  if (pg <= cortes[1]) return { label: "Baixa", tom: "warning", fonte };
  if (pg <= cortes[2]) return { label: "Adequada", tom: "success", fonte };
  if (pg <= cortes[3]) return { label: "Moderadamente alta", tom: "warning", fonte };
  if (pg <= cortes[4]) return { label: "Alta", tom: "destructive", fonte };
  return { label: "Excessivamente alta", tom: "destructive", fonte };
}
