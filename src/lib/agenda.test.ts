import { describe, expect, it } from "vitest";
import {
  addDays,
  addMinutesToTimeStr,
  addMonths,
  formatMonthLabel,
  formatWeekRangeLabel,
  getMonthGridWeeks,
  getWeekDays,
  isSameMonth,
  minutesToTimeStr,
  rangesOverlap,
  timeStrToMinutes,
} from "@/lib/agenda";

describe("addDays", () => {
  it("soma dias cruzando o fim do mês", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
  });

  it("soma dias negativos cruzando o início do mês", () => {
    expect(addDays("2026-09-01", -1)).toBe("2026-08-31");
  });
});

describe("addMonths", () => {
  it("sempre volta ao dia 1, evitando estouro de mês curto", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-01");
  });

  it("cruza o fim do ano", () => {
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-01");
  });
});

describe("getWeekDays", () => {
  it("retorna os 7 dias da semana (domingo a sábado) contendo a data", () => {
    // 2026-09-17 é uma quinta-feira.
    const week = getWeekDays("2026-09-17");
    expect(week).toEqual([
      "2026-09-13",
      "2026-09-14",
      "2026-09-15",
      "2026-09-16",
      "2026-09-17",
      "2026-09-18",
      "2026-09-19",
    ]);
  });
});

describe("getMonthGridWeeks", () => {
  it("cobre o mês inteiro com semanas completas, incluindo dias do mês anterior/seguinte", () => {
    const weeks = getMonthGridWeeks("2026-09-17");
    const allDays = weeks.flat();

    // Setembro/2026 começa numa terça (01) e termina numa quarta (30).
    expect(allDays[0]).toBe("2026-08-30"); // domingo antes do dia 1
    expect(allDays[allDays.length - 1]).toBe("2026-10-03"); // sábado depois do dia 30
    expect(allDays).toContain("2026-09-01");
    expect(allDays).toContain("2026-09-30");
    for (const week of weeks) {
      expect(week).toHaveLength(7);
    }
  });
});

describe("isSameMonth", () => {
  it("compara apenas ano/mês, ignorando o dia", () => {
    expect(isSameMonth("2026-09-01", "2026-09-30")).toBe(true);
    expect(isSameMonth("2026-08-31", "2026-09-01")).toBe(false);
  });
});

describe("timeStrToMinutes / minutesToTimeStr", () => {
  it("converte HH:mm para minutos desde a meia-noite", () => {
    expect(timeStrToMinutes("08:30")).toBe(510);
    expect(timeStrToMinutes("00:00")).toBe(0);
    expect(timeStrToMinutes("23:59")).toBe(1439);
  });

  it("faz o caminho inverso", () => {
    expect(minutesToTimeStr(510)).toBe("08:30");
    expect(minutesToTimeStr(0)).toBe("00:00");
  });

  it("dá a volta à meia-noite para valores fora de [0, 1440)", () => {
    expect(minutesToTimeStr(1440)).toBe("00:00");
    expect(minutesToTimeStr(-15)).toBe("23:45");
  });
});

describe("addMinutesToTimeStr", () => {
  it("soma minutos dentro do mesmo dia", () => {
    expect(addMinutesToTimeStr("08:00", 60)).toBe("09:00");
    expect(addMinutesToTimeStr("08:00", 15)).toBe("08:15");
  });

  it("dá a volta à meia-noite", () => {
    expect(addMinutesToTimeStr("23:50", 20)).toBe("00:10");
  });
});

describe("rangesOverlap", () => {
  it("detecta sobreposição parcial", () => {
    expect(rangesOverlap(480, 540, 510, 570)).toBe(true); // 08-09 vs 08:30-09:30
  });

  it("intervalos adjacentes (fim de um = início do outro) NÃO se sobrepõem", () => {
    expect(rangesOverlap(480, 540, 540, 600)).toBe(false); // 08-09 vs 09-10
  });

  it("um intervalo contido no outro é sobreposição", () => {
    expect(rangesOverlap(480, 600, 500, 520)).toBe(true);
  });

  it("intervalos totalmente separados não se sobrepõem", () => {
    expect(rangesOverlap(480, 540, 600, 660)).toBe(false);
  });
});

describe("formatMonthLabel / formatWeekRangeLabel", () => {
  it("formata o mês por extenso em pt-BR", () => {
    expect(formatMonthLabel("2026-09-17")).toBe("setembro de 2026");
  });

  it("formata o intervalo da semana como dd/mm – dd/mm", () => {
    const week = getWeekDays("2026-09-17");
    expect(formatWeekRangeLabel(week)).toBe("13/9 – 19/9");
  });
});
