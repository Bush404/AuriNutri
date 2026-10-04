import type { ItemFonte, MealItem, MealItemSubstitution } from "@/lib/types/database.types";
import { calculateMealItemMacros, sumMacros, type MacroTotals } from "@/lib/nutrition";

/**
 * Rascunho da janela "Editar refeição" (Fase 19): tudo o que o profissional
 * muda fica aqui, na tela, até clicar em "Salvar alterações" — aí vai inteiro
 * para salvarRefeicao (src/lib/actions/meal-editor.ts).
 *
 * O rascunho só guarda DE ONDE vem a cópia dos valores nutricionais de cada
 * linha (`fonte`) e a quantidade. Os valores que aparecem na tela servem para
 * mostrar e somar; quem grava a cópia é sempre o servidor, a partir da fonte
 * (a própria linha gravada, outra linha da refeição ou o alimento/receita).
 */

/** De onde vem a cópia de valores nutricionais de uma linha. */
export type FonteSnapshot =
  | { de: "item"; id: string }
  | { de: "sub"; id: string }
  | { de: "alimento"; food_id: string }
  | { de: "receita"; recipe_id: string };

/**
 * Quantidade como o profissional digita (texto, para não brigar com vírgula e
 * campo vazio no meio da digitação). Em medida caseira, `medida_id` nulo = a
 * medida que já está copiada na linha de origem.
 */
export type QuantidadeRascunho =
  | { tipo: "g"; texto: string }
  | { tipo: "medida"; texto: string; medida_id: string | null; nome: string; gramas: number }
  | { tipo: "porcoes"; texto: string };

/** Só o que a tela precisa para mostrar e somar. */
export interface SnapshotRascunho {
  nome_alimento: string;
  fonte_alimento: ItemFonte;
  food_id: string | null;
  recipe_id: string | null;
  porcao_referencia_g: number;
  calorias_kcal: number;
  proteinas_g: number;
  carboidratos_g: number;
  gorduras_g: number;
  fibras_g: number;
}

export interface LinhaRascunho {
  /** Identidade na tela (estável, inclusive para linhas novas). */
  chave: string;
  /** Linha já gravada que esta linha atualiza; null = linha nova. */
  id: string | null;
  fonte: FonteSnapshot;
  snapshot: SnapshotRascunho;
  quantidade: QuantidadeRascunho;
}

export interface ItemRascunho extends LinhaRascunho {
  substitutos: LinhaRascunho[];
}

export interface RefeicaoRascunho {
  nome: string;
  horario: string;
  observacoes: string;
  itens: ItemRascunho[];
}

let contador = 0;
/** Chave nova para uma linha criada na tela. */
export function novaChave() {
  contador += 1;
  return `nova-${Date.now().toString(36)}-${contador}`;
}

/** Número digitado ("1,5", "2") ou NaN. */
export function numeroDigitado(texto: string): number {
  const t = texto.trim().replace(",", ".");
  return t === "" ? Number.NaN : Number(t);
}

/** Gramas que a linha representa (0 enquanto a quantidade não é um número válido). */
export function gramasDaLinha(l: Pick<LinhaRascunho, "quantidade" | "snapshot">): number {
  const n = numeroDigitado(l.quantidade.texto);
  if (!(n > 0)) return 0;
  if (l.quantidade.tipo === "g") return n;
  if (l.quantidade.tipo === "medida") return n * l.quantidade.gramas;
  return n * Number(l.snapshot.porcao_referencia_g);
}

/** Macros da linha pelo mesmo cálculo do resto do sistema (calculateMealItemMacros). */
export function macrosDaLinha(l: Pick<LinhaRascunho, "quantidade" | "snapshot">): MacroTotals {
  return calculateMealItemMacros({ ...l.snapshot, quantidade_g: gramasDaLinha(l) });
}

export function totaisDoRascunho(r: Pick<RefeicaoRascunho, "itens">): MacroTotals {
  return sumMacros(r.itens.map(macrosDaLinha));
}

export function pesoDoRascunho(r: Pick<RefeicaoRascunho, "itens">): number {
  return r.itens.reduce((s, i) => s + gramasDaLinha(i), 0);
}

/** Quantidade inválida (vazia, zero, negativa ou medida acima de 999) — impede salvar. */
export function quantidadeInvalida(q: QuantidadeRascunho): boolean {
  const n = numeroDigitado(q.texto);
  return !(n > 0) || (q.tipo !== "g" && n > 999);
}

export function linhasInvalidas(r: RefeicaoRascunho): string[] {
  const nomes: string[] = [];
  for (const i of r.itens) {
    if (quantidadeInvalida(i.quantidade)) nomes.push(i.snapshot.nome_alimento);
    for (const s of i.substitutos) if (quantidadeInvalida(s.quantidade)) nomes.push(s.snapshot.nome_alimento);
  }
  return nomes;
}

/** Número como o profissional lê e digita: "1,5" (até 2 casas). */
export const textoDeNumero = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");
const texto = textoDeNumero;

function snapshotDe(row: MealItem | MealItemSubstitution): SnapshotRascunho {
  return {
    nome_alimento: row.nome_alimento,
    fonte_alimento: row.fonte_alimento,
    food_id: row.food_id,
    recipe_id: "recipe_id" in row ? row.recipe_id : null,
    porcao_referencia_g: Number(row.porcao_referencia_g),
    calorias_kcal: Number(row.calorias_kcal),
    proteinas_g: Number(row.proteinas_g),
    carboidratos_g: Number(row.carboidratos_g),
    gorduras_g: Number(row.gorduras_g),
    fibras_g: Number(row.fibras_g),
  };
}

function quantidadeDe(row: MealItem | MealItemSubstitution): QuantidadeRascunho {
  if ("recipe_id" in row && row.recipe_id) {
    const porcoes = row.quantidade_porcoes ?? Number(row.quantidade_g) / (Number(row.porcao_referencia_g) || 1);
    return { tipo: "porcoes", texto: texto(porcoes) };
  }
  if (row.medida_nome && row.medida_gramas) {
    return {
      tipo: "medida",
      texto: texto(row.medida_quantidade ?? 1),
      medida_id: null,
      nome: row.medida_nome,
      gramas: Number(row.medida_gramas),
    };
  }
  return { tipo: "g", texto: texto(Number(row.quantidade_g)) };
}

/** Rascunho a partir do que está gravado. */
export function rascunhoDaRefeicao(meal: {
  nome: string;
  horario: string | null;
  observacoes: string;
  items: (MealItem & { meal_item_substitutions: MealItemSubstitution[] })[];
}): RefeicaoRascunho {
  return {
    nome: meal.nome,
    horario: meal.horario ? meal.horario.slice(0, 5) : "",
    observacoes: meal.observacoes,
    itens: meal.items.map((item) => ({
      chave: item.id,
      id: item.id,
      fonte: { de: "item", id: item.id },
      snapshot: snapshotDe(item),
      quantidade: quantidadeDe(item),
      substitutos: item.meal_item_substitutions.map((sub) => ({
        chave: sub.id,
        id: sub.id,
        fonte: { de: "sub", id: sub.id },
        snapshot: snapshotDe(sub),
        quantidade: quantidadeDe(sub),
      })),
    })),
  };
}

/**
 * Troca a unidade de uma linha: para gramas, mantém o peso atual; para uma
 * medida, começa em 1 (mesma regra de antes, em use-meal-item-editor).
 */
export function trocarUnidade<T extends LinhaRascunho>(
  l: T,
  nova: { tipo: "g" } | { tipo: "medida"; medida_id: string | null; nome: string; gramas: number },
): T {
  if (nova.tipo === "g") {
    return { ...l, quantidade: { tipo: "g", texto: texto(Math.round(gramasDaLinha(l) * 10) / 10) } };
  }
  return { ...l, quantidade: { ...nova, texto: "1" } };
}

/**
 * "Usar este": o substituto vira o alimento da refeição e o alimento vira
 * substituto, cada um com a própria quantidade e cópia (o antigo "inverter", Fase 17).
 * As linhas gravadas continuam as mesmas; o que troca é o conteúdo.
 */
export function usarSubstituto(r: RefeicaoRascunho, itemChave: string, subChave: string): RefeicaoRascunho {
  return {
    ...r,
    itens: r.itens.map((item) => {
      if (item.chave !== itemChave || item.snapshot.recipe_id) return item;
      const sub = item.substitutos.find((s) => s.chave === subChave);
      if (!sub) return item;
      return {
        ...item,
        fonte: sub.fonte,
        snapshot: sub.snapshot,
        quantidade: sub.quantidade,
        substitutos: item.substitutos.map((s) =>
          s.chave === subChave ? { ...s, fonte: item.fonte, snapshot: item.snapshot, quantidade: item.quantidade } : s,
        ),
      };
    }),
  };
}

/** O que vai para salvarRefeicao (e serve para saber se algo mudou). */
export function payloadDoRascunho(r: RefeicaoRascunho) {
  const linha = (l: LinhaRascunho) => ({
    id: l.id,
    fonte: l.fonte,
    quantidade:
      l.quantidade.tipo === "medida"
        ? { tipo: "medida" as const, valor: numeroDigitado(l.quantidade.texto), medida_id: l.quantidade.medida_id }
        : { tipo: l.quantidade.tipo, valor: numeroDigitado(l.quantidade.texto) },
  });
  return {
    nome: r.nome.trim(),
    horario: r.horario,
    observacoes: r.observacoes,
    itens: r.itens.map((i) => ({ ...linha(i), substitutos: i.substitutos.map(linha) })),
  };
}

export type PayloadRefeicao = ReturnType<typeof payloadDoRascunho>;

/** Observações vazias do editor ("<p></p>") contam como vazias. */
const observacaoNormalizada = (html: string) => (html.replace(/<p>\s*<\/p>/g, "").trim() === "" ? "" : html);

/** True quando o rascunho difere do que estava gravado. */
export function rascunhoAlterado(inicial: RefeicaoRascunho, atual: RefeicaoRascunho): boolean {
  const assinatura = (r: RefeicaoRascunho) =>
    JSON.stringify({ ...payloadDoRascunho(r), observacoes: observacaoNormalizada(r.observacoes) });
  return assinatura(inicial) !== assinatura(atual);
}
