/**
 * Lista de compras do plano (Fase 17, Bloco F): soma cada alimento do
 * cardápio pelo número de dias e agrupa por grupo da TACO (o "corredor" do
 * mercado). Receitas entram pelos ingredientes. Substitutos ficam de fora —
 * são opções, não somam.
 */
import { formatarMedida } from "@/lib/household-measures";

export interface EntradaListaDeCompras {
  /** Mesmo alimento = mesma chave (food_id, ou o nome quando o alimento foi excluído). */
  chave: string;
  nome: string;
  grupo: string | null;
  /** Gramas por dia. */
  gramas: number;
  /** Medida caseira em que foi prescrito (por dia), se houver. */
  medida?: { nome: string; gramas: number; quantidade: number } | null;
}

export interface ItemListaDeCompras {
  nome: string;
  gramas: number;
  texto: string;
}

export interface GrupoListaDeCompras {
  grupo: string;
  itens: ItemListaDeCompras[];
}

const num = (v: number, casas: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: casas });

/** 350 g · 1,4 kg */
export function formatarPeso(gramas: number): string {
  const g = Math.round(gramas);
  if (g >= 1000) return `${num(Math.round(g / 100) / 10, 1)} kg`;
  return `${num(g, 0)} g`;
}

export const SEM_GRUPO = "Outros";

export function montarListaDeCompras(entradas: EntradaListaDeCompras[], dias: number): GrupoListaDeCompras[] {
  const porChave = new Map<
    string,
    { nome: string; grupo: string; gramas: number; medidas: EntradaListaDeCompras["medida"][] }
  >();
  for (const e of entradas) {
    const atual = porChave.get(e.chave) ?? { nome: e.nome, grupo: e.grupo ?? SEM_GRUPO, gramas: 0, medidas: [] };
    atual.gramas += e.gramas;
    atual.medidas.push(e.medida ?? null);
    porChave.set(e.chave, atual);
  }

  const grupos = new Map<string, ItemListaDeCompras[]>();
  for (const a of porChave.values()) {
    const gramas = a.gramas * dias;
    // Em medida caseira só quando todas as vezes foi a mesma medida; senão, peso.
    const primeira = a.medidas[0];
    const mesmaMedida =
      primeira && a.medidas.every((m) => m && m.nome === primeira.nome && m.gramas === primeira.gramas);
    const texto =
      mesmaMedida && primeira
        ? formatarMedida(
            Math.round(a.medidas.reduce((s, m) => s + (m?.quantidade ?? 0), 0) * dias * 10) / 10,
            primeira.nome,
            primeira.gramas,
          ).replace(/\(([\d.,]+) g\)$/, `(${formatarPeso(gramas)})`)
        : formatarPeso(gramas);
    const lista = grupos.get(a.grupo) ?? [];
    lista.push({ nome: a.nome, gramas, texto });
    grupos.set(a.grupo, lista);
  }

  return [...grupos.entries()]
    .sort(([a], [b]) => (a === SEM_GRUPO ? 1 : b === SEM_GRUPO ? -1 : a.localeCompare(b, "pt-BR")))
    .map(([grupo, itens]) => ({ grupo, itens: itens.sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR")) }));
}
