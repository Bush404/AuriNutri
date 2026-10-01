"use client";

import { useState, useTransition, type DragEvent, type KeyboardEvent } from "react";
import { ArrowUpDown, ChevronsDownUp, ChevronsUpDown, GripVertical, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { reorderMeals, reorderMealsByTime } from "@/lib/actions/meals";
import { cn } from "@/lib/utils";

import { MealCard, type MealWithItemsAndSubstitutions } from "@/components/meal-plans/meal-card";
import { Button } from "@/components/ui/button";

/**
 * "Rotina do paciente" (Fase 17, Bloco B): refeições fechadas em linha, que se
 * arrastam pela alça (ou com as setas do teclado, com a alça em foco),
 * "expandir tudo" e "reordenar por horário", como no WebDiet. A nova ordem
 * aparece na hora e é gravada em seguida.
 */
export function MealList({ planId, meals }: { planId: string; meals: MealWithItemsAndSubstitutions[] }) {
  // Ordem mostrada enquanto a gravação não volta do servidor; null = a ordem que veio do servidor.
  const [pendente, setPendente] = useState<string[] | null>(null);
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [pegaPelaAlca, setPegaPelaAlca] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [isPending, startTransition] = useTransition();

  const porId = new Map(meals.map((m) => [m.id, m]));
  const ordem = (pendente ?? meals.map((m) => m.id)).filter((id) => porId.has(id));
  const todasAbertas = meals.length > 0 && meals.every((m) => abertas.has(m.id));

  function gravar(nova: string[]) {
    setPendente(nova);
    startTransition(async () => {
      const r = await reorderMeals(planId, nova);
      if (!r.success) toast.error("Não foi possível mudar a ordem", { description: r.message });
      setPendente(null);
    });
  }

  function mover(id: string, para: number) {
    const atual = ordem.indexOf(id);
    if (atual < 0 || para < 0 || para >= ordem.length || para === atual) return null;
    const nova = ordem.slice();
    nova.splice(atual, 1);
    nova.splice(para, 0, id);
    return nova;
  }

  function aoArrastarSobre(e: DragEvent<HTMLLIElement>, alvo: string) {
    if (!arrastando || arrastando === alvo) return;
    e.preventDefault();
    const caixa = e.currentTarget.getBoundingClientRect();
    const depois = e.clientY > caixa.top + caixa.height / 2;
    const semArrastada = ordem.filter((id) => id !== arrastando);
    const pos = semArrastada.indexOf(alvo) + (depois ? 1 : 0);
    const nova = [...semArrastada.slice(0, pos), arrastando, ...semArrastada.slice(pos)];
    if (nova.join() !== ordem.join()) setPendente(nova);
  }

  function aoSoltar() {
    const nova = pendente;
    setArrastando(null);
    setPegaPelaAlca(null);
    if (nova && nova.join() !== meals.map((m) => m.id).join()) gravar(nova);
    else setPendente(null);
  }

  function aoTeclar(e: KeyboardEvent<HTMLButtonElement>, id: string, nome: string) {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const nova = mover(id, ordem.indexOf(id) + (e.key === "ArrowUp" ? -1 : 1));
    if (!nova) return;
    gravar(nova);
    setAviso(`${nome}: posição ${nova.indexOf(id) + 1} de ${nova.length}.`);
  }

  function porHorario() {
    startTransition(async () => {
      const r = await reorderMealsByTime(planId);
      if (!r.success) toast.error("Não foi possível reordenar", { description: r.message });
    });
  }

  return (
    <div className="space-y-2">
      {meals.length > 1 && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setAbertas(todasAbertas ? new Set() : new Set(meals.map((m) => m.id)))}
          >
            {todasAbertas ? <ChevronsDownUp className="h-3.5 w-3.5" /> : <ChevronsUpDown className="h-3.5 w-3.5" />}
            {todasAbertas ? "Recolher tudo" : "Expandir tudo"}
          </Button>
          <Button type="button" variant="secondary" size="sm" className="h-7 text-xs" onClick={porHorario} disabled={isPending}>
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUpDown className="h-3.5 w-3.5" />}
            Reordenar por horário
          </Button>
        </div>
      )}

      <ul className="space-y-2">
        {ordem.map((id) => {
          const meal = porId.get(id)!;
          return (
            <li
              key={id}
              draggable={pegaPelaAlca === id}
              onDragStart={(e) => {
                setArrastando(id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => aoArrastarSobre(e, id)}
              onDrop={(e) => {
                e.preventDefault();
                aoSoltar();
              }}
              onDragEnd={aoSoltar}
              className={cn(arrastando === id && "opacity-50")}
            >
              <MealCard
                planId={planId}
                meal={meal}
                aberta={abertas.has(id)}
                onAlternar={() =>
                  setAbertas((atual) => {
                    const nova = new Set(atual);
                    if (!nova.delete(id)) nova.add(id);
                    return nova;
                  })
                }
                alca={
                  meals.length > 1 ? (
                    <button
                      type="button"
                      className="flex h-8 w-6 cursor-grab items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
                      aria-label={`Mover ${meal.nome} (setas para cima e para baixo)`}
                      title="Arraste para mudar a ordem"
                      onPointerDown={() => setPegaPelaAlca(id)}
                      onPointerUp={() => !arrastando && setPegaPelaAlca(null)}
                      onKeyDown={(e) => aoTeclar(e, id, meal.nome)}
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>
                  ) : null
                }
              />
            </li>
          );
        })}
      </ul>
      <p className="sr-only" aria-live="polite">
        {aviso}
      </p>
    </div>
  );
}
