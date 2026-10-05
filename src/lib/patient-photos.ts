/**
 * Evolução fotográfica (Fase 19, 05/10/2026): nomes dos ângulos e regras da
 * tela — ordem, filtro e as datas sugeridas para comparar. Só organiza o que
 * já foi carregado; nenhuma foto é buscada aqui (cada visualização continua
 * gerando o link temporário e o registro de auditoria no servidor).
 */

import type { PatientPhoto, TipoFotoEvolucao } from "@/lib/types/database.types";

export const TIPO_FOTO_LABELS: Record<TipoFotoEvolucao, string> = {
  frente: "Frente",
  direita: "À direita",
  esquerda: "À esquerda",
  costas: "Costas",
  perfil: "Perfil",
};

/** Ângulos oferecidos no envio de foto nova. "perfil" só existe em fotos antigas (antes da migration 0050). */
export const TIPOS_FOTO_NOVOS = ["frente", "direita", "esquerda", "costas"] as const satisfies readonly TipoFotoEvolucao[];

/** Ordem de exibição dos ângulos (filtros e comparação). */
const ORDEM_TIPOS: TipoFotoEvolucao[] = ["frente", "direita", "esquerda", "costas", "perfil"];

export type OrdemFotos = "recentes" | "antigas";

/** Mais recentes (ou mais antigas) primeiro; na mesma data, a enviada por último/primeiro. */
export function ordenarFotos(fotos: PatientPhoto[], ordem: OrdemFotos): PatientPhoto[] {
  const sinal = ordem === "recentes" ? -1 : 1;
  return fotos
    .slice()
    .sort((a, b) => sinal * (a.data_registro.localeCompare(b.data_registro) || a.created_at.localeCompare(b.created_at)));
}

/**
 * Ângulos que aparecem nos filtros: os quatro de hoje sempre; "Perfil" só se
 * o paciente tiver alguma foto antiga assim.
 */
export function tiposDosFiltros(fotos: PatientPhoto[]): TipoFotoEvolucao[] {
  return ORDEM_TIPOS.filter((t) => t !== "perfil" || fotos.some((f) => f.tipo === "perfil"));
}

/** Ângulos com alguma foto, na ordem de exibição (as opções do "Comparar"). */
export function tiposComFoto(fotos: PatientPhoto[]): TipoFotoEvolucao[] {
  return ORDEM_TIPOS.filter((t) => fotos.some((f) => f.tipo === t));
}

/**
 * Sugestão ao escolher o ângulo: A = a penúltima foto, B = a mais recente.
 * Com menos de duas fotos do ângulo, não sugere nada (não há o que comparar).
 */
export function sugestaoComparacao(fotos: PatientPhoto[], tipo: TipoFotoEvolucao): { a: string; b: string } | null {
  const doTipo = ordenarFotos(
    fotos.filter((f) => f.tipo === tipo),
    "recentes",
  );
  return doTipo.length >= 2 ? { a: doTipo[1].id, b: doTipo[0].id } : null;
}
