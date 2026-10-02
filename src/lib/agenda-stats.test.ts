import { describe, expect, it } from "vitest";
import { calcularAgendaStats, fimDaJanelaDeStats, inicioDaJanelaDeStats, type AgendaStatsRow } from "@/lib/agenda-stats";

const TZ = "America/Sao_Paulo"; // UTC−3
// Hoje: quinta, 2026-10-15. Semana: 12–18/out. Semana passada: 5–11/out.
const HOJE = "2026-10-15";
const AGORA = "2026-10-15T15:00:00.000Z"; // 12:00 em São Paulo

function row(dataHoraUtc: string, status: AgendaStatsRow["status"], patient = "p1"): AgendaStatsRow {
  return { data_hora: dataHoraUtc, status, patient_id: patient };
}

describe("janela de busca", () => {
  it("começa no que vier antes: segunda da semana passada ou dia 1 do mês anterior", () => {
    expect(inicioDaJanelaDeStats(HOJE)).toBe("2026-09-01");
    // Início de mês: a semana passada pode começar antes do mês anterior? Não aqui; e na virada do ano:
    expect(inicioDaJanelaDeStats("2026-01-02")).toBe("2025-12-01");
  });
  it("termina no que vier depois: fim da semana ou fim do mês", () => {
    expect(fimDaJanelaDeStats(HOJE)).toBe("2026-11-01");
    // 30/12/2026 é quarta; a semana vai até domingo 03/01/2027.
    expect(fimDaJanelaDeStats("2026-12-30")).toBe("2027-01-04");
  });
});

describe("calcularAgendaStats", () => {
  it("conta o dia de hoje no fuso, separa confirmadas/agendadas e ignora canceladas", () => {
    const stats = calcularAgendaStats(
      [
        row("2026-10-15T11:00:00.000Z", "realizado"), // 08:00 local
        row("2026-10-15T17:00:00.000Z", "confirmado"), // 14:00 local
        row("2026-10-15T20:00:00.000Z", "agendado"), // 17:00 local
        row("2026-10-15T21:00:00.000Z", "cancelado"),
        row("2026-10-16T02:00:00.000Z", "agendado"), // 23:00 local de HOJE
        row("2026-10-16T04:00:00.000Z", "agendado"), // 01:00 local de amanhã
      ],
      HOJE,
      AGORA,
      TZ
    );
    expect(stats.hoje).toEqual({ total: 4, confirmadas: 1, agendadas: 2 });
    expect(stats.proximasHoje).toBe(3); // 14:00, 17:00 e 23:00 (a realizada das 08:00 já passou)
  });

  it("compara a semana com a semana passada", () => {
    const stats = calcularAgendaStats(
      [
        row("2026-10-06T13:00:00.000Z", "realizado"),
        row("2026-10-07T13:00:00.000Z", "realizado"),
        row("2026-10-12T13:00:00.000Z", "realizado"),
        row("2026-10-13T13:00:00.000Z", "confirmado"),
        row("2026-10-18T13:00:00.000Z", "agendado"), // domingo ainda é desta semana
      ],
      HOJE,
      AGORA,
      TZ
    );
    expect(stats.semana).toEqual({ total: 3, variacao: 50 });
  });

  it("pacientes atendidos no mês contam pessoas distintas com consulta realizada", () => {
    const stats = calcularAgendaStats(
      [
        row("2026-10-01T13:00:00.000Z", "realizado", "a"),
        row("2026-10-08T13:00:00.000Z", "realizado", "a"),
        row("2026-10-09T13:00:00.000Z", "realizado", "b"),
        row("2026-10-10T13:00:00.000Z", "faltou", "c"),
        row("2026-09-10T13:00:00.000Z", "realizado", "a"),
      ],
      HOJE,
      AGORA,
      TZ
    );
    expect(stats.atendidosMes).toEqual({ total: 2, variacao: 100 });
  });

  it("sem base anterior, não há porcentagem", () => {
    const stats = calcularAgendaStats([row("2026-10-13T13:00:00.000Z", "agendado")], HOJE, AGORA, TZ);
    expect(stats.semana.variacao).toBeNull();
  });
});
