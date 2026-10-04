"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { criarMedidaCaseira, excluirMedidaCaseira } from "@/lib/actions/food-measures";
import type { FoodMeasure } from "@/lib/types/database.types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const fmtG = (g: number) => g.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/** Lista as medidas do alimento e deixa criar/excluir as próprias (as do IBGE são só de leitura). */
export function MedidasDialog({
  open,
  onOpenChange,
  planId,
  foodId,
  nomeAlimento,
  medidas,
  onCriada,
  onExcluida,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  planId: string;
  foodId: string;
  nomeAlimento: string;
  medidas: FoodMeasure[];
  onCriada: (m: FoodMeasure) => void;
  onExcluida?: (medidaId: string) => void;
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
      onExcluida?.(m.id);
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
