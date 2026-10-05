import { describe, expect, it } from "vitest";
import {
  indicadoresAtuais,
  itensDisponiveis,
  linhasAntropometria,
  montarComparacao,
  montarHistorico,
  parseItens,
  selecaoPadrao,
  type ChaveItem,
} from "./evolution";
import { CAMPOS_NUMERICOS } from "@/lib/validations/assessment";
import type { AnthropometricAssessment, AnthropometricAttachment } from "@/lib/types/database.types";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function avaliacao(n: number, data: string, extra: Partial<AnthropometricAssessment> = {}): AnthropometricAssessment {
  return {
    ...Object.fromEntries(CAMPOS_NUMERICOS.map((c) => [c, null])),
    id: uuid(n),
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

function anexo(n: number, data: string, extra: Partial<AnthropometricAttachment> = {}): AnthropometricAttachment {
  return {
    id: uuid(n),
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
    // avaliação antiga: % de gordura digitado à mão
    avaliacao(1, "2025-01-10", { peso_kg: 82, percentual_gordura: 35, circunferencia_braco_cm: 31 }),
    avaliacao(2, "2025-03-10", { peso_kg: 80, circunferencia_cintura_cm: 85, circunferencia_quadril_cm: 100 }),
    avaliacao(3, "2025-06-10", { peso_kg: 78, circunferencia_cintura_cm: 82, circunferencia_quadril_cm: 100 }),
  ],
  attachments: [anexo(9, "2025-04-20", { titulo: "InBody", peso_kg: 79, percentual_gordura: 33, massa_livre_gordura_kg: 53 })],
};

const a = (n: number) => `a:${uuid(n)}` as ChaveItem;
const x = (n: number) => `x:${uuid(n)}` as ChaveItem;

describe("itens e seleção", () => {
  it("lista avaliações e relatórios, mais recente primeiro", () => {
    expect(itensDisponiveis(entrada).map((i) => [i.data, i.rotulo])).toEqual([
      ["2025-06-10", "Avaliação de adulto"],
      ["2025-04-20", "InBody"],
      ["2025-03-10", "Avaliação de adulto"],
      ["2025-01-10", "Avaliação de adulto"],
    ]);
  });

  it("seleção padrão: o item clicado e os anteriores, até 5", () => {
    const itens = itensDisponiveis(entrada);
    expect(selecaoPadrao(itens, a(2))).toEqual([a(2), a(1)]);
    expect(selecaoPadrao(itens, a(3))).toHaveLength(4);
  });

  it("parseItens: só chaves válidas, sem repetir, no máximo 5", () => {
    expect(parseItens(`${a(1)},lixo,${a(1)},${x(9)}`)).toEqual([a(1), x(9)]);
    expect(parseItens([1, 2, 3, 4, 5, 6].map(a).join(","))).toHaveLength(5);
    expect(parseItens(null)).toEqual([]);
  });
});

describe("montarComparacao", () => {
  it("colunas em ordem de data, mesmo pedidas fora de ordem", () => {
    const c = montarComparacao(entrada, [a(3), a(1), x(9)]);
    expect(c.colunas.map((col) => col.data)).toEqual(["2025-01-10", "2025-04-20", "2025-06-10"]);
  });

  it("peso com variação em relação à coluna anterior", () => {
    const c = montarComparacao(entrada, [a(1), a(2), a(3)]);
    const peso = c.analises.find((l) => l.label === "Peso (kg)")!;
    expect(peso.valores).toEqual(["82,0", "80,0", "78,0"]);
    expect(peso.deltas).toEqual([null, -2, -2]);
  });

  it("linhas sem nenhum valor somem; linhas de texto não têm variação", () => {
    const c = montarComparacao(entrada, [a(2), a(3)]);
    expect(c.analises.find((l) => l.label === "Densidade corporal (g/ml)")).toBeUndefined();
    const risco = c.analises.find((l) => l.label === "Risco metabólico por RCQ")!;
    expect(risco.deltas).toEqual([null, null]);
    expect(risco.valores[0]).toBe("Risco aumentado");
  });

  it("avaliação antiga entra (braço sem lado, % digitado) e o relatório anexado também", () => {
    const c = montarComparacao(entrada, [a(1), x(9)]);
    expect(c.medidas.find((l) => l.label === "Braço (formato antigo) (cm)")!.valores).toEqual(["31,0", "—"]);
    expect(c.analises.find((l) => l.label === "% de gordura")!.valores).toEqual(["35,0", "33,0"]);
  });

  it("composição corporal: massa de gordura + livre = peso", () => {
    const c = montarComparacao(entrada, [a(1), x(9)]);
    expect(c.composicao[0]).toMatchObject({ pesoKg: 82 });
    expect(c.composicao[0].massaGordaKg! + c.composicao[0].massaLivreGorduraKg!).toBeCloseTo(82, 6);
    expect(c.composicao[1]).toMatchObject({ pesoKg: 79, massaLivreGorduraKg: 53 });
  });

  it("chave de outro paciente/inexistente é ignorada", () => {
    expect(montarComparacao(entrada, [a(77)]).colunas).toHaveLength(0);
  });
});

describe("montarHistorico (Relatório)", () => {
  it("só até a data, mais antiga primeiro", () => {
    const h = montarHistorico(entrada, "2025-04-20");
    expect(h.datas).toEqual(["2025-01-10", "2025-03-10", "2025-04-20"]);
    expect(h.peso.map((p) => p.valor)).toEqual([82, 80, 79]);
    expect(h.percentual_gordura.map((p) => p.valor)).toEqual([35, 33]);
  });
});

describe("Antropometria Geral (aba)", () => {
  it("uma linha por item, mais recente primeiro, com os números da evolução", () => {
    const linhas = linhasAntropometria(entrada);
    expect(linhas.map((l) => l.data)).toEqual(["2025-06-10", "2025-04-20", "2025-03-10", "2025-01-10"]);
    // Avaliação antiga com % digitado: MLG = peso − gordura (82 − 28,7).
    expect(linhas[3]).toMatchObject({ origem: "avaliacao", pesoKg: 82, percentualGordura: 35 });
    expect(linhas[3].massaLivreKg).toBeCloseTo(53.3, 6);
    expect(linhas[3].imc).toBeCloseTo(82 / 1.7 ** 2, 6);
    // Relatório externo: sem altura nem IMC.
    expect(linhas[1]).toMatchObject({ origem: "anexo", pesoKg: 79, percentualGordura: 33, massaLivreKg: 53, imc: null, alturaCm: null });
  });

  it("indicadores atuais usam as classificações da tela da avaliação", () => {
    const ind = indicadoresAtuais(entrada, entrada.assessments[2]);
    expect(ind.rcq).toBeCloseTo(0.82, 6);
    expect(ind.classificacaoRcq?.label).toBe("Sem risco aumentado");
    expect(ind.classificacaoImc?.label).toBe("Sobrepeso");
    expect(ind.cinturaCm).toBe(82);
    // Sem protocolo de dobras não há % de gordura nem classificação inventada.
    expect(ind.percentualGordura).toBeNull();
    expect(ind.classificacaoGordura).toBeNull();
  });
});
