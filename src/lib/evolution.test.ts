import { describe, expect, it } from "vitest";
import { datasDisponiveis, INDICADORES_PADRAO, montarSeries, parseIndicadores } from "./evolution";
import { CAMPOS_NUMERICOS } from "@/lib/validations/assessment";
import type { AnthropometricAssessment, AnthropometricAttachment } from "@/lib/types/database.types";

function avaliacao(data: string, extra: Partial<AnthropometricAssessment> = {}): AnthropometricAssessment {
  return {
    ...Object.fromEntries(CAMPOS_NUMERICOS.map((c) => [c, null])),
    id: data,
    patient_id: "p",
    user_id: "u",
    data_avaliacao: data,
    peso_kg: 80,
    altura_cm: 170,
    imc: 27.68,
    observacoes: null,
    created_at: "",
    updated_at: "",
    deleted_at: null,
    peso_estimado: false,
    altura_estimada: false,
    lado_referencia: "direito",
    protocolo_dobras: null,
    formula_densidade: "brozek",
    sexo_referencia: null,
    densidade_corporal: null,
    bio_idade_metabolica: null,
    tipo: "adulto",
    ...extra,
  } as AnthropometricAssessment;
}

function anexo(data: string, extra: Partial<AnthropometricAttachment> = {}): AnthropometricAttachment {
  return {
    id: `x${data}`,
    patient_id: "p",
    user_id: "u",
    data_avaliacao: data,
    titulo: null,
    observacoes: null,
    arquivo_path: "u/antropometria-anexos/x.pdf",
    arquivo_nome: null,
    peso_kg: null,
    percentual_gordura: null,
    massa_livre_gordura_kg: null,
    massa_muscular_kg: null,
    created_at: "",
    updated_at: "",
    deleted_at: null,
    ...extra,
  };
}

const entrada = {
  sexo: "feminino" as const,
  dataNascimento: "1990-01-01",
  assessments: [
    // avaliação antiga: braço sem lado e % digitado à mão
    avaliacao("2025-01-10", { peso_kg: 82, circunferencia_braco_cm: 31, percentual_gordura: 35 }),
    avaliacao("2025-03-10", { peso_kg: 80, circunferencia_cintura_cm: 85, circunferencia_quadril_cm: 100 }),
    avaliacao("2025-06-10", { peso_kg: 78, circunferencia_braco_relaxado_esq_cm: 29 }),
  ],
  attachments: [anexo("2025-04-20", { peso_kg: 79, percentual_gordura: 33, massa_livre_gordura_kg: 53 })],
};

describe("montarSeries", () => {
  it("junta avaliações e relatórios anexados em ordem de data", () => {
    const s = montarSeries(entrada, null);
    expect(s.peso.map((p) => [p.data, p.valor, p.origem])).toEqual([
      ["2025-01-10", 82, "avaliacao"],
      ["2025-03-10", 80, "avaliacao"],
      ["2025-04-20", 79, "anexo"],
      ["2025-06-10", 78, "avaliacao"],
    ]);
  });

  it("corta na data escolhida (inclusive)", () => {
    const s = montarSeries(entrada, "2025-03-10");
    expect(s.peso.map((p) => p.data)).toEqual(["2025-01-10", "2025-03-10"]);
  });

  it("avaliação antiga entra: braço sem lado e % de gordura digitado", () => {
    const s = montarSeries(entrada, null);
    expect(s.braco.map((p) => p.valor)).toEqual([31, 29]);
    expect(s.percentual_gordura.map((p) => p.valor)).toEqual([35, 33]);
  });

  it("massa livre de gordura: calculada do % gravado ou vinda do anexo", () => {
    const s = montarSeries(entrada, null);
    expect(s.massa_livre_gordura[0].valor).toBeCloseTo(82 * 0.65, 6);
    expect(s.massa_livre_gordura[1]).toMatchObject({ valor: 53, origem: "anexo" });
  });

  it("RCQ só onde há cintura e quadril", () => {
    const s = montarSeries(entrada, null);
    expect(s.rcq).toHaveLength(1);
    expect(s.rcq[0].valor).toBeCloseTo(0.85, 6);
  });
});

describe("datas e parâmetros", () => {
  it("datas sem repetir, mais recente primeiro", () => {
    expect(datasDisponiveis(entrada)).toEqual(["2025-06-10", "2025-04-20", "2025-03-10", "2025-01-10"]);
  });

  it("parseIndicadores: só válidos, sem repetir, no máximo 5; vazio = padrão", () => {
    expect(parseIndicadores("peso,xyz,imc,peso")).toEqual(["peso", "imc"]);
    expect(parseIndicadores("peso,imc,altura,cintura,quadril,rcq")).toHaveLength(5);
    expect(parseIndicadores(null)).toEqual(INDICADORES_PADRAO);
  });
});
