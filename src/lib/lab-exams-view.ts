/**
 * Aba Exames (Fase 19, 05/10/2026): leitura dos exames já carregados — tipo,
 * resumo dos cartões e ordem. Nada é gravado aqui.
 *
 * Um exame é OU arquivo OU marcadores: "Anexar PDF/imagem" sempre cria com o
 * arquivo e "Preencher marcadores" nunca tem arquivo (decisão de 05/10/2026:
 * o nome na tabela só diz qual dos dois é).
 */

import type { LabExam, LabMarker } from "@/lib/types/database.types";

type Exame = Pick<LabExam, "data_coleta" | "created_at" | "arquivo_path"> & {
  lab_markers: Pick<LabMarker, "fora_da_faixa">[];
};

export type TipoExame = "pdf" | "imagem" | "marcadores";

export const TIPO_EXAME_LABEL: Record<TipoExame, string> = {
  pdf: "PDF anexado",
  imagem: "Imagem anexada",
  marcadores: "Marcadores",
};

export function tipoDoExame(e: Pick<LabExam, "arquivo_path">): TipoExame {
  if (!e.arquivo_path) return "marcadores";
  return e.arquivo_path.toLowerCase().endsWith(".pdf") ? "pdf" : "imagem";
}

/** Extensão do arquivo guardado (o nome original não é guardado: o arquivo vai com um nome aleatório). */
export function extensaoDoArquivo(path: string): string {
  return path.slice(path.lastIndexOf(".") + 1).toLowerCase();
}

/** Dias entre duas datas "yyyy-mm-dd" (sem fuso: as duas já estão no calendário do Brasil). */
export function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);
}

export function rotuloHaDias(dias: number): string {
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  return `há ${dias} dias`;
}

export function resumoExames(exames: Exame[]) {
  const comArquivo = exames.filter((e) => e.arquivo_path).length;
  const marcadores = exames.flatMap((e) => e.lab_markers);
  const maisRecente = exames.reduce<string | null>((max, e) => (max === null || e.data_coleta > max ? e.data_coleta : max), null);
  return {
    total: exames.length,
    comArquivo,
    comMarcadores: exames.length - comArquivo,
    maisRecente,
    marcadores: marcadores.length,
    foraDaFaixa: marcadores.filter((m) => m.fora_da_faixa).length,
  };
}

export type OrdemExames = "recentes" | "antigas";

export function ordenarExames<T extends Pick<LabExam, "data_coleta" | "created_at">>(exames: T[], ordem: OrdemExames): T[] {
  const sinal = ordem === "recentes" ? -1 : 1;
  return exames
    .slice()
    .sort((a, b) => sinal * (a.data_coleta.localeCompare(b.data_coleta) || a.created_at.localeCompare(b.created_at)));
}
