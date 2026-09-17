import { describe, expect, it } from "vitest";
import {
  compareWeights,
  computePatientPendencias,
  type ComputePendenciasInput,
} from "@/lib/patient-context";

const HOJE = "2026-09-17";

function baseInput(overrides: Partial<ComputePendenciasInput> = {}): ComputePendenciasInput {
  return {
    hojeStr: HOJE,
    temAnamnese: true,
    ultimaAvaliacao: { data: "2026-09-01" }, // 16 dias atrás — dentro do prazo
    planoAtivo: { dataInicio: "2026-08-01" }, // 47 dias atrás — dentro do prazo
    ultimaConsulta: { status: "realizado" },
    telefone: "11999999999",
    ...overrides,
  };
}

describe("computePatientPendencias", () => {
  it("paciente em dia não gera nenhuma pendência", () => {
    expect(computePatientPendencias(baseInput())).toEqual([]);
  });

  it("sem anamnese registrada", () => {
    expect(computePatientPendencias(baseInput({ temAnamnese: false }))).toContain("sem_anamnese");
  });

  it("nunca avaliado (nenhuma avaliação) é diferente de avaliação desatualizada", () => {
    const pendencias = computePatientPendencias(baseInput({ ultimaAvaliacao: null }));
    expect(pendencias).toContain("nunca_avaliado");
    expect(pendencias).not.toContain("avaliacao_desatualizada");
  });

  it("avaliação com exatamente 60 dias NÃO é desatualizada (regra é 'mais de 60')", () => {
    // 2026-07-19 -> 2026-09-17 são exatamente 60 dias.
    const pendencias = computePatientPendencias(baseInput({ ultimaAvaliacao: { data: "2026-07-19" } }));
    expect(pendencias).not.toContain("avaliacao_desatualizada");
  });

  it("avaliação com 61 dias é desatualizada", () => {
    const pendencias = computePatientPendencias(baseInput({ ultimaAvaliacao: { data: "2026-07-18" } }));
    expect(pendencias).toContain("avaliacao_desatualizada");
  });

  it("sem plano ativo (nenhum) é diferente de plano desatualizado", () => {
    const pendencias = computePatientPendencias(baseInput({ planoAtivo: null }));
    expect(pendencias).toContain("sem_plano_ativo");
    expect(pendencias).not.toContain("plano_desatualizado");
  });

  it("plano ativo com mais de 90 dias é desatualizado", () => {
    const pendencias = computePatientPendencias(baseInput({ planoAtivo: { dataInicio: "2026-06-01" } }));
    expect(pendencias).toContain("plano_desatualizado");
  });

  it("plano ativo com exatamente 90 dias NÃO é desatualizado", () => {
    // 2026-06-19 -> 2026-09-17 são exatamente 90 dias.
    const pendencias = computePatientPendencias(baseInput({ planoAtivo: { dataInicio: "2026-06-19" } }));
    expect(pendencias).not.toContain("plano_desatualizado");
  });

  it("faltou na última consulta gera pendência", () => {
    expect(computePatientPendencias(baseInput({ ultimaConsulta: { status: "faltou" } }))).toContain(
      "faltou_ultima_consulta"
    );
  });

  it("última consulta realizada ou sem consulta anterior não gera essa pendência", () => {
    expect(computePatientPendencias(baseInput({ ultimaConsulta: { status: "realizado" } }))).not.toContain(
      "faltou_ultima_consulta"
    );
    expect(computePatientPendencias(baseInput({ ultimaConsulta: null }))).not.toContain(
      "faltou_ultima_consulta"
    );
  });

  it("consulta cancelada não conta como falta (regra é só 'faltou')", () => {
    expect(computePatientPendencias(baseInput({ ultimaConsulta: { status: "cancelado" } }))).not.toContain(
      "faltou_ultima_consulta"
    );
  });

  it("sem telefone cadastrado", () => {
    expect(computePatientPendencias(baseInput({ telefone: null }))).toContain("sem_telefone");
  });

  it("acumula todas as pendências aplicáveis ao mesmo tempo", () => {
    const pendencias = computePatientPendencias(
      baseInput({
        temAnamnese: false,
        ultimaAvaliacao: null,
        planoAtivo: null,
        ultimaConsulta: { status: "faltou" },
        telefone: null,
      })
    );
    expect(pendencias).toEqual([
      "sem_anamnese",
      "nunca_avaliado",
      "sem_plano_ativo",
      "faltou_ultima_consulta",
      "sem_telefone",
    ]);
  });
});

describe("compareWeights", () => {
  it("sem avaliação anterior não dá pra comparar", () => {
    expect(compareWeights(70, null)).toBe("sem_comparacao");
  });

  it("detecta perda de peso", () => {
    expect(compareWeights(68, 70)).toBe("desceu");
  });

  it("detecta ganho de peso", () => {
    expect(compareWeights(72, 70)).toBe("subiu");
  });

  it("diferença menor que 0.1kg é considerada estável", () => {
    expect(compareWeights(70.05, 70)).toBe("estavel");
  });
});
