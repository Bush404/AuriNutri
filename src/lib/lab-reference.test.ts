import { describe, expect, it } from "vitest";
import type { LabReferenceRange } from "@/lib/types/database.types";
import { filterByAge, pickBestReferenceRange, resolveReferenceRange } from "./lab-reference";

function makeRange(overrides: Partial<LabReferenceRange> = {}): LabReferenceRange {
  return {
    id: "range-1",
    user_id: null,
    nome_marcador: "HDL colesterol",
    unidade: "mg/dL",
    sexo: "ambos",
    idade_min_anos: 18,
    idade_max_anos: null,
    valor_min: 40,
    valor_max: null,
    fonte: "SBC 2017",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const USER_ID = "user-1";

describe("resolveReferenceRange / pickBestReferenceRange — seleção por sexo e idade (Fase 7, Bloco B)", () => {
  it("escolhe a faixa do sexo certo quando o marcador tem faixas separadas por sexo", () => {
    const candidatosM = [makeRange({ id: "hdl-m", sexo: "M", valor_min: 40, valor_max: null })];
    const candidatosF = [makeRange({ id: "hdl-f", sexo: "F", valor_min: 50, valor_max: null })];

    const paraHomem = pickBestReferenceRange(candidatosM, USER_ID, "M");
    const paraMulher = pickBestReferenceRange(candidatosF, USER_ID, "F");

    expect(paraHomem?.valor_min).toBe(40);
    expect(paraMulher?.valor_min).toBe(50);
  });

  it("filterByAge restringe à faixa etária do paciente quando a idade cai dentro dela", () => {
    const pediatrico = makeRange({ id: "ped", idade_min_anos: 0, idade_max_anos: 17, valor_min: 60 });
    const adulto = makeRange({ id: "adulto", idade_min_anos: 18, idade_max_anos: null, valor_min: 70 });

    const filtradoAdulto = filterByAge([pediatrico, adulto], 25);
    expect(filtradoAdulto).toEqual([adulto]);

    const filtradoPediatrico = filterByAge([pediatrico, adulto], 10);
    expect(filtradoPediatrico).toEqual([pediatrico]);
  });

  it("resolveReferenceRange usa a faixa certa combinando sexo e idade juntos", () => {
    const candidatos = [
      makeRange({ id: "ped-m", sexo: "M", idade_min_anos: 0, idade_max_anos: 17, valor_min: 999 }),
      makeRange({ id: "adulto-m", sexo: "M", idade_min_anos: 18, idade_max_anos: null, valor_min: 40 }),
      makeRange({ id: "adulto-f", sexo: "F", idade_min_anos: 18, idade_max_anos: null, valor_min: 50 }),
    ];

    const resultado = resolveReferenceRange(candidatos, USER_ID, "M", 30);
    expect(resultado?.valor_min).toBe(40);
  });

  it("quando a idade do paciente não bate com nenhuma faixa cadastrada, cai para o conjunto completo em vez de não sugerir nada", () => {
    const soPediatrico = [makeRange({ id: "ped", idade_min_anos: 0, idade_max_anos: 17, valor_min: 60 })];
    // Paciente adulto (30 anos), mas só existe faixa pediátrica cadastrada — melhor sugerir essa do que nada.
    const resultado = resolveReferenceRange(soPediatrico, USER_ID, "M", 30);
    expect(resultado?.valor_min).toBe(60);
  });

  it("quando a idade do paciente é desconhecida (null), não filtra por idade", () => {
    const candidatos = [makeRange({ id: "adulto", idade_min_anos: 18, idade_max_anos: null, valor_min: 40 })];
    const resultado = resolveReferenceRange(candidatos, USER_ID, "M", null);
    expect(resultado?.valor_min).toBe(40);
  });

  it("faixa PESSOAL do profissional prevalece sobre a faixa global do catálogo", () => {
    const global = makeRange({ id: "global", user_id: null, sexo: "M", valor_min: 40 });
    const pessoal = makeRange({ id: "pessoal", user_id: USER_ID, sexo: "M", valor_min: 45, fonte: "Laboratório X" });

    const resultado = pickBestReferenceRange([global, pessoal], USER_ID, "M");

    expect(resultado?.valor_min).toBe(45);
    expect(resultado?.origem).toBe("personalizada");
  });

  it("faixa pessoal de OUTRO profissional não é usada como se fosse a minha", () => {
    const global = makeRange({ id: "global", user_id: null, sexo: "M", valor_min: 40 });
    const pessoalDeOutroProfissional = makeRange({ id: "outro", user_id: "outro-user", sexo: "M", valor_min: 999 });

    const resultado = pickBestReferenceRange([global, pessoalDeOutroProfissional], USER_ID, "M");

    expect(resultado?.valor_min).toBe(40);
    expect(resultado?.origem).toBe("global");
  });

  it("entre faixas da mesma origem, prefere a específica por sexo em vez da genérica 'ambos'", () => {
    const generica = makeRange({ id: "ambos", sexo: "ambos", valor_min: 70, valor_max: 99 });
    const especifica = makeRange({ id: "especifica-m", sexo: "M", valor_min: 65, valor_max: 105 });

    const resultado = pickBestReferenceRange([generica, especifica], USER_ID, "M");

    expect(resultado?.valor_min).toBe(65);
  });

  it("retorna null quando não há nenhum candidato", () => {
    expect(pickBestReferenceRange([], USER_ID, "M")).toBeNull();
    expect(resolveReferenceRange([], USER_ID, "M", 30)).toBeNull();
  });
});
