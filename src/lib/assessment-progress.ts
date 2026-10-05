/**
 * Contadores de preenchimento das seções da avaliação de adultos (Fase 19,
 * 05/10/2026). Só leitura do que está digitado no formulário — nada é
 * gravado e nenhum resultado depende disto.
 */

export interface Progresso {
  preenchidos: number;
  /** Nulo quando "de quantos" não faz sentido (ninguém preenche todas as circunferências). */
  total: number | null;
  rotulo: string;
}

export const preenchido = (v: string | null | undefined) => typeof v === "string" && v.trim() !== "";

const contar = (valores: Record<string, string | undefined>, campos: readonly string[]) =>
  campos.filter((c) => preenchido(valores[c])).length;

const qtd = (n: number) => (n === 0 ? "Nenhum preenchido" : n === 1 ? "1 preenchido" : `${n} preenchidos`);

/** "1 de 4 preenchidos" — para seções em que todos os campos importam (dados básicos, diâmetros). */
export function progressoDeTotal(valores: Record<string, string | undefined>, campos: readonly string[]): Progresso {
  const n = contar(valores, campos);
  return { preenchidos: n, total: campos.length, rotulo: `${n} de ${campos.length} preenchido${campos.length === 1 ? "" : "s"}` };
}

/** "3 preenchidos" — para seções em que se preenche só o que interessa. */
export function progressoLivre(valores: Record<string, string | undefined>, campos: readonly string[]): Progresso {
  const n = contar(valores, campos);
  return { preenchidos: n, total: null, rotulo: qtd(n) };
}

/**
 * Dobras: com um protocolo escolhido (e a base masculino/feminino
 * definida), conta as dobras QUE O PROTOCOLO USA — "2 de 3 do protocolo"
 * mostra que falta uma para sair o % de gordura. Sem protocolo, conta todas.
 */
export function progressoDobras(
  valores: Record<string, string | undefined>,
  todas: readonly string[],
  doProtocolo: readonly string[],
): Progresso {
  if (doProtocolo.length === 0) return progressoLivre(valores, todas);
  const n = contar(valores, doProtocolo);
  return { preenchidos: n, total: doProtocolo.length, rotulo: `${n} de ${doProtocolo.length} do protocolo` };
}

/** Observações: texto livre, não tem "quantos". */
export function progressoTexto(texto: string | undefined): Progresso {
  const ok = preenchido(texto);
  return { preenchidos: ok ? 1 : 0, total: null, rotulo: ok ? "Preenchido" : "Vazio" };
}
