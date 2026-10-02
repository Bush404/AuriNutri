"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { criarMedidaCaseira, excluirMedidaCaseira } from "@/lib/actions/food-measures";
import type { FoodMeasure } from "@/lib/types/database.types";
import { UNIDADE_ATUAL, UNIDADE_GRAMAS, type useMealItemEditor } from "@/components/meal-plans/use-meal-item-editor";
import type { MealItemWithSubstitutions } from "@/components/meal-plans/use-meal-item-editor";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const GERENCIAR = "__gerenciar";
const fmtG = (g: number) => g.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

type Editor = ReturnType<typeof useMealItemEditor>;

/**
 * Quantidade de um item: número + unidade (gramas ou medida caseira do IBGE /
 * do profissional) — Fase 17, Bloco D. Itens de receita seguem em porções.
 * Usado pela linha da tabela e pelo cartão do celular.
 */
export function MealItemQuantity({
  planId,
  item,
  editor,
}: {
  planId: string;
  item: MealItemWithSubstitutions;
  editor: Editor;
}) {
  const { isReceita, quantidade, setQuantidade, unidade, setUnidade, medidas, gramas, isPending, handleBlur } = editor;
  const [gerenciando, setGerenciando] = useState(false);
  const emMedida = !isReceita && unidade !== UNIDADE_GRAMAS;

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Input
        value={quantidade}
        onChange={(e) => setQuantidade(e.target.value)}
        onBlur={handleBlur}
        type="number"
        step={isReceita || emMedida ? "0.5" : "0.1"}
        className="h-8 w-16"
        aria-label={`Quantidade de ${item.nome_alimento} (${isReceita ? "porções" : emMedida ? "medidas" : "g"})`}
        disabled={isPending}
      />
      {isReceita ? (
        <span className="text-xs text-muted-foreground">porção(ões)</span>
      ) : (
        <>
          <select
            value={unidade}
            disabled={isPending}
            aria-label={`Unidade de ${item.nome_alimento}`}
            className="h-8 max-w-44 rounded-md border border-input bg-background px-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onChange={(e) => {
              if (e.target.value === GERENCIAR) setGerenciando(true);
              else setUnidade(e.target.value);
            }}
          >
            <option value={UNIDADE_GRAMAS}>g</option>
            {unidade === UNIDADE_ATUAL && item.medida_nome && (
              <option value={UNIDADE_ATUAL}>
                {item.medida_nome} ({fmtG(Number(item.medida_gramas))} g)
              </option>
            )}
            {medidas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome} ({fmtG(Number(m.gramas))} g)
              </option>
            ))}
            {item.food_id && <option value={GERENCIAR}>+ Criar ou excluir medida…</option>}
          </select>
          {emMedida && <span className="text-xs tabular-nums text-muted-foreground">= {fmtG(gramas)} g</span>}
          {item.food_id && (
            <MedidasDialog
              open={gerenciando}
              onOpenChange={setGerenciando}
              planId={planId}
              foodId={item.food_id}
              nomeAlimento={item.nome_alimento}
              medidas={medidas}
              onCriada={(m) => setUnidade(m.id, Number(m.gramas))}
            />
          )}
        </>
      )}
    </div>
  );
}

/** Lista as medidas do alimento e deixa criar/excluir as próprias (as do IBGE são só de leitura). */
function MedidasDialog({
  open,
  onOpenChange,
  planId,
  foodId,
  nomeAlimento,
  medidas,
  onCriada,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  planId: string;
  foodId: string;
  nomeAlimento: string;
  medidas: FoodMeasure[];
  onCriada: (m: FoodMeasure) => void;
}) {
  const [nome, setNome] = useState("");
  const [gramas, setGramas] = useState("");
  const [excluidas, setExcluidas] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const visiveis = medidas.filter((m) => !excluidas.includes(m.id));

  function criar(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await criarMedidaCaseira(foodId, { nome, gramas: Number(gramas.replace(",", ".")) }, planId);
      if (!res.success || !res.medida) {
        toast.error("Não foi possível criar a medida", { description: res.message });
        return;
      }
      toast.success("Medida criada e aplicada a este alimento.");
      setNome("");
      setGramas("");
      onOpenChange(false);
      onCriada(res.medida);
    });
  }

  function excluir(m: FoodMeasure) {
    startTransition(async () => {
      const res = await excluirMedidaCaseira(m.id, planId);
      if (!res.success) {
        toast.error("Não foi possível excluir", { description: res.message });
        return;
      }
      setExcluidas((x) => [...x, m.id]);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Medidas caseiras</DialogTitle>
          <DialogDescription>{nomeAlimento}</DialogDescription>
        </DialogHeader>

        {visiveis.length > 0 ? (
          <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-md border border-border text-sm">
            {visiveis.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
                <span>
                  {m.nome} <span className="tabular-nums text-muted-foreground">({fmtG(Number(m.gramas))} g)</span>
                </span>
                {m.fonte === "personalizado" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={isPending}
                    onClick={() => excluir(m)}
                    aria-label={`Excluir medida ${m.nome}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">IBGE</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Este alimento ainda não tem medidas caseiras.</p>
        )}

        <form onSubmit={criar} className="space-y-2">
          <p className="text-sm font-medium text-foreground">Nova medida</p>
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor={`medida-nome-${foodId}`} className="text-xs">
                Nome
              </Label>
              <Input
                id={`medida-nome-${foodId}`}
                placeholder="Ex.: pote pequeno"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                maxLength={80}
                required
              />
            </div>
            <div className="w-24 space-y-1">
              <Label htmlFor={`medida-gramas-${foodId}`} className="text-xs">
                Gramas
              </Label>
              <Input
                id={`medida-gramas-${foodId}`}
                inputMode="decimal"
                value={gramas}
                onChange={(e) => setGramas(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Criar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Só você vê as medidas que criar. Excluir uma medida não muda os planos que já a usaram.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
