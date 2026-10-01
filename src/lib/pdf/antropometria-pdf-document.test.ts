// @vitest-environment node
import { createElement, type ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";

import { AntropometriaPdfDocument } from "./antropometria-pdf-document";
import { calcularResultados } from "@/lib/anthropometry-results";
import { calcularResultadosCrianca, gorduraInfantil } from "@/lib/growth/growth";
import { CAMPOS_NUMERICOS } from "@/lib/validations/assessment";
import type { AnthropometricAssessment } from "@/lib/types/database.types";

const profissional = {
  nome: "Dra. Teste",
  crn: "12345",
  crnUf: "SP",
  especialidade: null,
  telefone: null,
  endereco: null,
  corMarca: "#2563eb",
  logoUrl: null,
  assinaturaUrl: null,
};

/** Avaliação só com os campos antigos (antes da Fase 15) — tudo o que é novo vazio. */
function avaliacaoAntiga(): AnthropometricAssessment {
  return {
    ...Object.fromEntries(CAMPOS_NUMERICOS.map((c) => [c, null])),
    bio_idade_metabolica: null,
    densidade_corporal: null,
    id: "a-1",
    patient_id: "p-1",
    user_id: "u-1",
    data_avaliacao: "2025-03-07",
    peso_kg: 88.7,
    altura_cm: 155,
    imc: 36.92,
    circunferencia_cintura_cm: 100,
    circunferencia_quadril_cm: 110,
    circunferencia_braco_cm: 32,
    circunferencia_coxa_cm: null,
    circunferencia_pescoco_cm: null,
    percentual_gordura: 38,
    observacoes: "Registro antigo",
    created_at: "2025-03-07T00:00:00Z",
    deleted_at: null,
    updated_at: "2025-03-07T00:00:00Z",
    peso_estimado: false,
    altura_estimada: false,
    lado_referencia: "direito",
    protocolo_dobras: null,
    formula_densidade: "brozek",
    sexo_referencia: null,
    tipo: "adulto",
  } as AnthropometricAssessment;
}

async function render(
  assessment: AnthropometricAssessment,
  idade: number,
  crianca?: Parameters<typeof AntropometriaPdfDocument>[0]["data"]["crianca"]
) {
  const element = createElement(AntropometriaPdfDocument, {
    data: {
      profissional,
      pacienteNome: "Paciente Teste",
      geradoEm: "2026-09-30T12:00:00Z",
      assessment,
      crianca,
      resultados: calcularResultados(assessment, { sexo: "feminino", idade }),
    },
  }) as unknown as ReactElement<DocumentProps>;
  return renderToBuffer(element);
}

describe("AntropometriaPdfDocument — smoke test de renderização real", () => {
  it("avaliação antiga (sem os campos da Fase 15) gera PDF válido", async () => {
    const buffer = await render(avaliacaoAntiga(), 63);
    expect(buffer.subarray(0, 5).toString("utf-8")).toBe("%PDF-");
  });

  it("avaliação completa, com protocolo, diâmetros e bioimpedância, gera PDF válido", async () => {
    const buffer = await render(
      {
        ...avaliacaoAntiga(),
        protocolo_dobras: "pollock_3",
        dobra_triceps_mm: 20,
        dobra_suprailiaca_mm: 15,
        dobra_coxa_mm: 25,
        circunferencia_braco_relaxado_dir_cm: 30,
        circunferencia_panturrilha_esq_cm: 33,
        diametro_punho_cm: 5,
        diametro_femur_cm: 9,
        bio_percentual_gordura: 35,
        bio_idade_metabolica: 50,
      },
      40
    );
    expect(buffer.length).toBeGreaterThan(500);
    expect(buffer.subarray(0, 5).toString("utf-8")).toBe("%PDF-");
  });
});

describe("AntropometriaPdfDocument — criança", () => {
  it("avaliação infantil com curvas e % de gordura gera PDF válido", async () => {
    const a = { ...avaliacaoAntiga(), tipo: "crianca" as const, peso_kg: 40, altura_cm: 150, dobra_triceps_mm: 12, dobra_panturrilha_mm: 14 };
    const buffer = await render(a, 12, {
      resultados: calcularResultadosCrianca({ sexo: "feminino", meses: 149, pesoKg: 40, alturaCm: 150 }),
      gordura: gorduraInfantil({ sexo: "feminino", idadeAnos: 12, tricepsMm: 12, subescapularMm: null, panturrilhaMm: 14 }),
    });
    expect(buffer.subarray(0, 5).toString("utf-8")).toBe("%PDF-");
  });
});
