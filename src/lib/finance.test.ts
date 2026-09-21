import { describe, expect, it } from "vitest";
import type { Expense } from "@/lib/types/database.types";
import {
  advanceOneOccurrence,
  averageMonthlyAppointments,
  buildInstallmentPayments,
  costPerAppointment,
  deriveAppointmentBillingState,
  firstOccurrenceOnOrAfter,
  formatCurrencyBRL,
  latestOccurrencePerExpense,
  monthlyFixedCost,
  monthlyFixedCostByCategory,
  nextDueDate,
  normalizeToMonthly,
  occurrenceDateInMonth,
  splitInstallments,
  subtractCurrency,
  sumCurrency,
} from "./finance";

type ExpenseInput = Pick<Expense, "valor" | "recorrencia" | "ativa">;

function makeExpense(overrides: Partial<ExpenseInput> = {}): ExpenseInput {
  return {
    valor: 100,
    recorrencia: "mensal",
    ativa: true,
    ...overrides,
  };
}

describe("normalizeToMonthly", () => {
  it("mensal: mantém o valor como está", () => {
    expect(normalizeToMonthly(makeExpense({ valor: 300, recorrencia: "mensal" }))).toBe(300);
  });

  it("trimestral: divide por 3", () => {
    expect(normalizeToMonthly(makeExpense({ valor: 300, recorrencia: "trimestral" }))).toBe(100);
  });

  it("semestral: divide por 6", () => {
    expect(normalizeToMonthly(makeExpense({ valor: 600, recorrencia: "semestral" }))).toBe(100);
  });

  it("anual: divide por 12", () => {
    expect(normalizeToMonthly(makeExpense({ valor: 1200, recorrencia: "anual" }))).toBe(100);
  });

  it("unica: não entra no custo fixo recorrente (retorna 0)", () => {
    expect(normalizeToMonthly(makeExpense({ valor: 5000, recorrencia: "unica" }))).toBe(0);
  });
});

describe("monthlyFixedCost", () => {
  it("soma despesas ativas normalizadas para base mensal", () => {
    const expenses = [
      makeExpense({ valor: 300, recorrencia: "mensal" }), // 300
      makeExpense({ valor: 300, recorrencia: "trimestral" }), // 100
      makeExpense({ valor: 1200, recorrencia: "anual" }), // 100
    ];
    expect(monthlyFixedCost(expenses)).toBe(500);
  });

  it("despesa 'unica' não entra na soma do custo fixo", () => {
    const expenses = [
      makeExpense({ valor: 300, recorrencia: "mensal" }),
      makeExpense({ valor: 9999, recorrencia: "unica" }),
    ];
    expect(monthlyFixedCost(expenses)).toBe(300);
  });

  it("despesa inativa não entra na soma, mesmo sendo recorrente", () => {
    const expenses = [
      makeExpense({ valor: 300, recorrencia: "mensal", ativa: true }),
      makeExpense({ valor: 500, recorrencia: "mensal", ativa: false }),
    ];
    expect(monthlyFixedCost(expenses)).toBe(300);
  });

  it("lista vazia resulta em custo fixo zero", () => {
    expect(monthlyFixedCost([])).toBe(0);
  });

  it("precisão decimal: soma de 0.1 + 0.2, três vezes, dá exatamente 0.9", () => {
    const expenses = [
      makeExpense({ valor: 0.1 }),
      makeExpense({ valor: 0.2 }),
      makeExpense({ valor: 0.1 }),
      makeExpense({ valor: 0.2 }),
      makeExpense({ valor: 0.1 }),
      makeExpense({ valor: 0.2 }),
    ];
    // Em ponto flutuante puro, 0.1 + 0.2 repetido resulta em algo como
    // 0.8999999999999999 ou 0.9000000000000001 — nunca exatamente 0.9.
    expect(monthlyFixedCost(expenses)).toBe(0.9);
  });
});

describe("costPerAppointment", () => {
  it("divide o custo mensal pelo número de atendimentos", () => {
    expect(costPerAppointment(1000, 40)).toBe(25);
  });

  it("zero atendimentos por mês não quebra — retorna 0", () => {
    expect(costPerAppointment(1000, 0)).toBe(0);
  });

  it("número negativo de atendimentos não quebra — retorna 0", () => {
    expect(costPerAppointment(1000, -5)).toBe(0);
  });

  it("NaN não quebra — retorna 0", () => {
    expect(costPerAppointment(1000, NaN)).toBe(0);
  });
});

describe("splitInstallments", () => {
  it("divide igualmente quando o valor é exatamente divisível", () => {
    expect(splitInstallments(300, 3)).toEqual([100, 100, 100]);
  });

  it("distribui o resto de centavos nas primeiras parcelas, e a soma bate com o total", () => {
    const parcelas = splitInstallments(100, 3);
    expect(parcelas).toEqual([33.34, 33.33, 33.33]);
    expect(parcelas.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 2);
  });

  it("uma parcela devolve o valor total inteiro", () => {
    expect(splitInstallments(250, 1)).toEqual([250]);
  });

  it("zero ou número inválido de parcelas retorna lista vazia, sem quebrar", () => {
    expect(splitInstallments(100, 0)).toEqual([]);
    expect(splitInstallments(100, -2)).toEqual([]);
    expect(splitInstallments(100, NaN)).toEqual([]);
  });
});

describe("monthlyFixedCostByCategory", () => {
  function makeCategorizedExpense(overrides: Partial<ExpenseInput> & { categoria: string }) {
    return { ...makeExpense(overrides), categoria: overrides.categoria };
  }

  it("soma por categoria, ordenado da maior para a menor", () => {
    const expenses = [
      makeCategorizedExpense({ categoria: "Aluguel", valor: 1000, recorrencia: "mensal" }),
      makeCategorizedExpense({ categoria: "Software", valor: 100, recorrencia: "mensal" }),
      makeCategorizedExpense({ categoria: "Software", valor: 300, recorrencia: "trimestral" }), // +100/mês
    ];

    expect(monthlyFixedCostByCategory(expenses)).toEqual([
      { categoria: "Aluguel", custoMensal: 1000 },
      { categoria: "Software", custoMensal: 200 },
    ]);
  });

  it("ignora despesa inativa e categorias que resultariam em zero", () => {
    const expenses = [
      makeCategorizedExpense({ categoria: "Aluguel", valor: 1000, recorrencia: "mensal", ativa: false }),
      makeCategorizedExpense({ categoria: "Marketing", valor: 500, recorrencia: "unica" }),
    ];

    expect(monthlyFixedCostByCategory(expenses)).toEqual([]);
  });
});

describe("averageMonthlyAppointments", () => {
  it("divide a contagem de 3 meses por 3, arredondando", () => {
    expect(averageMonthlyAppointments(9)).toBe(3);
    expect(averageMonthlyAppointments(10)).toBe(3);
    expect(averageMonthlyAppointments(11)).toBe(4);
  });

  it("zero atendimentos resulta em média zero, sem quebrar", () => {
    expect(averageMonthlyAppointments(0)).toBe(0);
  });
});

describe("formatCurrencyBRL", () => {
  it("formata em pt-BR com símbolo de reais", () => {
    expect(formatCurrencyBRL(1234.56)).toBe("R$ 1.234,56");
  });

  it("formata zero corretamente", () => {
    expect(formatCurrencyBRL(0)).toBe("R$ 0,00");
  });
});

describe("nextDueDate", () => {
  it("'unica' retorna a própria data_vencimento", () => {
    const expense = {
      recorrencia: "unica" as const,
      dia_vencimento: null,
      mes_vencimento: null,
      data_vencimento: "2026-05-20",
    };
    expect(nextDueDate(expense)).toBe("2026-05-20");
  });

  it("mensal: antes do dia de vencimento no mês, cai no mês atual", () => {
    const expense = {
      recorrencia: "mensal" as const,
      dia_vencimento: 15,
      mes_vencimento: null,
      data_vencimento: null,
    };
    const today = new Date(Date.UTC(2026, 0, 10)); // 10/01/2026
    expect(nextDueDate(expense, today)).toBe("2026-01-15");
  });

  it("mensal: depois do dia de vencimento no mês, cai no mês seguinte", () => {
    const expense = {
      recorrencia: "mensal" as const,
      dia_vencimento: 15,
      mes_vencimento: null,
      data_vencimento: null,
    };
    const today = new Date(Date.UTC(2026, 0, 20)); // 20/01/2026
    expect(nextDueDate(expense, today)).toBe("2026-02-15");
  });

  it("trimestral: usa mes_vencimento como fase — meses fixos do calendário", () => {
    const expense = {
      recorrencia: "trimestral" as const,
      dia_vencimento: 10,
      mes_vencimento: 3, // fase: mar/jun/set/dez
      data_vencimento: null,
    };
    const today = new Date(Date.UTC(2026, 6, 1)); // 01/07/2026 — depois de jun/10, antes de set/10
    expect(nextDueDate(expense, today)).toBe("2026-09-10");
  });

  it("semestral: dois meses fixos por ano, 6 meses de intervalo", () => {
    const expense = {
      recorrencia: "semestral" as const,
      dia_vencimento: 5,
      mes_vencimento: 3, // fase: mar/set
      data_vencimento: null,
    };
    const today = new Date(Date.UTC(2026, 3, 1)); // 01/04/2026 — depois de mar/05, antes de set/05
    expect(nextDueDate(expense, today)).toBe("2026-09-05");
  });

  it("anual: mesmo mês todo ano", () => {
    const expense = {
      recorrencia: "anual" as const,
      dia_vencimento: 20,
      mes_vencimento: 11,
      data_vencimento: null,
    };
    const today = new Date(Date.UTC(2026, 0, 1)); // 01/01/2026 — antes de nov/20/2026
    expect(nextDueDate(expense, today)).toBe("2026-11-20");
  });

  it("anual: já passou este ano, cai no mesmo mês do ano seguinte", () => {
    const expense = {
      recorrencia: "anual" as const,
      dia_vencimento: 20,
      mes_vencimento: 11,
      data_vencimento: null,
    };
    const today = new Date(Date.UTC(2026, 11, 1)); // 01/12/2026 — depois de nov/20/2026
    expect(nextDueDate(expense, today)).toBe("2027-11-20");
  });

  it("trimestral/semestral/anual sem mes_vencimento retorna null, sem quebrar", () => {
    const expense = {
      recorrencia: "trimestral" as const,
      dia_vencimento: 10,
      mes_vencimento: null,
      data_vencimento: null,
    };
    expect(nextDueDate(expense)).toBeNull();
  });

  it("dia 31 num mês mais curto é limitado ao último dia do mês", () => {
    const expense = {
      recorrencia: "mensal" as const,
      dia_vencimento: 31,
      mes_vencimento: null,
      data_vencimento: null,
    };
    const today = new Date(Date.UTC(2026, 1, 1)); // 01/02/2026 — depois de jan/31
    expect(nextDueDate(expense, today)).toBe("2026-02-28");
  });
});

describe("occurrenceDateInMonth", () => {
  it("mensal vence todo mês, no dia informado", () => {
    const expense = { recorrencia: "mensal" as const, dia_vencimento: 10, mes_vencimento: null, data_vencimento: null };
    expect(occurrenceDateInMonth(expense, 2026, 0)).toBe("2026-01-10");
    expect(occurrenceDateInMonth(expense, 2026, 5)).toBe("2026-06-10");
  });

  it("trimestral só vence nos meses da fase — os outros retornam null", () => {
    const expense = {
      recorrencia: "trimestral" as const,
      dia_vencimento: 10,
      mes_vencimento: 3,
      data_vencimento: null,
    };
    // fase: mar(2)/jun(5)/set(8)/dez(11), 0-indexado
    expect(occurrenceDateInMonth(expense, 2026, 2)).toBe("2026-03-10");
    expect(occurrenceDateInMonth(expense, 2026, 5)).toBe("2026-06-10");
    expect(occurrenceDateInMonth(expense, 2026, 3)).toBeNull();
  });

  it("'unica' só vence no próprio mês de data_vencimento", () => {
    const expense = {
      recorrencia: "unica" as const,
      dia_vencimento: null,
      mes_vencimento: null,
      data_vencimento: "2026-05-20",
    };
    expect(occurrenceDateInMonth(expense, 2026, 4)).toBe("2026-05-20");
    expect(occurrenceDateInMonth(expense, 2026, 5)).toBeNull();
    expect(occurrenceDateInMonth(expense, 2027, 4)).toBeNull();
  });
});

describe("firstOccurrenceOnOrAfter", () => {
  it("mensal: inclui o mês de referência mesmo que o dia já tenha passado", () => {
    const expense = { recorrencia: "mensal" as const, dia_vencimento: 10, mes_vencimento: null, data_vencimento: null };
    const referencia = new Date(Date.UTC(2026, 8, 20)); // 20/09/2026 — dia 10 já passou
    expect(firstOccurrenceOnOrAfter(expense, referencia)).toBe("2026-09-10");
  });

  it("trimestral: pula pro primeiro mês da fase quando o mês de referência não bate", () => {
    const expense = {
      recorrencia: "trimestral" as const,
      dia_vencimento: 10,
      mes_vencimento: 3, // fase: mar/jun/set/dez
      data_vencimento: null,
    };
    const referencia = new Date(Date.UTC(2026, 7, 20)); // ago/2026 não é mês de fase — pula pro set
    expect(firstOccurrenceOnOrAfter(expense, referencia)).toBe("2026-09-10");
  });

  it("'unica' retorna a própria data_vencimento, ignorando a referência", () => {
    const expense = {
      recorrencia: "unica" as const,
      dia_vencimento: null,
      mes_vencimento: null,
      data_vencimento: "2026-05-20",
    };
    expect(firstOccurrenceOnOrAfter(expense)).toBe("2026-05-20");
  });
});

describe("advanceOneOccurrence", () => {
  it("mensal: avança um mês", () => {
    const expense = { recorrencia: "mensal" as const, dia_vencimento: 10, mes_vencimento: null, data_vencimento: null };
    expect(advanceOneOccurrence(expense, "2026-09-10")).toBe("2026-10-10");
  });

  it("trimestral: avança três meses", () => {
    const expense = {
      recorrencia: "trimestral" as const,
      dia_vencimento: 10,
      mes_vencimento: 3,
      data_vencimento: null,
    };
    expect(advanceOneOccurrence(expense, "2026-09-10")).toBe("2026-12-10");
  });

  it("anual: avança pro mesmo mês do ano seguinte", () => {
    const expense = { recorrencia: "anual" as const, dia_vencimento: 20, mes_vencimento: 11, data_vencimento: null };
    expect(advanceOneOccurrence(expense, "2026-11-20")).toBe("2027-11-20");
  });

  it("limita ao último dia do mês seguinte, quando mais curto", () => {
    const expense = { recorrencia: "mensal" as const, dia_vencimento: 31, mes_vencimento: null, data_vencimento: null };
    expect(advanceOneOccurrence(expense, "2026-01-31")).toBe("2026-02-28");
  });

  it("'unica' não avança — retorna null", () => {
    const expense = {
      recorrencia: "unica" as const,
      dia_vencimento: null,
      mes_vencimento: null,
      data_vencimento: "2026-05-20",
    };
    expect(advanceOneOccurrence(expense, "2026-05-20")).toBeNull();
  });
});

describe("latestOccurrencePerExpense", () => {
  it("pega a ocorrência mais recente de cada despesa, em qualquer ordem de entrada", () => {
    const occurrences = [
      { expense_id: "a", data_vencimento: "2026-09-10" },
      { expense_id: "b", data_vencimento: "2026-01-05" },
      { expense_id: "a", data_vencimento: "2026-10-10" },
      { expense_id: "b", data_vencimento: "2026-02-05" },
    ];
    const result = latestOccurrencePerExpense(occurrences);
    expect(result.get("a")?.data_vencimento).toBe("2026-10-10");
    expect(result.get("b")?.data_vencimento).toBe("2026-02-05");
  });

  it("lista vazia resulta em mapa vazio", () => {
    expect(latestOccurrencePerExpense([]).size).toBe(0);
  });
});

describe("sumCurrency", () => {
  it("soma exata sem erro de ponto flutuante", () => {
    expect(sumCurrency([0.1, 0.2, 0.1, 0.2, 0.1, 0.2])).toBe(0.9);
  });

  it("bate com a soma manual de uma lista de lançamentos", () => {
    const lancamentos = [150, 89.9, 200, 45.5];
    expect(sumCurrency(lancamentos)).toBe(485.4);
  });

  it("lista vazia soma zero", () => {
    expect(sumCurrency([])).toBe(0);
  });
});

describe("buildInstallmentPayments", () => {
  it("gera o número certo de parcelas, uma por mês a partir da data de início", () => {
    const parcelas = buildInstallmentPayments(300, 3, "2026-01-15");
    expect(parcelas).toHaveLength(3);
    expect(parcelas.map((p) => p.data_vencimento)).toEqual(["2026-01-15", "2026-02-15", "2026-03-15"]);
    expect(parcelas.map((p) => p.valor)).toEqual([100, 100, 100]);
  });

  it("a soma das parcelas bate exatamente com o valor total, mesmo com resto", () => {
    const parcelas = buildInstallmentPayments(100, 3, "2026-01-01");
    expect(sumCurrency(parcelas.map((p) => p.valor))).toBe(100);
  });

  it("avulso (1 parcela) vence na própria data de início", () => {
    const parcelas = buildInstallmentPayments(150, 1, "2026-03-20");
    expect(parcelas).toEqual([{ valor: 150, data_vencimento: "2026-03-20" }]);
  });

  it("início no dia 31 e uma parcela caindo em fevereiro é limitada ao dia 28", () => {
    const parcelas = buildInstallmentPayments(300, 3, "2026-01-31");
    // jan/31, fev (limitado a 28), mar/31
    expect(parcelas.map((p) => p.data_vencimento)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });

  it("atravessa a virada de ano corretamente", () => {
    const parcelas = buildInstallmentPayments(200, 2, "2026-12-10");
    expect(parcelas.map((p) => p.data_vencimento)).toEqual(["2026-12-10", "2027-01-10"]);
  });
});

describe("deriveAppointmentBillingState", () => {
  it("sem payments e sem status 'gratuito' → null (nunca definido)", () => {
    expect(deriveAppointmentBillingState(null, [])).toEqual({ status: null });
  });

  it("sem payments mas status 'gratuito' → gratuito", () => {
    expect(deriveAppointmentBillingState("gratuito", [])).toEqual({ status: "gratuito" });
  });

  it("1 payment pendente → não pago", () => {
    const state = deriveAppointmentBillingState("nao_pago", [
      { valor: 150, data_vencimento: "2026-09-25", data_pagamento: null, forma_pagamento: null },
    ]);
    expect(state).toEqual({ status: "nao_pago", naoPagoValor: 150, naoPagoVencimento: "2026-09-25" });
  });

  it("1 payment pago → pagou integral", () => {
    const state = deriveAppointmentBillingState("pagou_integral", [
      { valor: 150, data_vencimento: "2026-09-25", data_pagamento: "2026-09-25", forma_pagamento: "pix" },
    ]);
    expect(state).toEqual({
      status: "pagou_integral",
      integralValor: 150,
      integralData: "2026-09-25",
      integralForma: "pix",
    });
  });

  it("2 payments (1 pago + 1 pendente) → pagou sinal", () => {
    const state = deriveAppointmentBillingState("pagou_sinal", [
      { valor: 50, data_vencimento: "2026-09-20", data_pagamento: "2026-09-20", forma_pagamento: "pix" },
      { valor: 100, data_vencimento: "2026-09-25", data_pagamento: null, forma_pagamento: null },
    ]);
    expect(state).toEqual({
      status: "pagou_sinal",
      sinalValor: 50,
      sinalData: "2026-09-20",
      sinalForma: "pix",
      faltaValor: 100,
      faltaVencimento: "2026-09-25",
    });
  });

  it("formato inesperado (ex.: 2 pagos, ou 3+ payments) não quebra — retorna status null", () => {
    const doisPagos = deriveAppointmentBillingState("pagou_sinal", [
      { valor: 50, data_vencimento: "2026-09-20", data_pagamento: "2026-09-20", forma_pagamento: "pix" },
      { valor: 100, data_vencimento: "2026-09-25", data_pagamento: "2026-09-25", forma_pagamento: "dinheiro" },
    ]);
    expect(doisPagos.status).toBeNull();
  });
});

describe("subtractCurrency", () => {
  it("subtrai exatamente, sem erro de ponto flutuante", () => {
    expect(subtractCurrency(1, 0.9)).toBe(0.1);
  });

  it("resultado negativo é permitido (a validação de 'sinal < total' é responsabilidade de quem chama)", () => {
    expect(subtractCurrency(50, 100)).toBe(-50);
  });
});

