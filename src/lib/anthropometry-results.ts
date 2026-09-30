/**
 * Todos os resultados de uma avaliação de adulto/idoso, a partir das medidas
 * gravadas. Uma função só, usada pela tela (ao vivo, enquanto digita), pelo
 * servidor (foto do % de gordura ao salvar) e pelo PDF — os três sempre batem.
 */

import {
  calcularCmb,
  calcularImc,
  calcularPercentualGordura,
  calcularPesoOsseo,
  calcularPesoResidual,
  classificarCmb,
  classificarImc,
  classificarPanturrilhaIdoso,
  classificarPercentualGordura,
  classificarRcest,
  classificarRcq,
  DOBRAS,
  faixaPesoIdeal,
  IDADE_IDOSO,
  percentualGorduraReferencia,
  type Classificacao,
  type ClassificacaoCmb,
  type Dobras,
  type FormulaDensidade,
  type ProtocoloDobras,
  type ResultadoGordura,
  type SexoParaFormula,
} from "@/lib/anthropometry";
import type { Sexo } from "@/lib/types/database.types";

/** Só os campos usados nos cálculos — serve tanto para a linha do banco quanto para o formulário. */
export interface MedidasAvaliacao {
  peso_kg: number | null;
  altura_cm: number | null;
  circunferencia_cintura_cm: number | null;
  circunferencia_quadril_cm: number | null;
  circunferencia_braco_relaxado_dir_cm: number | null;
  circunferencia_braco_relaxado_esq_cm: number | null;
  circunferencia_panturrilha_dir_cm: number | null;
  circunferencia_panturrilha_esq_cm: number | null;
  diametro_punho_cm: number | null;
  diametro_femur_cm: number | null;
  lado_referencia: "direito" | "esquerdo";
  protocolo_dobras: ProtocoloDobras | null;
  formula_densidade: FormulaDensidade;
  dobra_triceps_mm: number | null;
  dobra_biceps_mm: number | null;
  dobra_abdominal_mm: number | null;
  dobra_subescapular_mm: number | null;
  dobra_axilar_media_mm: number | null;
  dobra_coxa_mm: number | null;
  dobra_peitoral_mm: number | null;
  dobra_suprailiaca_mm: number | null;
  dobra_panturrilha_mm: number | null;
  dobra_supraespinhal_mm: number | null;
}

/**
 * Base masculino/feminino das fórmulas: o sexo do cadastro quando é um dos
 * dois; senão, a escolha do profissional na avaliação. Nunca assumida.
 */
export function sexoDasFormulas(sexoPaciente: Sexo | null, sexoReferencia: SexoParaFormula | null | undefined) {
  if (sexoPaciente === "masculino" || sexoPaciente === "feminino") return sexoPaciente;
  return sexoReferencia ?? null;
}

export function dobrasDaAvaliacao(m: MedidasAvaliacao): Dobras {
  return Object.fromEntries(DOBRAS.map((d) => [d, m[`dobra_${d}_mm` as keyof MedidasAvaliacao] as number | null]));
}

/** Medida do lado escolhido; se estiver vazio, a do outro lado (um lado basta). */
function doLado(m: MedidasAvaliacao, dir: number | null, esq: number | null) {
  return m.lado_referencia === "esquerdo" ? esq ?? dir : dir ?? esq;
}

export interface ResultadosAvaliacao {
  idade: number | null;
  idoso: boolean;
  sexo: SexoParaFormula | null;
  imc: number | null;
  classificacaoImc: Classificacao | null;
  pesoIdeal: { minKg: number; maxKg: number } | null;
  rcq: number | null;
  classificacaoRcq: Classificacao | null;
  rcest: number | null;
  classificacaoRcest: Classificacao | null;
  cmb: number | null;
  classificacaoCmb: ClassificacaoCmb | null;
  panturrilhaIdoso: Classificacao | null;
  /** Nulo quando nenhum protocolo foi escolhido. */
  gordura: ResultadoGordura | null;
  classificacaoGordura: Classificacao | null;
  percentualGorduraReferencia: number | null;
  massaGordaKg: number | null;
  massaLivreGorduraKg: number | null;
  pesoOsseoKg: number | null;
  pesoResidualKg: number | null;
  /** Peso − (gordura + ósseo + residual) — De Rose & Guimarães, 1980. Precisa dos diâmetros. */
  massaMuscularKg: number | null;
}

const positivo = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

export function calcularResultados(
  m: MedidasAvaliacao,
  { sexo, idade }: { sexo: SexoParaFormula | null; idade: number | null }
): ResultadosAvaliacao {
  const idoso = idade !== null && idade >= IDADE_IDOSO;
  const peso = positivo(m.peso_kg) ? m.peso_kg : null;
  const altura = positivo(m.altura_cm) ? m.altura_cm : null;

  const imc = peso && altura ? calcularImc(peso, altura) : null;
  const rcq =
    positivo(m.circunferencia_cintura_cm) && positivo(m.circunferencia_quadril_cm)
      ? m.circunferencia_cintura_cm / m.circunferencia_quadril_cm
      : null;
  const rcest = positivo(m.circunferencia_cintura_cm) && altura ? m.circunferencia_cintura_cm / altura : null;

  const braco = doLado(m, m.circunferencia_braco_relaxado_dir_cm, m.circunferencia_braco_relaxado_esq_cm);
  const cmb = positivo(braco) && positivo(m.dobra_triceps_mm) ? calcularCmb(braco, m.dobra_triceps_mm) : null;
  const panturrilha = doLado(m, m.circunferencia_panturrilha_dir_cm, m.circunferencia_panturrilha_esq_cm);

  const gordura =
    m.protocolo_dobras && sexo && peso && altura
      ? calcularPercentualGordura({
          protocolo: m.protocolo_dobras,
          formulaDensidade: m.formula_densidade,
          sexo,
          idade,
          pesoKg: peso,
          alturaCm: altura,
          dobras: dobrasDaAvaliacao(m),
        })
      : m.protocolo_dobras && !sexo
        ? ({ ok: false, motivo: "Escolha a base (masculino ou feminino) para as fórmulas." } as const)
        : null;

  const pg = gordura?.ok ? gordura.percentualGordura : null;
  const massaGordaKg = pg !== null && peso ? (peso * pg) / 100 : null;
  const pesoOsseoKg =
    altura && positivo(m.diametro_punho_cm) && positivo(m.diametro_femur_cm)
      ? calcularPesoOsseo(altura, m.diametro_punho_cm, m.diametro_femur_cm)
      : null;
  const pesoResidualKg = peso && sexo ? calcularPesoResidual(peso, sexo) : null;
  const massaMuscularKg =
    peso && massaGordaKg !== null && pesoOsseoKg !== null && pesoResidualKg !== null
      ? peso - (massaGordaKg + pesoOsseoKg + pesoResidualKg)
      : null;

  return {
    idade,
    idoso,
    sexo,
    imc,
    classificacaoImc: imc !== null ? classificarImc(imc, idade) : null,
    pesoIdeal: altura ? faixaPesoIdeal(altura, idade) : null,
    rcq,
    classificacaoRcq: rcq !== null && sexo ? classificarRcq(rcq, sexo) : null,
    rcest,
    classificacaoRcest: rcest !== null ? classificarRcest(rcest) : null,
    cmb,
    classificacaoCmb: cmb !== null && sexo && idade !== null ? classificarCmb(cmb, sexo, idade) : null,
    panturrilhaIdoso: idoso && positivo(panturrilha) ? classificarPanturrilhaIdoso(panturrilha) : null,
    gordura,
    classificacaoGordura: pg !== null && sexo ? classificarPercentualGordura(pg, sexo) : null,
    percentualGorduraReferencia: sexo ? percentualGorduraReferencia(sexo) : null,
    massaGordaKg,
    massaLivreGorduraKg: massaGordaKg !== null && peso ? peso - massaGordaKg : null,
    pesoOsseoKg,
    pesoResidualKg,
    massaMuscularKg,
  };
}
