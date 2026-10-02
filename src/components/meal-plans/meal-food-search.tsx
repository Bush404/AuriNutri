"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Plus, Search, Star, X } from "lucide-react";
import { toast } from "sonner";

import {
  alternarFavoritoAlimento,
  buscarAlimentosRefeicao,
  type FiltroBusca,
  type ResultadoBusca,
} from "@/lib/actions/meal-food-search";
import { addMealItem, addMealItemRecipe } from "@/lib/actions/meal-items";
import { formatarMedida } from "@/lib/household-measures";
import { cn } from "@/lib/utils";

import { FoodFormDialog } from "@/components/foods/food-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const FILTROS: { valor: FiltroBusca; rotulo: string; icone?: boolean }[] = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "favoritos", rotulo: "Favoritos", icone: true },
  { valor: "meus", rotulo: "Seus alimentos" },
  { valor: "receitas", rotulo: "Receitas" },
  { valor: "taco", rotulo: "TACO" },
  { valor: "usda", rotulo: "USDA" },
];

const fmt = (v: number, casas = 1) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

/**
 * Buscador de alimentos da refeição (Fase 17, Bloco C), no formato do WebDiet:
 * filtros por fonte, resultados com origem, porção e macros, estrela de
 * favorito. Clicar num resultado já o coloca na refeição (alimento em 1
 * medida caseira usual, ou na porção de referência se não tiver medida;
 * receita em 1 porção) — a quantidade e a unidade se ajustam na linha.
 */
export function MealFoodSearch({ planId, mealId, nextOrdem }: { planId: string; mealId: string; nextOrdem: number }) {
  const [termo, setTermo] = useState("");
  const [filtro, setFiltro] = useState<FiltroBusca>("todos");
  const [resultados, setResultados] = useState<ResultadoBusca[] | null>(null);
  const [buscando, startBusca] = useTransition();
  const [adicionando, startAdicionar] = useTransition();
  const [favs, setFavs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const t = setTimeout(() => {
      startBusca(async () => setResultados(await buscarAlimentosRefeicao(termo, filtro)));
    }, 250);
    return () => clearTimeout(t);
  }, [termo, filtro]);

  function adicionar(r: ResultadoBusca) {
    startAdicionar(async () => {
      const res =
        r.tipo === "alimento"
          ? await addMealItem(
              planId,
              mealId,
              r.medida
                ? { food_id: r.id, quantidade_g: r.medida.gramas, medida_id: r.medida.id, medida_quantidade: 1 }
                : { food_id: r.id, quantidade_g: r.porcaoG },
              nextOrdem,
            )
          : await addMealItemRecipe(planId, mealId, { recipe_id: r.id, quantidade_porcoes: 1 }, nextOrdem);
      if (!res.success) {
        toast.error("Não foi possível adicionar", { description: res.message });
        return;
      }
      toast.success(`${r.nome} adicionado. Ajuste a quantidade abaixo.`);
    });
  }

  function favoritar(r: Extract<ResultadoBusca, { tipo: "alimento" }>) {
    const novo = !(favs[r.id] ?? r.favorito);
    setFavs((f) => ({ ...f, [r.id]: novo }));
    void alternarFavoritoAlimento(r.id, novo).then((res) => {
      if (!res.success) {
        setFavs((f) => ({ ...f, [r.id]: !novo }));
        toast.error("Não foi possível favoritar", { description: res.message });
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={`busca-${mealId}`} className="text-sm font-medium text-foreground">
          Buscar alimentos
        </label>
        <FoodFormDialog
          trigger={
            <Button type="button" variant="secondary" size="sm" className="h-7 text-xs">
              <Plus className="h-3.5 w-3.5" />
              Cadastrar alimento
            </Button>
          }
        />
      </div>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id={`busca-${mealId}`}
          placeholder="Busque pelo nome do alimento ou da receita"
          className="pl-9 pr-9"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
        />
        {termo && (
          <button
            type="button"
            aria-label="Limpar busca"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            onClick={() => setTermo("")}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Filtrar por fonte">
        {FILTROS.map((f) => (
          <Button
            key={f.valor}
            type="button"
            size="sm"
            role="radio"
            aria-checked={filtro === f.valor}
            variant={filtro === f.valor ? "default" : "outline"}
            className="h-7 text-xs"
            onClick={() => setFiltro(f.valor)}
          >
            {f.icone && <Star className="h-3 w-3" />}
            {f.rotulo}
          </Button>
        ))}
      </div>

      <div className="max-h-64 overflow-y-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
            <tr className="text-left">
              <th className="w-8 py-1.5 pl-2" aria-label="Favorito" />
              <th className="py-1.5 pr-2 font-medium">Alimento</th>
              <th className="hidden py-1.5 pr-2 font-medium sm:table-cell">Origem</th>
              <th className="py-1.5 pr-2 text-right font-medium">Qtd.</th>
              <th className="hidden py-1.5 pr-2 text-right font-medium md:table-cell">PTN</th>
              <th className="hidden py-1.5 pr-2 text-right font-medium md:table-cell">LIP</th>
              <th className="hidden py-1.5 pr-2 text-right font-medium md:table-cell">CHO</th>
              <th className="py-1.5 pr-2 text-right font-medium">kcal</th>
            </tr>
          </thead>
          <tbody>
            {resultados === null || (buscando && resultados.length === 0) ? (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" aria-label="Buscando" />
                </td>
              </tr>
            ) : resultados.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-muted-foreground">
                  {filtro === "favoritos" && !termo
                    ? "Nenhum favorito ainda. Toque na estrela de um alimento para favoritar."
                    : "Nada encontrado."}
                </td>
              </tr>
            ) : (
              resultados.map((r) => {
                const fav = r.tipo === "alimento" && (favs[r.id] ?? r.favorito);
                // Valores mostrados na quantidade que entra: a medida usual, ou a porção de referência.
                const fator = r.tipo === "alimento" && r.medida ? r.medida.gramas / (r.porcaoG || 100) : 1;
                return (
                  <tr key={`${r.tipo}-${r.id}`} className="border-t border-border/60 hover:bg-muted/50">
                    <td className="py-1 pl-2">
                      {r.tipo === "alimento" && (
                        <button
                          type="button"
                          aria-pressed={fav}
                          aria-label={fav ? `Desfavoritar ${r.nome}` : `Favoritar ${r.nome}`}
                          className="rounded p-1 text-muted-foreground hover:text-foreground"
                          onClick={() => favoritar(r)}
                        >
                          <Star className={cn("h-4 w-4", fav && "fill-amber-400 text-amber-500")} />
                        </button>
                      )}
                    </td>
                    <td className="py-1 pr-2">
                      <button
                        type="button"
                        className="text-left underline-offset-4 hover:underline focus-visible:underline disabled:opacity-50"
                        disabled={adicionando}
                        onClick={() => adicionar(r)}
                        title="Adicionar à refeição"
                      >
                        {r.nome}
                      </button>
                    </td>
                    <td className="hidden py-1 pr-2 text-muted-foreground sm:table-cell">{r.origem}</td>
                    {r.tipo === "alimento" ? (
                      <>
                        <td className="py-1 pr-2 text-right tabular-nums">
                          {r.medida ? formatarMedida(1, r.medida.nome, r.medida.gramas) : `${fmt(r.porcaoG, 0)} g`}
                        </td>
                        <td className="hidden py-1 pr-2 text-right tabular-nums md:table-cell">
                          {fmt(r.proteinas * fator)}
                        </td>
                        <td className="hidden py-1 pr-2 text-right tabular-nums md:table-cell">
                          {fmt(r.lipidios * fator)}
                        </td>
                        <td className="hidden py-1 pr-2 text-right tabular-nums md:table-cell">
                          {fmt(r.carboidratos * fator)}
                        </td>
                        <td className="py-1 pr-2 text-right tabular-nums">{fmt(Math.round(r.kcal * fator), 0)}</td>
                      </>
                    ) : (
                      <>
                        <td className="py-1 pr-2 text-right">1 porção</td>
                        <td colSpan={4} className="hidden md:table-cell" />
                        <td className="md:hidden" />
                      </>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Clique no nome para adicionar à refeição.</p>
    </div>
  );
}
