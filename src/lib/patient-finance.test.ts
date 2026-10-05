import { describe, expect, it } from "vitest";

import {
  consultasDoPacote,
  estaVencido,
  pacoteAtivo,
  proximaCobranca,
  rotuloTipos,
  situacaoPagamento,
  type PacoteParaResumo,
} from "@/lib/patient-finance";
import type { AppointmentStatus } from "@/lib/types/database.types";

function cobranca(
  tipo: "avulso" | "pacote",
  data_inicio: string,
  consultas: AppointmentStatus[] = [],
  pagos: (string | null)[] = [null],
): PacoteParaResumo {
  return {
    tipo,
    numero_consultas: tipo === "pacote" ? 3 : null,
    data_inicio,
    created_at: `${data_inicio}T10:00:00Z`,
    payments: pagos.map((data_pagamento) => ({ data_pagamento })),
    pacote_consultas: consultas.map((status) => ({ status })),
  };
}

describe("financeiro do paciente", () => {
  it("pacote ativo: o mais recente com consulta ainda por acontecer", () => {
    const encerrado = cobranca("pacote", "2026-10-01", ["realizado", "realizado", "faltou"]);
    const antigo = cobranca("pacote", "2026-08-01", ["realizado", "agendado"]);
    const atual = cobranca("pacote", "2026-09-01", ["realizado", "confirmado", "agendado"]);
    expect(pacoteAtivo([encerrado, antigo, atual, cobranca("avulso", "2026-10-02")])).toBe(atual);
    expect(pacoteAtivo([encerrado])).toBeNull();
  });

  it("consultas do pacote: falta separada de realizada", () => {
    expect(consultasDoPacote(cobranca("pacote", "2026-09-01", ["realizado", "faltou", "agendado"]))).toEqual({
      total: 3,
      realizadas: 1,
      faltas: 1,
      agendadas: 1,
    });
  });

  it("situação do pagamento", () => {
    expect(situacaoPagamento([{ data_pagamento: "2026-09-01" }])).toBe("pago");
    expect(situacaoPagamento([{ data_pagamento: "2026-09-01" }, { data_pagamento: null }])).toBe("parcial");
    expect(situacaoPagamento([{ data_pagamento: null }])).toBe("pendente");
  });

  it("vencido e próxima cobrança", () => {
    const hoje = "2026-10-05";
    expect(estaVencido({ data_pagamento: null, data_vencimento: "2026-10-04" }, hoje)).toBe(true);
    expect(estaVencido({ data_pagamento: null, data_vencimento: "2026-10-05" }, hoje)).toBe(false);
    expect(estaVencido({ data_pagamento: "2026-10-01", data_vencimento: "2026-09-01" }, hoje)).toBe(false);
    const pagamentos = [
      { id: "pago", data_pagamento: "2026-09-01", data_vencimento: "2026-08-01" },
      { id: "nov", data_pagamento: null, data_vencimento: "2026-11-10" },
      { id: "out", data_pagamento: null, data_vencimento: "2026-10-10" },
    ];
    expect(proximaCobranca(pagamentos)?.id).toBe("out");
    expect(proximaCobranca([pagamentos[0]])).toBeNull();
  });

  it("rótulo dos tipos", () => {
    expect(rotuloTipos([{ tipo: "avulso" }, { tipo: "pacote" }])).toBe("1 avulsa • 1 pacote");
    expect(rotuloTipos([{ tipo: "avulso" }, { tipo: "avulso" }])).toBe("2 avulsas");
    expect(rotuloTipos([])).toBe("");
  });
});
