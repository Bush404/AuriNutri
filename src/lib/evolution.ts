/**
 * Evolução física (Fase 15, Bloco D — refeito após o uso, 30/09/2026).
 *
 * Dois produtos, ambos em PDF, no formato que a nutricionista usa no WebDiet:
 * - "Evolução": o profissional escolhe até 5 avaliações (ou relatórios
 *   anexados) e gera a comparação lado a lado (`montarComparacao`).
 * - "Relatório" de uma avaliação: inclui o histórico de peso, massa muscular
 *   e % de gordura das últimas avaliações até aquela data (`montarSeries`).
 *
 * Os valores calculados usam as mesmas funções da tela da avaliação — os
 * números batem com o que foi visto lá. Avaliações antigas (antes da Fase 15)
 * entram com o que tiverem.
 */

import { calcularResultados, sexoDasFormulas, type ResultadosAvaliacao } from "@/lib/anthropometry-results";
import { idadeNaData, type Classificacao } from "@/lib/anthropometry";
import { calcularResultadosCrianca, idadeEmMeses } from "@/lib/growth/growth";
import type { AnthropometricAssessment, AnthropometricAttachment, Sexo } from "@/lib/types/database.types";

export const MAX_ITENS_COMPARACAO = 5;

export interface EntradaEvolucao {
  assessments: AnthropometricAssessment[];
  attachments: AnthropometricAttachment[];
  sexo: Sexo | null;
  dataNascimento: string | null;
}

/** "a:<id>" = avaliação; "x:<id>" = relatório anexado. */
export type ChaveItem = `a:${string}` | `x:${string}`;

export interface ItemEvolucao {
  chave: ChaveItem;
  data: string;
  origem: "avaliacao" | "anexo";
  rotulo: string;
}

export function rotuloAvaliacao(a: Pick<AnthropometricAssessment, "tipo">) {
  return a.tipo === "crianca" ? "Avaliação infantil" : "Avaliação de adulto";
}

/** Tudo o que pode entrar numa comparação, mais recente primeiro. */
export function itensDisponiveis({ assessments, attachments }: Pick<EntradaEvolucao, "assessments" | "attachments">): ItemEvolucao[] {
  return [
    ...assessments.map((a) => ({ chave: `a:${a.id}` as ChaveItem, data: a.data_avaliacao, origem: "avaliacao" as const, rotulo: rotuloAvaliacao(a) })),
    ...attachments.map((x) => ({
      chave: `x:${x.id}` as ChaveItem,
      data: x.data_avaliacao,
      origem: "anexo" as const,
      rotulo: x.titulo || "Relatório externo",
    })),
  ].sort((a, b) => b.data.localeCompare(a.data) || a.chave.localeCompare(b.chave));
}

/** Seleção inicial para "Evolução" de um item: ele e os até 4 anteriores. */
export function selecaoPadrao(itens: ItemEvolucao[], chave: ChaveItem): ChaveItem[] {
  const i = itens.findIndex((x) => x.chave === chave);
  return (i < 0 ? itens : itens.slice(i)).slice(0, MAX_ITENS_COMPARACAO).map((x) => x.chave);
}

const CHAVE = /^[ax]:[0-9a-f-]{36}$/;

/** Lê `?itens=a:<id>,x:<id>` — só chaves válidas, sem repetir, no máximo 5. */
export function parseItens(valor: string | null | undefined): ChaveItem[] {
  return (valor ?? "")
    .split(",")
    .filter((v, i, arr): v is ChaveItem => CHAVE.test(v) && arr.indexOf(v) === i)
    .slice(0, MAX_ITENS_COMPARACAO);
}

// ---------------------------------------------------------------------------
// Comparação ("Evolução")
// ---------------------------------------------------------------------------

export interface ColunaComparacao {
  chave: ChaveItem;
  data: string;
  origem: "avaliacao" | "anexo";
  rotulo: string;
}

export interface LinhaComparacao {
  label: string;
  /** Texto pronto de cada coluna ("—" quando não há). */
  valores: string[];
  /** O número de cada coluna (nulo em linhas de texto ou sem valor). */
  numeros: (number | null)[];
  /** Variação em relação à coluna anterior com valor (só linhas numéricas). */
  deltas: (number | null)[];
  casas: number;
}

export interface ComposicaoPonto {
  data: string;
  pesoKg: number;
  massaGordaKg: number | null;
  massaLivreGorduraKg: number | null;
}

export interface Comparacao {
  colunas: ColunaComparacao[];
  analises: LinhaComparacao[];
  medidas: LinhaComparacao[];
  composicao: ComposicaoPonto[];
}

type Celula = number | string | Classificacao | null | undefined;

interface DadosColuna {
  a: AnthropometricAssessment | null;
  x: AnthropometricAttachment | null;
  r: ResultadosAvaliacao | null;
  crianca: ReturnType<typeof calcularResultadosCrianca> | null;
}

interface DefLinha {
  label: string;
  casas?: number;
  get: (d: DadosColuna) => Celula;
}

const ANALISES: DefLinha[] = [
  { label: "Peso (kg)", casas: 1, get: (d) => d.a?.peso_kg ?? d.x?.peso_kg },
  { label: "Altura (cm)", casas: 1, get: (d) => d.a?.altura_cm },
  { label: "IMC (kg/m²)", casas: 1, get: (d) => d.r?.imc ?? d.crianca?.imc },
  {
    label: "Classificação do IMC",
    get: (d) => d.r?.classificacaoImc ?? d.crianca?.indicadores.find((i) => i.indicador === "imc_idade")?.classificacao,
  },
  { label: "IMC/idade (escore-z)", casas: 2, get: (d) => d.crianca?.indicadores.find((i) => i.indicador === "imc_idade")?.z },
  { label: "Altura/idade (escore-z)", casas: 2, get: (d) => d.crianca?.indicadores.find((i) => i.indicador === "altura_idade")?.z },
  { label: "Relação cintura/quadril (RCQ)", casas: 2, get: (d) => d.r?.rcq },
  { label: "Risco metabólico por RCQ", get: (d) => d.r?.classificacaoRcq },
  { label: "Relação cintura/estatura (RCEst)", casas: 2, get: (d) => d.r?.rcest },
  { label: "Circ. muscular do braço (cm)", casas: 1, get: (d) => d.r?.cmb },
  { label: "Classificação da CMB", get: (d) => d.r?.classificacaoCmb?.adequacao },
  { label: "% de gordura", casas: 1, get: (d) => (d.a ? percentualGordura(d.a) : d.x?.percentual_gordura) },
  { label: "Classificação do % de gordura", get: (d) => d.r?.classificacaoGordura },
  { label: "Massa de gordura (kg)", casas: 1, get: (d) => (d.a ? massaGorda(d.a, d.r) : massaGordaAnexo(d.x)) },
  { label: "Massa livre de gordura (kg)", casas: 1, get: (d) => (d.a ? massaLivre(d.a, d.r) : d.x?.massa_livre_gordura_kg) },
  { label: "Massa muscular (kg)", casas: 1, get: (d) => d.r?.massaMuscularKg ?? d.a?.bio_massa_muscular_kg ?? d.x?.massa_muscular_kg },
  { label: "Massa residual (kg)", casas: 1, get: (d) => d.r?.pesoResidualKg },
  { label: "Peso ósseo (kg)", casas: 1, get: (d) => d.r?.pesoOsseoKg },
  { label: "Somatório de dobras (mm)", casas: 1, get: (d) => (d.a ? somaDobras(d.a) : null) },
  { label: "Densidade corporal (g/ml)", casas: 3, get: (d) => d.a?.densidade_corporal },
];

const MEDIDAS: DefLinha[] = [
  ...(
    [
      ["Dobra tricipital (mm)", "dobra_triceps_mm"],
      ["Dobra bicipital (mm)", "dobra_biceps_mm"],
      ["Dobra abdominal (mm)", "dobra_abdominal_mm"],
      ["Dobra subescapular (mm)", "dobra_subescapular_mm"],
      ["Dobra axilar média (mm)", "dobra_axilar_media_mm"],
      ["Dobra da coxa (mm)", "dobra_coxa_mm"],
      ["Dobra torácica (mm)", "dobra_peitoral_mm"],
      ["Dobra suprailíaca (mm)", "dobra_suprailiaca_mm"],
      ["Dobra da panturrilha (mm)", "dobra_panturrilha_mm"],
      ["Dobra supraespinhal (mm)", "dobra_supraespinhal_mm"],
      ["Circunferência do pescoço (cm)", "circunferencia_pescoco_cm"],
      ["Circunferência do tórax (cm)", "circunferencia_torax_cm"],
      ["Circunferência do ombro (cm)", "circunferencia_ombro_cm"],
      ["Circunferência da cintura (cm)", "circunferencia_cintura_cm"],
      ["Circunferência do quadril (cm)", "circunferencia_quadril_cm"],
      ["Circunferência do abdômen (cm)", "circunferencia_abdomen_cm"],
      ["Braço (formato antigo) (cm)", "circunferencia_braco_cm"],
      ["Braço relaxado D (cm)", "circunferencia_braco_relaxado_dir_cm"],
      ["Braço relaxado E (cm)", "circunferencia_braco_relaxado_esq_cm"],
      ["Braço contraído D (cm)", "circunferencia_braco_contraido_dir_cm"],
      ["Braço contraído E (cm)", "circunferencia_braco_contraido_esq_cm"],
      ["Antebraço D (cm)", "circunferencia_antebraco_dir_cm"],
      ["Antebraço E (cm)", "circunferencia_antebraco_esq_cm"],
      ["Coxa (formato antigo) (cm)", "circunferencia_coxa_cm"],
      ["Coxa proximal D (cm)", "circunferencia_coxa_proximal_dir_cm"],
      ["Coxa proximal E (cm)", "circunferencia_coxa_proximal_esq_cm"],
      ["Coxa medial D (cm)", "circunferencia_coxa_medial_dir_cm"],
      ["Coxa medial E (cm)", "circunferencia_coxa_medial_esq_cm"],
      ["Coxa distal D (cm)", "circunferencia_coxa_distal_dir_cm"],
      ["Coxa distal E (cm)", "circunferencia_coxa_distal_esq_cm"],
      ["Panturrilha D (cm)", "circunferencia_panturrilha_dir_cm"],
      ["Panturrilha E (cm)", "circunferencia_panturrilha_esq_cm"],
      ["Diâmetro do úmero (cm)", "diametro_umero_cm"],
      ["Diâmetro do punho (cm)", "diametro_punho_cm"],
      ["Diâmetro do fêmur (cm)", "diametro_femur_cm"],
      ["Bioimpedância: % de gordura", "bio_percentual_gordura"],
      ["Bioimpedância: massa muscular (kg)", "bio_massa_muscular_kg"],
      ["Bioimpedância: gordura visceral", "bio_gordura_visceral"],
      ["Bioimpedância: água corporal (%)", "bio_agua_corporal_percentual"],
    ] as [string, keyof AnthropometricAssessment][]
  ).map(([label, coluna]) => ({ label, casas: 1, get: (d: DadosColuna) => d.a?.[coluna] as number | null | undefined })),
];

/** % gravado (protocolo, Slaughter ou digitado em avaliação antiga); sem ele, o da bioimpedância. */
function percentualGordura(a: AnthropometricAssessment) {
  return a.percentual_gordura ?? a.bio_percentual_gordura ?? null;
}

function massaGorda(a: AnthropometricAssessment, r: ResultadosAvaliacao | null) {
  if (r?.massaGordaKg != null) return r.massaGordaKg;
  if (a.bio_massa_gorda_kg != null) return a.bio_massa_gorda_kg;
  const pg = percentualGordura(a);
  return pg !== null && a.peso_kg !== null ? (a.peso_kg * pg) / 100 : null;
}

function massaLivre(a: AnthropometricAssessment, r: ResultadosAvaliacao | null) {
  if (r?.massaLivreGorduraKg != null) return r.massaLivreGorduraKg;
  if (a.bio_massa_livre_gordura_kg != null) return a.bio_massa_livre_gordura_kg;
  const mg = massaGorda(a, r);
  return mg !== null && a.peso_kg !== null ? a.peso_kg - mg : null;
}

function massaGordaAnexo(x: AnthropometricAttachment | null) {
  if (!x) return null;
  if (x.peso_kg !== null && x.percentual_gordura !== null) return (x.peso_kg * x.percentual_gordura) / 100;
  if (x.peso_kg !== null && x.massa_livre_gordura_kg !== null) return x.peso_kg - x.massa_livre_gordura_kg;
  return null;
}

const COLUNAS_DOBRAS = [
  "dobra_triceps_mm",
  "dobra_biceps_mm",
  "dobra_abdominal_mm",
  "dobra_subescapular_mm",
  "dobra_axilar_media_mm",
  "dobra_coxa_mm",
  "dobra_peitoral_mm",
  "dobra_suprailiaca_mm",
  "dobra_panturrilha_mm",
  "dobra_supraespinhal_mm",
] as const;

function somaDobras(a: AnthropometricAssessment) {
  const v = COLUNAS_DOBRAS.map((c) => a[c]).filter((x): x is number => typeof x === "number");
  return v.length ? v.reduce((s, x) => s + x, 0) : null;
}

function dadosDaAvaliacao(a: AnthropometricAssessment, sexo: Sexo | null, dataNascimento: string | null): DadosColuna {
  const sexoFormula = sexoDasFormulas(sexo, a.sexo_referencia);
  if (a.tipo === "crianca") {
    const meses = idadeEmMeses(dataNascimento, a.data_avaliacao);
    return {
      a,
      x: null,
      r: null,
      crianca:
        sexoFormula && meses !== null
          ? calcularResultadosCrianca({ sexo: sexoFormula, meses, pesoKg: a.peso_kg, alturaCm: a.altura_cm })
          : null,
    };
  }
  return {
    a,
    x: null,
    r: calcularResultados(a, { sexo: sexoFormula, idade: idadeNaData(dataNascimento, a.data_avaliacao) }),
    crianca: null,
  };
}

const formatar = (v: number, casas: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

function montarLinhas(defs: DefLinha[], dados: DadosColuna[]): LinhaComparacao[] {
  return defs.flatMap((def) => {
    const brutos = dados.map((d) => def.get(d) ?? null);
    if (brutos.every((v) => v === null)) return [];
    const casas = def.casas ?? 0;
    const numeros = brutos.map((v) => (typeof v === "number" && Number.isFinite(v) ? v : null));
    let anterior: number | null = null;
    const deltas = numeros.map((v) => {
      if (v === null) return null;
      const delta: number | null = anterior === null ? null : v - anterior;
      anterior = v;
      return delta;
    });
    const valores = brutos.map((v) =>
      v === null ? "—" : typeof v === "number" ? formatar(v, casas) : typeof v === "string" ? v : v.label
    );
    return [{ label: def.label, valores, numeros, deltas: def.casas === undefined ? brutos.map(() => null) : deltas, casas }];
  });
}

/** Comparação das avaliações/relatórios escolhidos, em ordem de data (mais antiga à esquerda). */
export function montarComparacao(entrada: EntradaEvolucao, chaves: ChaveItem[]): Comparacao {
  const porChave = new Map<ChaveItem, { col: ColunaComparacao; dados: DadosColuna }>();
  for (const a of entrada.assessments) {
    porChave.set(`a:${a.id}`, {
      col: { chave: `a:${a.id}`, data: a.data_avaliacao, origem: "avaliacao", rotulo: rotuloAvaliacao(a) },
      dados: dadosDaAvaliacao(a, entrada.sexo, entrada.dataNascimento),
    });
  }
  for (const x of entrada.attachments) {
    porChave.set(`x:${x.id}`, {
      col: { chave: `x:${x.id}`, data: x.data_avaliacao, origem: "anexo", rotulo: x.titulo || "Relatório externo" },
      dados: { a: null, x, r: null, crianca: null },
    });
  }

  const escolhidos = chaves
    .map((c) => porChave.get(c))
    .filter((v): v is NonNullable<typeof v> => Boolean(v))
    .sort((p, q) => p.col.data.localeCompare(q.col.data));
  const dados = escolhidos.map((e) => e.dados);

  return {
    colunas: escolhidos.map((e) => e.col),
    analises: montarLinhas(ANALISES, dados),
    medidas: montarLinhas(MEDIDAS, dados),
    composicao: escolhidos.flatMap(({ col, dados: d }) => {
      const peso = d.a?.peso_kg ?? d.x?.peso_kg ?? null;
      if (peso === null) return [];
      const mg = d.a ? massaGorda(d.a, d.r) : massaGordaAnexo(d.x);
      const ml = d.a ? massaLivre(d.a, d.r) : d.x?.massa_livre_gordura_kg ?? (mg !== null ? peso - mg : null);
      return [{ data: col.data, pesoKg: peso, massaGordaKg: mg, massaLivreGorduraKg: ml }];
    }),
  };
}

// ---------------------------------------------------------------------------
// Histórico para o "Relatório" de uma avaliação
// ---------------------------------------------------------------------------

export interface PontoEvolucao {
  data: string;
  valor: number;
  origem: "avaliacao" | "anexo";
}

export type SerieHistorico = "peso" | "massa_muscular" | "percentual_gordura";

/** Peso, massa muscular e % de gordura das últimas `limite` avaliações/relatórios até `ate` (inclusive). */
export function montarHistorico(entrada: EntradaEvolucao, ate: string, limite = MAX_ITENS_COMPARACAO) {
  const itens = itensDisponiveis(entrada)
    .filter((i) => i.data <= ate)
    .slice(0, limite)
    .reverse();
  const c = montarComparacao(entrada, itens.map((i) => i.chave));
  const serie = (label: string): PontoEvolucao[] => {
    const linha = c.analises.find((l) => l.label === label);
    if (!linha) return [];
    return c.colunas.flatMap((col, i) => {
      const valor = linha.numeros[i];
      return valor === null ? [] : [{ data: col.data, valor, origem: col.origem }];
    });
  };
  return {
    datas: c.colunas.map((col) => col.data),
    peso: serie("Peso (kg)"),
    massa_muscular: serie("Massa muscular (kg)"),
    percentual_gordura: serie("% de gordura"),
  } satisfies { datas: string[] } & Record<SerieHistorico, PontoEvolucao[]>;
}
