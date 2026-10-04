import { describe, expect, it } from "vitest";

import type { MealItem, MealItemSubstitution } from "@/lib/types/database.types";
import {
  gramasDaLinha,
  linhasInvalidas,
  macrosDaLinha,
  payloadDoRascunho,
  rascunhoAlterado,
  rascunhoDaRefeicao,
  totaisDoRascunho,
  trocarUnidade,
  usarSubstituto,
} from "./meal-draft";

const base = {
  meal_id: "m1",
  user_id: "u1",
  ordem: 0,
  fonte_descricao_alimento: null,
  created_at: "",
  medida_nome: null,
  medida_gramas: null,
  medida_quantidade: null,
};

// Arroz: 128 kcal / 2,5 P / 28,1 C / 0,2 G por 100 g, em 2 colheres de 25 g.
const arroz = {
  ...base,
  id: "i1",
  food_id: "f-arroz",
  recipe_id: null,
  quantidade_g: 50,
  quantidade_porcoes: null,
  nome_alimento: "Arroz",
  fonte_alimento: "taco",
  porcao_referencia_g: 100,
  calorias_kcal: 128,
  proteinas_g: 2.5,
  carboidratos_g: 28.1,
  gorduras_g: 0.2,
  fibras_g: 1.6,
  fontes_ingredientes_receita: null,
  medida_nome: "colher de sopa",
  medida_gramas: 25,
  medida_quantidade: 2,
  deleted_at: null,
} as unknown as MealItem;

const batata = {
  ...base,
  id: "s1",
  meal_item_id: "i1",
  food_id: "f-batata",
  quantidade_g: 120,
  nome_alimento: "Batata",
  fonte_alimento: "taco",
  porcao_referencia_g: 100,
  calorias_kcal: 52,
  proteinas_g: 1.2,
  carboidratos_g: 11.9,
  gorduras_g: 0,
  fibras_g: 1.3,
} as unknown as MealItemSubstitution;

// Receita: 1 porção = 200 g, 300 kcal por porção.
const bolo = {
  ...arroz,
  id: "i2",
  food_id: null,
  recipe_id: "r-bolo",
  quantidade_g: 300,
  quantidade_porcoes: 1.5,
  nome_alimento: "Bolo",
  fonte_alimento: "receita",
  porcao_referencia_g: 200,
  calorias_kcal: 300,
  medida_nome: null,
  medida_gramas: null,
  medida_quantidade: null,
} as unknown as MealItem;

const refeicao = () =>
  rascunhoDaRefeicao({
    nome: "Almoço",
    horario: "12:00:00",
    observacoes: "",
    items: [
      { ...arroz, meal_item_substitutions: [batata] },
      { ...bolo, meal_item_substitutions: [] },
    ],
  });

describe("rascunho da refeição (Fase 19)", () => {
  it("lê medida caseira, gramas e porções do que está gravado", () => {
    const r = refeicao();
    expect(r.horario).toBe("12:00");
    expect(r.itens[0].quantidade).toEqual({ tipo: "medida", texto: "2", medida_id: null, nome: "colher de sopa", gramas: 25 });
    expect(r.itens[0].substitutos[0].quantidade).toEqual({ tipo: "g", texto: "120" });
    expect(r.itens[1].quantidade).toEqual({ tipo: "porcoes", texto: "1,5" });
  });

  it("calcula gramas e macros da linha como o resto do sistema", () => {
    const [arrozR, boloR] = refeicao().itens;
    expect(gramasDaLinha(arrozR)).toBe(50);
    expect(macrosDaLinha(arrozR).calorias).toBeCloseTo(64);
    expect(gramasDaLinha(boloR)).toBe(300);
    expect(macrosDaLinha(boloR).calorias).toBeCloseTo(450);
    expect(totaisDoRascunho(refeicao()).calorias).toBeCloseTo(514);
  });

  it("aceita vírgula e trata campo vazio como zero (e inválido para salvar)", () => {
    const r = refeicao();
    r.itens[0].quantidade = { ...r.itens[0].quantidade, texto: "1,5" };
    expect(gramasDaLinha(r.itens[0])).toBe(37.5);
    r.itens[1].quantidade = { tipo: "porcoes", texto: "" };
    expect(gramasDaLinha(r.itens[1])).toBe(0);
    expect(linhasInvalidas(r)).toEqual(["Bolo"]);
  });

  it("trocar para gramas mantém o peso; trocar para medida começa em 1", () => {
    const [arrozR] = refeicao().itens;
    expect(trocarUnidade(arrozR, { tipo: "g" }).quantidade).toEqual({ tipo: "g", texto: "50" });
    expect(trocarUnidade(arrozR, { tipo: "medida", medida_id: "m9", nome: "escumadeira", gramas: 45 }).quantidade).toEqual({
      tipo: "medida",
      texto: "1",
      medida_id: "m9",
      nome: "escumadeira",
      gramas: 45,
    });
  });

  it('"usar este" troca conteúdo e quantidade, mantendo as linhas gravadas', () => {
    const r = usarSubstituto(refeicao(), "i1", "s1");
    const item = r.itens[0];
    expect(item.id).toBe("i1");
    expect(item.fonte).toEqual({ de: "sub", id: "s1" });
    expect(item.snapshot.nome_alimento).toBe("Batata");
    expect(item.quantidade).toEqual({ tipo: "g", texto: "120" });
    expect(item.substitutos[0].id).toBe("s1");
    expect(item.substitutos[0].fonte).toEqual({ de: "item", id: "i1" });
    expect(item.substitutos[0].snapshot.nome_alimento).toBe("Arroz");
  });

  it('receita não usa "usar este" (substituto é sempre alimento)', () => {
    const r = refeicao();
    r.itens[1].substitutos = [{ ...r.itens[0].substitutos[0], chave: "x" }];
    expect(usarSubstituto(r, "i2", "x").itens[1].snapshot.nome_alimento).toBe("Bolo");
  });

  it("sabe quando algo mudou (observação vazia do editor não conta)", () => {
    const inicial = refeicao();
    expect(rascunhoAlterado(inicial, { ...refeicao(), observacoes: "<p></p>" })).toBe(false);
    expect(rascunhoAlterado(inicial, { ...refeicao(), nome: "Almoço reforçado" })).toBe(true);
    const semBolo = refeicao();
    semBolo.itens.pop();
    expect(rascunhoAlterado(inicial, semBolo)).toBe(true);
  });

  it("monta o pedido de gravação com fonte e quantidade numérica", () => {
    const p = payloadDoRascunho(refeicao());
    expect(p.itens[0]).toEqual({
      id: "i1",
      fonte: { de: "item", id: "i1" },
      quantidade: { tipo: "medida", valor: 2, medida_id: null },
      substitutos: [{ id: "s1", fonte: { de: "sub", id: "s1" }, quantidade: { tipo: "g", valor: 120 } }],
    });
    expect(p.itens[1].quantidade).toEqual({ tipo: "porcoes", valor: 1.5 });
  });
});
