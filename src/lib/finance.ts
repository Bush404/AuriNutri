import type { Expense } from "@/lib/types/database.types";

/**
 * Todo cálculo monetário aqui opera em CENTAVOS (inteiros) internamente,
 * nunca somando reais em ponto flutuante — 0.1 + 0.2 !== 0.3 em JS, e o erro
 * fica visível ao somar um mês inteiro de despesas. Só a função pública
 * converte de volta para reais, arredondando uma única vez no fim.
 */
const CENTAVOS_POR_REAL = 100;

function reaisParaCentavos(valor: number): number {
  return Math.round(valor * CENTAVOS_POR_REAL);
}

function centavosParaReais(centavos: number): number {
  return centavos / CENTAVOS_POR_REAL;
}

/** Soma valores monetários em centavos, evitando erro de ponto flutuante — mesmo cuidado do resto do módulo. */
export function sumCurrency(valores: number[]): number {
  const totalCentavos = valores.reduce((soma, valor) => soma + reaisParaCentavos(valor), 0);
  return centavosParaReais(totalCentavos);
}

/**
 * Quantos meses separam duas ocorrências de cada recorrência — usado tanto
 * para normalizar o valor para base mensal (divisor) quanto para achar a
 * próxima data de vencimento (intervalo entre ocorrências). 'unica' não tem
 * intervalo: não recorre.
 */
const MESES_POR_RECORRENCIA: Record<Expense["recorrencia"], number | null> = {
  unica: null,
  mensal: 1,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

type ExpenseParaCalculo = Pick<Expense, "valor" | "recorrencia" | "ativa">;

/**
 * Converte qualquer recorrência para sua base mensal equivalente, em reais.
 * Retorna 0 para despesas 'unica' — elas não fazem parte do custo fixo
 * recorrente do consultório (são um gasto pontual, não um custo mensal).
 */
export function normalizeToMonthly(expense: Pick<ExpenseParaCalculo, "valor" | "recorrencia">): number {
  const divisor = MESES_POR_RECORRENCIA[expense.recorrencia];
  if (divisor === null) return 0;
  return centavosParaReais(Math.round(reaisParaCentavos(expense.valor) / divisor));
}

/**
 * Soma o custo fixo mensal de todas as despesas ATIVAS, cada uma já
 * normalizada para base mensal. Despesas inativas ou 'unica' contribuem 0.
 * A soma acontece em centavos para não acumular erro de ponto flutuante.
 */
export function monthlyFixedCost(expenses: ExpenseParaCalculo[]): number {
  const totalCentavos = expenses
    .filter((expense) => expense.ativa)
    .reduce((soma, expense) => soma + reaisParaCentavos(normalizeToMonthly(expense)), 0);

  return centavosParaReais(totalCentavos);
}

export interface CategoryBreakdownItem {
  categoria: string;
  custoMensal: number;
}

/**
 * Quebra o custo fixo mensal por categoria — cada categoria soma as despesas
 * ativas já normalizadas para base mensal. Ordenado da maior para a menor.
 * Mesmo cuidado de precisão de `monthlyFixedCost`: soma em centavos.
 */
export function monthlyFixedCostByCategory(
  expenses: (ExpenseParaCalculo & { categoria: string })[]
): CategoryBreakdownItem[] {
  const totaisCentavos = new Map<string, number>();

  for (const expense of expenses) {
    if (!expense.ativa) continue;
    const centavos = reaisParaCentavos(normalizeToMonthly(expense));
    if (centavos === 0) continue;
    totaisCentavos.set(expense.categoria, (totaisCentavos.get(expense.categoria) ?? 0) + centavos);
  }

  return Array.from(totaisCentavos.entries())
    .map(([categoria, centavos]) => ({ categoria, custoMensal: centavosParaReais(centavos) }))
    .sort((a, b) => b.custoMensal - a.custoMensal);
}

/**
 * Quanto do custo fixo mensal cabe a cada atendimento, dado quantos
 * atendimentos o profissional faz por mês. Isto é o CUSTO por atendimento —
 * quanto cada consulta precisa cobrir para os custos fixos se pagarem. NÃO é
 * o preço da consulta: não inclui o que o profissional quer ganhar, imposto
 * nem custo variável. Cobrar exatamente este valor é trabalhar de graça.
 */
export function costPerAppointment(custoMensal: number, atendimentosPorMes: number): number {
  if (!Number.isFinite(atendimentosPorMes) || atendimentosPorMes <= 0) return 0;
  return centavosParaReais(Math.round(reaisParaCentavos(custoMensal) / atendimentosPorMes));
}

/** Média mensal de atendimentos a partir da contagem bruta de um período de 3 meses. */
export function averageMonthlyAppointments(realizadosUltimosTresMeses: number): number {
  if (!Number.isFinite(realizadosUltimosTresMeses) || realizadosUltimosTresMeses <= 0) return 0;
  return Math.round(realizadosUltimosTresMeses / 3);
}

/**
 * Formata um valor em reais no padrão pt-BR (ex.: "R$ 1.234,56"). O Intl do
 * Node separa "R$" do número com um espaço sem quebra (U+00A0) — trocado por
 * um espaço comum para não surpreender comparação de string em outro lugar.
 */
export function formatCurrencyBRL(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(" ", " ");
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Quantos dias tem um mês (0-indexado, como Date.getUTCMonth()), em UTC — evita depender do fuso do processo. */
function daysInMonthUtc(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

export interface ExpenseForNextDueDate {
  recorrencia: Expense["recorrencia"];
  dia_vencimento: number | null;
  /** Só existe para trimestral/semestral/anual — mensal recorre todo mês, não precisa fixar um. */
  mes_vencimento: number | null;
  data_vencimento: string | null;
}

/**
 * Data de vencimento de uma despesa DENTRO de um mês específico, ou null se
 * ela não vence nesse mês. Toda a aritmética é em ano/mês/dia inteiros —
 * nunca via Date.toISOString() a partir de um Date local, que poderia
 * empurrar a data para o dia anterior/seguinte dependendo do fuso do
 * processo. `month0` é 0-indexado (como Date.getUTCMonth()).
 *
 * Para 'unica', só "ocorre" no mês da própria data_vencimento. Para 'mensal',
 * ocorre todo mês, no dia informado. Para trimestral/semestral/anual,
 * mes_vencimento fixa a fase do ciclo — como o intervalo (3/6/12) sempre
 * divide 12 igualmente, os meses de vencimento caem sempre nos mesmos meses
 * todo ano (ex.: mês 3 + trimestral = vence em mar/jun/set/dez,
 * independentemente do ano), então a fase (mes_vencimento mod intervalo)
 * basta — não precisa de uma data de início. O dia é sempre limitado ao
 * último dia do mês candidato (ex.: dia 31 em fevereiro vira 28).
 *
 * Usada tanto por `nextDueDate` (busca o próximo mês que bate) quanto pela
 * geração do histórico de pagamento (`expense_occurrences`, Bloco B) — uma
 * ocorrência só é criada para um mês em que a despesa realmente vence.
 */
export function occurrenceDateInMonth(expense: ExpenseForNextDueDate, year: number, month0: number): string | null {
  if (expense.recorrencia === "unica") {
    if (!expense.data_vencimento) return null;
    const [vencYear, vencMonth] = expense.data_vencimento.split("-").map(Number);
    return vencYear === year && vencMonth === month0 + 1 ? expense.data_vencimento : null;
  }

  const dia = expense.dia_vencimento;
  const intervalo = MESES_POR_RECORRENCIA[expense.recorrencia];
  if (!dia || !intervalo) return null;

  if (expense.recorrencia !== "mensal") {
    if (!expense.mes_vencimento) return null;
    const fase = (expense.mes_vencimento - 1) % intervalo;
    if (((month0 % intervalo) + intervalo) % intervalo !== fase) return null;
  }

  const day = Math.min(dia, daysInMonthUtc(year, month0));
  return `${year}-${pad2(month0 + 1)}-${pad2(day)}`;
}

/**
 * Próxima data de vencimento de uma despesa a partir de "hoje", como
 * "yyyy-mm-dd" — procura mês a mês (com `occurrenceDateInMonth`) até achar o
 * primeiro que bate, olhando até 13 meses à frente (suficiente para
 * qualquer recorrência suportada, inclusive anual). Retorna null só se a
 * despesa não recorrer (dados incompletos).
 */
export function nextDueDate(expense: ExpenseForNextDueDate, today: Date = new Date()): string | null {
  if (expense.recorrencia === "unica") {
    return expense.data_vencimento;
  }

  let year = today.getUTCFullYear();
  let month0 = today.getUTCMonth();
  const todayDay = today.getUTCDate();

  for (let i = 0; i <= 12; i++) {
    const candidate = occurrenceDateInMonth(expense, year, month0);
    if (candidate) {
      const day = Number(candidate.slice(-2));
      if (i > 0 || day >= todayDay) return candidate;
    }
    month0 += 1;
    if (month0 > 11) {
      month0 = 0;
      year += 1;
    }
  }

  return null;
}

/**
 * Primeira ocorrência de uma despesa a partir de um mês de referência
 * (inclusive) — diferente de `nextDueDate`, NÃO pula o mês de referência
 * mesmo que o dia já tenha passado nele. Usada só para criar a primeira
 * ocorrência de uma despesa que ainda não tem nenhuma no histórico (ver
 * `ensureNextExpenseOccurrences`) — se o profissional só abre o financeiro
 * dia 20 e a despesa vence dia 10, ainda queremos registrar o vencimento
 * daquele mês (mesmo atrasado), não pular direto pro mês seguinte.
 */
export function firstOccurrenceOnOrAfter(expense: ExpenseForNextDueDate, referencia: Date = new Date()): string | null {
  if (expense.recorrencia === "unica") {
    return expense.data_vencimento;
  }

  let year = referencia.getUTCFullYear();
  let month0 = referencia.getUTCMonth();

  for (let i = 0; i <= 12; i++) {
    const candidate = occurrenceDateInMonth(expense, year, month0);
    if (candidate) return candidate;
    month0 += 1;
    if (month0 > 11) {
      month0 = 0;
      year += 1;
    }
  }

  return null;
}

/**
 * Data da ocorrência seguinte a partir de uma ocorrência já existente
 * (tipicamente a última paga) — avança exatamente um ciclo da recorrência
 * (1/3/6/12 meses), sempre no dia configurado (`dia_vencimento`), com o
 * mesmo cuidado de limitar ao último dia do mês candidato. É o que permite
 * pagar adiantado: assim que a parcela atual é paga, esta função calcula a
 * próxima — mesmo que o mês dela ainda não tenha chegado.
 */
export function advanceOneOccurrence(expense: ExpenseForNextDueDate, fromDateStr: string): string | null {
  const intervalo = MESES_POR_RECORRENCIA[expense.recorrencia];
  const dia = expense.dia_vencimento;
  if (expense.recorrencia === "unica" || !intervalo || !dia) return null;

  const [fromYear, fromMonth] = fromDateStr.split("-").map(Number);
  let year = fromYear;
  let month0 = fromMonth - 1 + intervalo;
  year += Math.floor(month0 / 12);
  month0 = ((month0 % 12) + 12) % 12;

  const day = Math.min(dia, daysInMonthUtc(year, month0));
  return `${year}-${pad2(month0 + 1)}-${pad2(day)}`;
}

/**
 * Agrupa ocorrências por despesa e devolve só a mais recente (maior
 * data_vencimento) de cada uma — comparação lexicográfica de string funciona
 * porque a data está sempre em "yyyy-mm-dd". Usada tanto para decidir se uma
 * despesa já tem uma parcela pendente (não gera outra) quanto para exibir
 * "a parcela atual" de cada despesa na tela.
 */
export function latestOccurrencePerExpense<T extends { expense_id: string; data_vencimento: string }>(
  occurrences: T[]
): Map<string, T> {
  const latest = new Map<string, T>();
  for (const occurrence of occurrences) {
    const current = latest.get(occurrence.expense_id);
    if (!current || occurrence.data_vencimento > current.data_vencimento) {
      latest.set(occurrence.expense_id, occurrence);
    }
  }
  return latest;
}

/**
 * Divide um valor total em N parcelas, distribuindo os centavos que sobram
 * (divisão não exata) nas primeiras parcelas — nunca arredondando cada
 * parcela de forma independente, o que poderia fazer a soma das parcelas não
 * bater com o valor total do pacote.
 */
export function splitInstallments(valorTotal: number, numeroParcelas: number): number[] {
  if (!Number.isFinite(numeroParcelas) || numeroParcelas <= 0) return [];

  const totalCentavos = reaisParaCentavos(valorTotal);
  const base = Math.floor(totalCentavos / numeroParcelas);
  const resto = totalCentavos - base * numeroParcelas;

  return Array.from({ length: numeroParcelas }, (_, i) => centavosParaReais(base + (i < resto ? 1 : 0)));
}

export interface InstallmentPayment {
  valor: number;
  /** "yyyy-mm-dd" */
  data_vencimento: string;
}

/**
 * Monta as parcelas de um pacote de paciente: divide o valor total
 * (`splitInstallments`) e distribui uma por mês a partir de `dataInicio`,
 * sempre no mesmo dia do mês (limitado ao último dia do mês candidato, ex.:
 * início dia 31 e uma parcela caindo em fevereiro vira dia 28). Extraída de
 * createPatientBilling pra ser testável isoladamente, sem precisar de banco.
 *
 * Toda a aritmética é em ano/mês/dia inteiros — nunca via `Date.setMonth()`
 * (que "rola" datas inválidas pro mês seguinte, ex.: 31/01 + 1 mês vira
 * 02 ou 03/03, não 28/02) nem `Date.toISOString()` a partir de um Date local
 * (que pode empurrar a data pro dia anterior/seguinte dependendo do fuso do
 * processo).
 */
export function buildInstallmentPayments(
  valorTotal: number,
  numeroParcelas: number,
  dataInicio: string
): InstallmentPayment[] {
  const valores = splitInstallments(valorTotal, numeroParcelas);
  const [anoInicial, mesInicial, diaInicial] = dataInicio.split("-").map(Number);

  return valores.map((valor, index) => {
    let month0 = mesInicial - 1 + index;
    const year = anoInicial + Math.floor(month0 / 12);
    month0 = ((month0 % 12) + 12) % 12;
    const day = Math.min(diaInicial, daysInMonthUtc(year, month0));
    return { valor, data_vencimento: `${year}-${pad2(month0 + 1)}-${pad2(day)}` };
  });
}
