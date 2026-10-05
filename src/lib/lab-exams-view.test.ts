import { describe, expect, it } from "vitest";

import { diasEntre, ordenarExames, resumoExames, rotuloHaDias, tipoDoExame } from "@/lib/lab-exams-view";

const exame = (data_coleta: string, arquivo_path: string | null, fora: boolean[] = [], created_at = `${data_coleta}T10:00:00Z`) => ({
  data_coleta,
  created_at,
  arquivo_path,
  lab_markers: fora.map((fora_da_faixa) => ({ fora_da_faixa })),
});

describe("aba Exames", () => {
  it("tipo: arquivo pela extensão, sem arquivo = marcadores", () => {
    expect(tipoDoExame({ arquivo_path: "u/exames/x.PDF" })).toBe("pdf");
    expect(tipoDoExame({ arquivo_path: "u/exames/x.jpg" })).toBe("imagem");
    expect(tipoDoExame({ arquivo_path: null })).toBe("marcadores");
  });

  it("resumo dos cartões", () => {
    const exames = [
      exame("2026-09-23", "u/exames/a.pdf"),
      exame("2026-08-15", null, [false, true, true]),
      exame("2026-04-10", null, [false]),
    ];
    expect(resumoExames(exames)).toEqual({
      total: 3,
      comArquivo: 1,
      comMarcadores: 2,
      maisRecente: "2026-09-23",
      marcadores: 4,
      foraDaFaixa: 2,
    });
    expect(resumoExames([]).maisRecente).toBeNull();
  });

  it("há quantos dias", () => {
    expect(diasEntre("2026-09-23", "2026-10-04")).toBe(11);
    expect(rotuloHaDias(11)).toBe("há 11 dias");
    expect(rotuloHaDias(1)).toBe("ontem");
    expect(rotuloHaDias(0)).toBe("hoje");
  });

  it("ordem nos dois sentidos", () => {
    const exames = [exame("2026-08-15", null), exame("2026-09-23", null), exame("2026-04-10", null)];
    expect(ordenarExames(exames, "recentes").map((e) => e.data_coleta)).toEqual(["2026-09-23", "2026-08-15", "2026-04-10"]);
    expect(ordenarExames(exames, "antigas").map((e) => e.data_coleta)).toEqual(["2026-04-10", "2026-08-15", "2026-09-23"]);
  });
});
