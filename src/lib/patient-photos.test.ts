import { describe, expect, it } from "vitest";

import { ordenarFotos, sugestaoComparacao, tiposComFoto, tiposDosFiltros } from "@/lib/patient-photos";
import type { PatientPhoto, TipoFotoEvolucao } from "@/lib/types/database.types";

function foto(id: string, data: string, tipo: TipoFotoEvolucao, created_at = `${data}T10:00:00Z`): PatientPhoto {
  return { id, patient_id: "p", user_id: "u", data_registro: data, tipo, arquivo_path: `u/p/${id}.jpg`, created_at, deleted_at: null };
}

const fotos = [
  foto("f1", "2026-09-02", "frente"),
  foto("c1", "2026-09-02", "costas", "2026-09-02T11:00:00Z"), // mesma data, enviada depois
  foto("f3", "2026-09-24", "frente"),
  foto("f2", "2026-09-23", "frente"),
  foto("d1", "2026-09-15", "direita"),
];

describe("evolução fotográfica", () => {
  it("ordena por data nos dois sentidos", () => {
    expect(ordenarFotos(fotos, "recentes").map((f) => f.id)).toEqual(["f3", "f2", "d1", "c1", "f1"]);
    expect(ordenarFotos(fotos, "antigas").map((f) => f.id)).toEqual(["f1", "c1", "d1", "f2", "f3"]);
  });

  it("filtro 'Perfil' só aparece com foto antiga assim", () => {
    expect(tiposDosFiltros(fotos)).toEqual(["frente", "direita", "esquerda", "costas"]);
    expect(tiposDosFiltros([...fotos, foto("p1", "2026-01-01", "perfil")])).toContain("perfil");
  });

  it("comparação: só ângulos com foto; sugere a penúltima (A) e a mais recente (B)", () => {
    expect(tiposComFoto(fotos)).toEqual(["frente", "direita", "costas"]);
    expect(sugestaoComparacao(fotos, "frente")).toEqual({ a: "f2", b: "f3" });
    // Uma foto só: nada a comparar.
    expect(sugestaoComparacao(fotos, "costas")).toBeNull();
    expect(sugestaoComparacao(fotos, "esquerda")).toBeNull();
  });
});
