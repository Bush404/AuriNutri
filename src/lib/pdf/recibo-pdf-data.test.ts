import { describe, expect, it } from "vitest";
import { buildReciboPdfViewModel } from "./recibo-pdf-data";
import type { ProfissionalPdfHeaderData } from "./profissional-header";

function makeProfissional(overrides: Partial<ProfissionalPdfHeaderData> = {}): ProfissionalPdfHeaderData {
  return {
    nome: "Dra. Ana Souza",
    crn: "12345",
    crnUf: "SP",
    especialidade: "Nutrição Clínica",
    telefone: "(11) 99999-0000",
    endereco: "Rua das Flores, 123",
    corMarca: null,
    logoUrl: null,
    assinaturaUrl: null,
    ...overrides,
  };
}

describe("buildReciboPdfViewModel", () => {
  it("formata valor em algarismos (pt-BR) e por extenso a partir do mesmo número", () => {
    const viewModel = buildReciboPdfViewModel({
      profissional: makeProfissional(),
      pacienteNome: "João da Silva",
      descricao: "Consulta nutricional",
      valor: 150,
      dataPagamento: "2026-09-20",
    });

    expect(viewModel.valorFormatado).toBe("R$ 150,00");
    expect(viewModel.valorPorExtensoFormatado).toBe("cento e cinquenta reais");
  });

  it("formata a data de pagamento em pt-BR (dd/mm/aaaa)", () => {
    const viewModel = buildReciboPdfViewModel({
      profissional: makeProfissional(),
      pacienteNome: "João da Silva",
      descricao: "Consulta nutricional",
      valor: 150,
      dataPagamento: "2026-09-20",
    });

    expect(viewModel.dataPagamentoFormatada).toBe("20/09/2026");
  });

  it("repassa nome do paciente e descrição sem alterar", () => {
    const viewModel = buildReciboPdfViewModel({
      profissional: makeProfissional(),
      pacienteNome: "Maria Oliveira",
      descricao: "Pacote de acompanhamento — parcela 2/6",
      valor: 89.9,
      dataPagamento: "2026-01-05",
    });

    expect(viewModel.pacienteNome).toBe("Maria Oliveira");
    expect(viewModel.descricao).toBe("Pacote de acompanhamento — parcela 2/6");
    expect(viewModel.valorFormatado).toBe("R$ 89,90");
    expect(viewModel.valorPorExtensoFormatado).toBe("oitenta e nove reais e noventa centavos");
  });
});
