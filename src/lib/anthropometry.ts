/**
 * Antropometria de adultos e idosos (Fase 15, Bloco A).
 *
 * Lista de protocolos aprovada pela nutricionista em 30/09/2026 (decisão R4,
 * `docs/FASE_15_PROTOCOLOS.md`). Cada fórmula cita a fonte aqui e na tela.
 * Os coeficientes foram conferidos em fonte publicada — nunca de memória:
 * - Jackson & Pollock, Petroski e Guedes: pacote R `bodycomp` (CRAN) e
 *   Rêgo, Baptista & Salem, Revista de Educação Física 2008;140:27-42 (Tabela 10).
 * - Durnin & Womersley: tabela original de 1974 (o pacote `bodycomp` tem
 *   coeficientes trocados em três faixas — não usar como fonte para ela).
 * - Chumlea, Frisancho (CMB), Lohman, Lipschitz, OMS: Freiberg CK, "Padrões de
 *   medidas e referências aplicadas na avaliação e diagnóstico nutricional de
 *   adultos e idosos", Centro Universitário São Camilo.
 *
 * As equações só têm coeficientes para "masculino" e "feminino" — a mesma regra
 * de `energy.ts`: paciente "outro"/sem sexo nunca tem uma base assumida; a tela
 * pede ao profissional para escolher (`sexo_referencia` da avaliação).
 */

import type { SexoParaFormula } from "@/lib/energy";

export type { SexoParaFormula };

// ---------------------------------------------------------------------------
// Dobras cutâneas e protocolos
// ---------------------------------------------------------------------------

export type Dobra =
  | "triceps"
  | "biceps"
  | "abdominal"
  | "subescapular"
  | "axilar_media"
  | "coxa"
  | "peitoral"
  | "suprailiaca"
  | "panturrilha"
  | "supraespinhal";

export const DOBRA_LABELS: Record<Dobra, string> = {
  triceps: "Tricipital",
  biceps: "Bicipital",
  abdominal: "Abdominal",
  subescapular: "Subescapular",
  axilar_media: "Axilar média",
  coxa: "Coxa",
  peitoral: "Torácica (peitoral)",
  suprailiaca: "Suprailíaca",
  panturrilha: "Panturrilha",
  supraespinhal: "Supraespinhal",
};

export const DOBRAS: Dobra[] = Object.keys(DOBRA_LABELS) as Dobra[];

export type Dobras = Partial<Record<Dobra, number | null>>;

export type ProtocoloDobras = "pollock_3" | "pollock_7" | "petroski" | "guedes" | "durnin" | "faulkner";

export const PROTOCOLOS: ProtocoloDobras[] = ["pollock_3", "pollock_7", "petroski", "guedes", "durnin", "faulkner"];

interface ProtocoloInfo {
  label: string;
  fonte: (sexo: SexoParaFormula) => string;
  dobras: (sexo: SexoParaFormula) => Dobra[];
  /** Faixa etária da amostra original — fora dela a tela avisa, mas calcula. */
  faixaEtaria: string;
}

export const PROTOCOLO_INFO: Record<ProtocoloDobras, ProtocoloInfo> = {
  pollock_3: {
    label: "Pollock 3",
    fonte: (s) => (s === "masculino" ? "Jackson & Pollock, 1978" : "Jackson, Pollock & Ward, 1980"),
    dobras: (s) => (s === "masculino" ? ["peitoral", "abdominal", "coxa"] : ["triceps", "suprailiaca", "coxa"]),
    faixaEtaria: "18 a 61 anos",
  },
  pollock_7: {
    label: "Pollock 7",
    fonte: (s) => (s === "masculino" ? "Jackson & Pollock, 1978" : "Jackson, Pollock & Ward, 1980"),
    dobras: () => ["peitoral", "axilar_media", "triceps", "subescapular", "abdominal", "suprailiaca", "coxa"],
    faixaEtaria: "18 a 61 anos",
  },
  petroski: {
    label: "Petroski",
    fonte: () => "Petroski, 1995",
    dobras: (s) =>
      s === "masculino"
        ? ["subescapular", "triceps", "suprailiaca", "panturrilha"]
        : ["axilar_media", "suprailiaca", "coxa", "panturrilha"],
    faixaEtaria: "18 a 66 anos (homens) / 18 a 51 anos (mulheres)",
  },
  guedes: {
    label: "Guedes",
    fonte: () => "Guedes, 1985",
    dobras: (s) => (s === "masculino" ? ["triceps", "suprailiaca", "abdominal"] : ["subescapular", "suprailiaca", "coxa"]),
    faixaEtaria: "17 a 30 anos (universitários)",
  },
  durnin: {
    label: "Durnin",
    fonte: () => "Durnin & Womersley, 1974",
    dobras: () => ["biceps", "triceps", "subescapular", "suprailiaca"],
    faixaEtaria: "a partir de 17 anos",
  },
  faulkner: {
    label: "Faulkner",
    fonte: () => "Faulkner, 1968",
    dobras: () => ["triceps", "subescapular", "suprailiaca", "abdominal"],
    faixaEtaria: "adultos",
  },
};

export type FormulaDensidade = "brozek" | "siri";

export const FORMULA_DENSIDADE_LABELS: Record<FormulaDensidade, string> = {
  brozek: "Brozek, 1963",
  siri: "Siri, 1961",
};

/** Densidade corporal (g/cm³) → % de gordura. */
export function densidadeParaPercentualGordura(densidade: number, formula: FormulaDensidade): number {
  return formula === "siri" ? (4.95 / densidade - 4.5) * 100 : (4.57 / densidade - 4.142) * 100;
}

/** Coeficientes de Durnin & Womersley (1974): D = c − m × log10(Σ4 dobras). */
const DURNIN_COEFICIENTES: Record<SexoParaFormula, { idadeMinima: number; c: number; m: number }[]> = {
  masculino: [
    { idadeMinima: 50, c: 1.1715, m: 0.0779 },
    { idadeMinima: 40, c: 1.162, m: 0.07 },
    { idadeMinima: 30, c: 1.1422, m: 0.0544 },
    { idadeMinima: 20, c: 1.1631, m: 0.0632 },
    { idadeMinima: 17, c: 1.162, m: 0.063 },
  ],
  feminino: [
    { idadeMinima: 50, c: 1.1339, m: 0.0645 },
    { idadeMinima: 40, c: 1.1333, m: 0.0612 },
    { idadeMinima: 30, c: 1.1423, m: 0.0632 },
    { idadeMinima: 20, c: 1.1599, m: 0.0717 },
    { idadeMinima: 17, c: 1.1549, m: 0.0678 },
  ],
};

export interface CalcularGorduraInput {
  protocolo: ProtocoloDobras;
  formulaDensidade: FormulaDensidade;
  sexo: SexoParaFormula;
  idade: number | null;
  pesoKg: number;
  alturaCm: number;
  dobras: Dobras;
}

export type ResultadoGordura =
  | {
      ok: true;
      percentualGordura: number;
      /** Nulo em Faulkner, que estima o % de gordura direto, sem densidade. */
      densidade: number | null;
      somaDobras: number;
      fonte: string;
    }
  | { ok: false; motivo: string };

/** Protocolos cuja equação usa a idade (Guedes e Faulkner não usam). */
const USA_IDADE: Record<ProtocoloDobras, boolean> = {
  pollock_3: true,
  pollock_7: true,
  petroski: true,
  guedes: false,
  durnin: true,
  faulkner: false,
};

export function calcularPercentualGordura(input: CalcularGorduraInput): ResultadoGordura {
  const { protocolo, sexo, idade, pesoKg, alturaCm } = input;
  const info = PROTOCOLO_INFO[protocolo];
  const necessarias = info.dobras(sexo);
  const faltando = necessarias.filter((d) => !(Number(input.dobras[d]) > 0));
  if (faltando.length > 0) {
    return { ok: false, motivo: `Preencha as dobras: ${faltando.map((d) => DOBRA_LABELS[d].toLowerCase()).join(", ")}.` };
  }
  if (USA_IDADE[protocolo] && idade === null) {
    return { ok: false, motivo: "Cadastre a data de nascimento do paciente — este protocolo usa a idade." };
  }

  const s = necessarias.reduce((soma, d) => soma + Number(input.dobras[d]), 0);
  const i = idade ?? 0;
  const fonte = info.fonte(sexo);

  if (protocolo === "faulkner") {
    return { ok: true, percentualGordura: s * 0.153 + 5.783, densidade: null, somaDobras: s, fonte };
  }

  let densidade: number;
  switch (protocolo) {
    case "pollock_3":
      densidade =
        sexo === "masculino"
          ? 1.10938 - 0.0008267 * s + 0.0000016 * s ** 2 - 0.0002574 * i
          : 1.0994921 - 0.0009929 * s + 0.0000023 * s ** 2 - 0.0001392 * i;
      break;
    case "pollock_7":
      densidade =
        sexo === "masculino"
          ? 1.112 - 0.00043499 * s + 0.00000055 * s ** 2 - 0.00028826 * i
          : 1.097 - 0.00046971 * s + 0.00000056 * s ** 2 - 0.00012828 * i;
      break;
    case "petroski":
      densidade =
        sexo === "masculino"
          ? 1.10726863 - 0.00081201 * s + 0.00000212 * s ** 2 - 0.00041761 * i
          : 1.0346585 -
            0.00063129 * s +
            0.00000187 * s ** 2 -
            0.00031165 * i -
            0.0004889 * pesoKg +
            0.00051345 * alturaCm;
      break;
    case "guedes":
      densidade = sexo === "masculino" ? 1.17136 - 0.06706 * Math.log10(s) : 1.1665 - 0.07063 * Math.log10(s);
      break;
    case "durnin": {
      const faixa = DURNIN_COEFICIENTES[sexo].find((f) => i >= f.idadeMinima);
      if (!faixa) {
        return { ok: false, motivo: "Durnin & Womersley só tem coeficientes a partir de 17 anos." };
      }
      densidade = faixa.c - faixa.m * Math.log10(s);
      break;
    }
  }

  return {
    ok: true,
    percentualGordura: densidadeParaPercentualGordura(densidade, input.formulaDensidade),
    densidade,
    somaDobras: s,
    fonte: `${fonte} + ${FORMULA_DENSIDADE_LABELS[input.formulaDensidade]}`,
  };
}

// ---------------------------------------------------------------------------
// Classificações
// ---------------------------------------------------------------------------

export type Tom = "success" | "warning" | "destructive";

export interface Classificacao {
  label: string;
  tom: Tom;
  fonte: string;
}

export const IDADE_IDOSO = 60;

/** IMC — OMS (adultos) ou Lipschitz/NSI 1994 (60 anos ou mais). Sem idade, usa a de adultos. */
export function classificarImc(imc: number, idade: number | null): Classificacao {
  if (idade !== null && idade >= IDADE_IDOSO) {
    const fonte = "Lipschitz, 1994";
    if (imc < 22) return { label: "Baixo peso", tom: "warning", fonte };
    if (imc <= 27) return { label: "Eutrofia", tom: "success", fonte };
    return { label: "Sobrepeso", tom: "warning", fonte };
  }
  const fonte = "OMS, 2000";
  if (imc < 18.5) return { label: "Baixo peso", tom: "warning", fonte };
  if (imc < 25) return { label: "Eutrofia", tom: "success", fonte };
  if (imc < 30) return { label: "Sobrepeso", tom: "warning", fonte };
  if (imc < 35) return { label: "Obesidade grau I", tom: "destructive", fonte };
  if (imc < 40) return { label: "Obesidade grau II", tom: "destructive", fonte };
  return { label: "Obesidade grau III", tom: "destructive", fonte };
}

export function calcularImc(pesoKg: number, alturaCm: number): number {
  const m = alturaCm / 100;
  return pesoKg / (m * m);
}

/** Faixa de peso em que o IMC fica "eutrófico": 18,5–24,9 (adulto) ou 22–27 (idoso). */
export function faixaPesoIdeal(alturaCm: number, idade: number | null): { minKg: number; maxKg: number } {
  const m2 = (alturaCm / 100) ** 2;
  return idade !== null && idade >= IDADE_IDOSO ? { minKg: 22 * m2, maxKg: 27 * m2 } : { minKg: 18.5 * m2, maxKg: 24.9 * m2 };
}

/** Relação cintura/quadril — risco aumentado a partir de 0,90 (homem) / 0,85 (mulher). OMS, 2008. */
export function classificarRcq(rcq: number, sexo: SexoParaFormula): Classificacao {
  const corte = sexo === "masculino" ? 0.9 : 0.85;
  return rcq >= corte
    ? { label: "Risco aumentado", tom: "destructive", fonte: "OMS, 2008" }
    : { label: "Sem risco aumentado", tom: "success", fonte: "OMS, 2008" };
}

/** Relação cintura/estatura — 0,5 e 0,6 como pontos de ação. Ashwell & Gibson, 2016. */
export function classificarRcest(rcest: number): Classificacao {
  const fonte = "Ashwell & Gibson, 2016";
  if (rcest >= 0.6) return { label: "Risco muito aumentado", tom: "destructive", fonte };
  if (rcest >= 0.5) return { label: "Risco aumentado", tom: "warning", fonte };
  return { label: "Sem risco aumentado", tom: "success", fonte };
}

/**
 * % de gordura — Lohman, 1992 (em Heyward & Stolarczyk, 1996).
 * Homens: ≤5 risco | 6–14 abaixo da média | 15 média | 16–24 acima | ≥25 risco.
 * Mulheres: ≤8 risco | 9–22 abaixo da média | 23 média | 24–31 acima | ≥32 risco.
 */
export function classificarPercentualGordura(pg: number, sexo: SexoParaFormula): Classificacao {
  const fonte = "Lohman, 1992";
  const [riscoBaixo, media, riscoAlto] = sexo === "masculino" ? [5, 15, 25] : [8, 23, 32];
  if (pg <= riscoBaixo) return { label: "Risco (desnutrição)", tom: "destructive", fonte };
  if (pg < media) return { label: "Abaixo da média", tom: "success", fonte };
  if (pg < media + 1) return { label: "Média", tom: "success", fonte };
  if (pg < riscoAlto) return { label: "Acima da média", tom: "warning", fonte };
  return { label: "Risco (obesidade)", tom: "destructive", fonte };
}

/** % de gordura de referência ("média") da mesma tabela de Lohman. */
export function percentualGorduraReferencia(sexo: SexoParaFormula): number {
  return sexo === "masculino" ? 15 : 23;
}

// ---------------------------------------------------------------------------
// Circunferência muscular do braço (CMB)
// ---------------------------------------------------------------------------

/** CMB (cm) = CB (cm) − π × DCT (mm) / 10. */
export function calcularCmb(circunferenciaBracoCm: number, dobraTricepsMm: number): number {
  return circunferenciaBracoCm - Math.PI * (dobraTricepsMm / 10);
}

/** Percentis 5, 10, 50 e 90 da CMB (cm), a partir de 18 anos. Frisancho, 1981. */
const FRISANCHO_CMB: Record<SexoParaFormula, { idadeMinima: number; p5: number; p10: number; p50: number; p90: number }[]> = {
  masculino: [
    { idadeMinima: 65, p5: 22.3, p10: 23.5, p50: 26.8, p90: 29.8 },
    { idadeMinima: 55, p5: 23.6, p10: 24.5, p50: 27.8, p90: 31.0 },
    { idadeMinima: 45, p5: 23.9, p10: 24.9, p50: 28.1, p90: 31.5 },
    { idadeMinima: 35, p5: 24.7, p10: 25.5, p50: 28.6, p90: 31.8 },
    { idadeMinima: 25, p5: 24.3, p10: 25.0, p50: 27.9, p90: 31.4 },
    { idadeMinima: 19, p5: 23.8, p10: 24.5, p50: 27.3, p90: 30.9 },
    { idadeMinima: 18, p5: 22.6, p10: 23.7, p50: 26.4, p90: 29.8 },
  ],
  feminino: [
    { idadeMinima: 65, p5: 18.5, p10: 19.5, p50: 22.5, p90: 26.4 },
    { idadeMinima: 55, p5: 18.7, p10: 19.6, p50: 22.5, p90: 26.6 },
    { idadeMinima: 45, p5: 18.7, p10: 19.3, p50: 22.0, p90: 26.0 },
    { idadeMinima: 35, p5: 18.6, p10: 19.2, p50: 21.8, p90: 25.7 },
    { idadeMinima: 25, p5: 18.3, p10: 18.8, p50: 21.2, p90: 24.6 },
    { idadeMinima: 19, p5: 17.9, p10: 18.5, p50: 20.7, p90: 23.6 },
    { idadeMinima: 18, p5: 17.4, p10: 17.9, p50: 20.2, p90: 23.7 },
  ],
};

export interface ClassificacaoCmb {
  adequacaoPercentual: number;
  /** Blackburn & Thornton, 1979 — pela adequação ao percentil 50. */
  adequacao: Classificacao;
  /** Frisancho — pela faixa de percentil. */
  percentil: Classificacao;
  /** A tabela de Frisancho vai até 74 anos; acima disso usa a última faixa. */
  acimaDaTabela: boolean;
}

export function classificarCmb(cmb: number, sexo: SexoParaFormula, idade: number): ClassificacaoCmb | null {
  const faixa = FRISANCHO_CMB[sexo].find((f) => idade >= f.idadeMinima);
  if (!faixa) return null;

  const adequacaoPercentual = (cmb / faixa.p50) * 100;
  const fonteAdequacao = "Blackburn & Thornton, 1979";
  let adequacao: Classificacao;
  if (adequacaoPercentual >= 90) adequacao = { label: "Eutrofia", tom: "success", fonte: fonteAdequacao };
  else if (adequacaoPercentual >= 80) adequacao = { label: "Desnutrição leve", tom: "warning", fonte: fonteAdequacao };
  else if (adequacaoPercentual >= 70) adequacao = { label: "Desnutrição moderada", tom: "destructive", fonte: fonteAdequacao };
  else adequacao = { label: "Desnutrição grave", tom: "destructive", fonte: fonteAdequacao };

  const fontePercentil = "Frisancho, 1981";
  let percentil: Classificacao;
  if (cmb < faixa.p5) percentil = { label: "Abaixo do P5 — deficiência de massa magra", tom: "destructive", fonte: fontePercentil };
  else if (cmb < faixa.p10) percentil = { label: "P5 a P10 — baixa massa magra", tom: "warning", fonte: fontePercentil };
  else if (cmb <= faixa.p90) percentil = { label: "P10 a P90 — eutrofia", tom: "success", fonte: fontePercentil };
  else percentil = { label: "Acima do P90 — musculatura desenvolvida", tom: "success", fonte: fontePercentil };

  return { adequacaoPercentual, adequacao, percentil, acimaDaTabela: idade >= 75 };
}

/** Circunferência da panturrilha em idosos: abaixo de 31 cm indica perda de massa muscular. OMS, 1995. */
export function classificarPanturrilhaIdoso(cpCm: number): Classificacao {
  return cpCm < 31
    ? { label: "Indicativo de perda de massa muscular", tom: "warning", fonte: "OMS, 1995" }
    : { label: "Adequada", tom: "success", fonte: "OMS, 1995" };
}

// ---------------------------------------------------------------------------
// Fracionamento em quatro componentes (gordura, osso, residual, músculo)
// ---------------------------------------------------------------------------

/** Peso ósseo (kg) — Von Döbeln (1964) modificada por Rocha (1975): 3,02 × (H² × R × F × 400)^0,712, em metros. */
export function calcularPesoOsseo(alturaCm: number, diametroPunhoCm: number, diametroFemurCm: number): number {
  const h = alturaCm / 100;
  const r = diametroPunhoCm / 100;
  const f = diametroFemurCm / 100;
  return 3.02 * (h * h * r * f * 400) ** 0.712;
}

/** Peso residual (kg) — Würch, 1974: 24,1% do peso (homem) ou 20,9% (mulher). */
export function calcularPesoResidual(pesoKg: number, sexo: SexoParaFormula): number {
  return pesoKg * (sexo === "masculino" ? 0.241 : 0.209);
}

// ---------------------------------------------------------------------------
// Estimativas para quem não pode ser pesado/medido em pé (60 anos ou mais)
// ---------------------------------------------------------------------------

/** Altura (cm) pela altura do joelho — Chumlea, Roche & Mukherjee, 1985 (idosos). */
export function estimarAlturaPeloJoelho(alturaJoelhoCm: number, idade: number, sexo: SexoParaFormula): number {
  return sexo === "masculino"
    ? 64.19 - 0.04 * idade + 2.02 * alturaJoelhoCm
    : 84.88 - 0.24 * idade + 1.83 * alturaJoelhoCm;
}

export interface EstimarPesoInput {
  sexo: SexoParaFormula;
  alturaJoelhoCm: number;
  circunferenciaBracoCm: number;
  circunferenciaPanturrilhaCm: number;
  dobraSubescapularMm: number;
}

/** Peso (kg) de quem não pode ser pesado — Chumlea, Guo, Roche & Steinbaugh, 1988 (idosos). */
export function estimarPesoAcamado({
  sexo,
  alturaJoelhoCm: aj,
  circunferenciaBracoCm: cb,
  circunferenciaPanturrilhaCm: cp,
  dobraSubescapularMm: se,
}: EstimarPesoInput): number {
  return sexo === "masculino"
    ? 0.98 * cp + 1.16 * aj + 1.73 * cb + 0.37 * se - 81.69
    : 1.27 * cp + 0.87 * aj + 0.98 * cb + 0.4 * se - 62.35;
}

// ---------------------------------------------------------------------------
// Idade na data da avaliação
// ---------------------------------------------------------------------------

/** Idade em anos completos na data da avaliação (não na data de hoje). Datas yyyy-mm-dd. */
export function idadeNaData(dataNascimento: string | null | undefined, data: string): number | null {
  if (!dataNascimento || !data) return null;
  const [an, mn, dn] = dataNascimento.split("-").map(Number);
  const [a, m, d] = data.split("-").map(Number);
  if (!an || !a) return null;
  let idade = a - an;
  if (m < mn || (m === mn && d < dn)) idade--;
  return idade >= 0 ? idade : null;
}
