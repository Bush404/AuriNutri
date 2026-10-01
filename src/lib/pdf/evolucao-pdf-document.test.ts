// @vitest-environment node
import { createElement, type ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";

import { EvolucaoPdfDocument } from "./evolucao-pdf-document";
import { montarComparacao } from "@/lib/evolution";
import { CAMPOS_NUMERICOS } from "@/lib/validations/assessment";
import type { AnthropometricAssessment, AnthropometricAttachment } from "@/lib/types/database.types";

const A1 = "00000000-0000-4000-8000-000000000001";
const A2 = "00000000-0000-4000-8000-000000000002";
const X1 = "00000000-0000-4000-8000-000000000009";
const base = {
  ...Object.fromEntries(CAMPOS_NUMERICOS.map((c) => [c, null])),
  patient_id: "p",
  user_id: "u",
  altura_cm: 180,
  imc: 30,
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
};
const entrada = {
  sexo: "masculino" as const,
  dataNascimento: "1990-01-01",
  assessments: [
    { ...base, id: A1, data_avaliacao: "2026-01-10", peso_kg: 108, percentual_gordura: 30, circunferencia_cintura_cm: 110 },
    { ...base, id: A2, data_avaliacao: "2026-07-28", peso_kg: 104, circunferencia_cintura_cm: 104 },
  ] as AnthropometricAssessment[],
  attachments: [
    { id: X1, patient_id: "p", user_id: "u", data_avaliacao: "2026-04-20", titulo: "InBody", observacoes: null, arquivo_path: "x", arquivo_nome: null, peso_kg: 106, percentual_gordura: 28, massa_livre_gordura_kg: null, massa_muscular_kg: 40, created_at: "", updated_at: "", deleted_at: null },
  ] as AnthropometricAttachment[],
};

describe("EvolucaoPdfDocument — smoke test de renderização real", () => {
  it("gera PDF válido comparando avaliações e um relatório anexado", async () => {
    const element = createElement(EvolucaoPdfDocument, {
      data: {
        profissional: {
          nome: "Dra. Teste",
          crn: "12345",
          crnUf: "SP",
          especialidade: null,
          telefone: null,
          endereco: null,
          corMarca: "#2563eb",
          logoUrl: null,
          assinaturaUrl: null,
        },
        pacienteNome: "Paciente Teste",
        geradoEm: "2026-09-30T12:00:00Z",
        comparacao: montarComparacao(entrada, [
          `a:${A1}`,
          `x:${X1}`,
          `a:${A2}`,
        ]),
      },
    }) as unknown as ReactElement<DocumentProps>;

    const buffer = await renderToBuffer(element);
    expect(buffer.length).toBeGreaterThan(500);
    expect(buffer.subarray(0, 5).toString("utf-8")).toBe("%PDF-");
  });
});
