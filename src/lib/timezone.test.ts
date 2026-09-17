import { describe, expect, it } from "vitest";
import { DEFAULT_TIME_ZONE, formatInTimeZone, utcInstantToZonedDateTime, zonedWallTimeToUtc } from "@/lib/timezone";

describe("zonedWallTimeToUtc", () => {
  it("converte 14:00 em America/Sao_Paulo (UTC-3, sem horário de verão) para 17:00 UTC", () => {
    const utc = zonedWallTimeToUtc("2026-09-20T14:00", DEFAULT_TIME_ZONE);
    expect(utc.toISOString()).toBe("2026-09-20T17:00:00.000Z");
  });

  it("é independente do fuso do processo que executa o código (não usa Date local implícito)", () => {
    // Mesma entrada, dois fusos diferentes, devem gerar instantes UTC diferentes.
    const saoPaulo = zonedWallTimeToUtc("2026-09-20T14:00", "America/Sao_Paulo");
    const utcZone = zonedWallTimeToUtc("2026-09-20T14:00", "UTC");
    expect(saoPaulo.getTime()).not.toBe(utcZone.getTime());
    expect(saoPaulo.getTime() - utcZone.getTime()).toBe(3 * 60 * 60 * 1000);
  });

  it("lida com meia-noite corretamente", () => {
    const utc = zonedWallTimeToUtc("2026-09-20T00:00", DEFAULT_TIME_ZONE);
    expect(utc.toISOString()).toBe("2026-09-20T03:00:00.000Z");
  });

  it("dá o mesmo resultado não importa o fuso do processo (servidor) — nunca lê process.env.TZ", () => {
    // Simula uma função serverless rodando num fuso bem diferente do Brasil.
    const originalTz = process.env.TZ;
    try {
      process.env.TZ = "Pacific/Kiritimati"; // UTC+14
      const emServidorExotico = zonedWallTimeToUtc("2026-09-20T14:00", DEFAULT_TIME_ZONE).toISOString();

      process.env.TZ = "UTC";
      const emServidorUtc = zonedWallTimeToUtc("2026-09-20T14:00", DEFAULT_TIME_ZONE).toISOString();

      expect(emServidorExotico).toBe("2026-09-20T17:00:00.000Z");
      expect(emServidorUtc).toBe("2026-09-20T17:00:00.000Z");
    } finally {
      process.env.TZ = originalTz;
    }
  });
});

describe("utcInstantToZonedDateTime", () => {
  it("decompõe o instante certo não importa o fuso do processo (servidor)", () => {
    const originalTz = process.env.TZ;
    try {
      const instanteUtc = "2026-09-20T17:00:00.000Z";

      process.env.TZ = "Pacific/Kiritimati";
      const emServidorExotico = utcInstantToZonedDateTime(instanteUtc, DEFAULT_TIME_ZONE);

      process.env.TZ = "UTC";
      const emServidorUtc = utcInstantToZonedDateTime(instanteUtc, DEFAULT_TIME_ZONE);

      expect(emServidorExotico).toEqual({ year: 2026, month: 9, day: 20, hour: 14, minute: 0, dateStr: "2026-09-20", timeStr: "14:00" });
      expect(emServidorUtc).toEqual(emServidorExotico);
    } finally {
      process.env.TZ = originalTz;
    }
  });
});

describe("formatInTimeZone", () => {
  it("exibe de volta o mesmo horário de parede, no fuso do profissional, independente do instante UTC armazenado", () => {
    const utcInstant = zonedWallTimeToUtc("2026-09-20T14:00", DEFAULT_TIME_ZONE).toISOString();
    const displayed = formatInTimeZone(utcInstant, DEFAULT_TIME_ZONE);
    expect(displayed).toContain("14:00");
  });

  it("o mesmo instante UTC aparece diferente em fusos diferentes", () => {
    const utcInstant = zonedWallTimeToUtc("2026-09-20T14:00", "America/Sao_Paulo").toISOString();
    const inSaoPaulo = formatInTimeZone(utcInstant, "America/Sao_Paulo");
    const inUtc = formatInTimeZone(utcInstant, "UTC");
    expect(inSaoPaulo).not.toBe(inUtc);
  });
});
