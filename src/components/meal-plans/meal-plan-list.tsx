"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ClipboardList, Copy, Download, FileText, Loader2, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { MealPlan } from "@/lib/types/database.types";
import {
  alternarPlanoFavorito,
  deleteMealPlan,
  duplicateMealPlan,
  reordenarPlanos,
  toggleMealPlanStatus,
} from "@/lib/actions/meal-plans";
import { kcalPorKg } from "@/lib/meal-planning";
import { cn, formatDate } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { NewMealPlanDialog } from "@/components/meal-plans/new-meal-plan-dialog";

/** Plano com as calorias de um dia já somadas (página do paciente). */
export type PlanoNaLista = MealPlan & { kcal: number };

const fmt = (v: number, casas = 0) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

/**
 * Planos alimentares do paciente (Fase 17, Bloco G), como no WebDiet: cada
 * plano com kcal e kcal/kg, data, ativo/inativo e as ações na própria linha
 * (PDF, editar, duplicar, favoritar como modelo, excluir) e setas para ordenar.
 */
export function MealPlanList({
  patientId,
  mealPlans,
  pesoKg,
}: {
  patientId: string;
  mealPlans: PlanoNaLista[];
  pesoKg: number | null;
}) {
  // Ordem local: as setas respondem na hora; o servidor grava em seguida.
  const [ordemLocal, setOrdemLocal] = useState<string[] | null>(null);
  const [, startOrdem] = useTransition();
  const porId = new Map(mealPlans.map((p) => [p.id, p]));
  const ids =
    ordemLocal && ordemLocal.length === mealPlans.length && ordemLocal.every((id) => porId.has(id))
      ? ordemLocal
      : mealPlans.map((p) => p.id);

  function mover(id: string, delta: -1 | 1) {
    const i = ids.indexOf(id);
    const j = i + delta;
    if (j < 0 || j >= ids.length) return;
    const novos = ids.slice();
    [novos[i], novos[j]] = [novos[j], novos[i]];
    setOrdemLocal(novos);
    startOrdem(async () => {
      const r = await reordenarPlanos(patientId, novos);
      if (!r.success) {
        setOrdemLocal(null);
        toast.error("Não foi possível reordenar", { description: r.message });
      }
    });
  }

  const novoPlano = (rotulo: string) => (
    <NewMealPlanDialog
      patientId={patientId}
      trigger={
        <Button>
          <Plus className="h-4 w-4" />
          {rotulo}
        </Button>
      }
    />
  );

  if (mealPlans.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-h2 text-foreground">Planos alimentares</h2>
        <EmptyState
          icon={ClipboardList}
          title="Nenhum plano alimentar criado ainda"
          description="Monte o primeiro plano alimentar deste paciente, do zero ou a partir de um dos seus modelos."
          action={novoPlano("Criar plano alimentar")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-h2 text-foreground">Planos alimentares</h2>
        {novoPlano("Novo plano")}
      </div>

      <ul className="space-y-2" aria-label="Planos alimentares">
        {ids.map((id, indice) => {
          const plan = porId.get(id)!;
          return (
            <li key={plan.id}>
              <MealPlanRow
                patientId={patientId}
                plan={plan}
                pesoKg={plan.planejamento_peso_kg ?? pesoKg}
                primeiro={indice === 0}
                ultimo={indice === ids.length - 1}
                onMover={(d) => mover(plan.id, d)}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function IconeAcao({
  rotulo,
  onClick,
  disabled,
  children,
  className,
}: {
  rotulo: string;
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("h-9 w-9 text-foreground", className)}
      title={rotulo}
      aria-label={rotulo}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}

function MealPlanRow({
  patientId,
  plan,
  pesoKg,
  primeiro,
  ultimo,
  onMover,
}: {
  patientId: string;
  plan: PlanoNaLista;
  pesoKg: number | null;
  primeiro: boolean;
  ultimo: boolean;
  onMover: (delta: -1 | 1) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [favorito, setFavorito] = useState(plan.favorito);
  const href = `/planos/${plan.id}`;
  const porKg = kcalPorKg(plan.kcal, pesoKg);

  function rodar(acao: () => Promise<{ success: boolean; message?: string }>, sucesso?: string) {
    startTransition(async () => {
      const r = await acao();
      if (r && !r.success) toast.error("Não foi possível concluir", { description: r.message });
      else if (r && (sucesso ?? r.message)) toast.success(sucesso ?? r.message);
    });
  }

  function alternarFavorito() {
    const novo = !favorito;
    setFavorito(novo);
    startTransition(async () => {
      const r = await alternarPlanoFavorito(plan.id, novo, patientId);
      if (!r.success) {
        setFavorito(!novo);
        toast.error("Não foi possível favoritar", { description: r.message });
      } else toast.success(r.message);
    });
  }

  return (
    // O card todo abre o plano com o mouse; o link do nome é o caminho pelo teclado.
    <Card className="cursor-pointer transition-shadow hover:shadow-card" onClick={() => router.push(href)}>
      <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <div className="flex flex-col" onClick={(e) => e.stopPropagation()}>
          <IconeAcao
            rotulo={`Mover ${plan.nome} para cima`}
            onClick={() => onMover(-1)}
            disabled={primeiro}
            className="h-5 w-6 text-muted-foreground"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </IconeAcao>
          <IconeAcao
            rotulo={`Mover ${plan.nome} para baixo`}
            onClick={() => onMover(1)}
            disabled={ultimo}
            className="h-5 w-6 text-muted-foreground"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </IconeAcao>
        </div>

        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-success-soft text-primary">
          <FileText className="h-5 w-5" />
        </span>

        <Link
          href={href}
          onClick={(e) => e.stopPropagation()}
          className="min-w-0 flex-1 basis-48 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <p className="truncate font-semibold text-foreground">{plan.nome}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            <span className="tabular-nums">{fmt(plan.kcal)} kcal</span>
            {porKg !== null && <span className="tabular-nums"> · {fmt(porKg, 1)} kcal/kg</span>} · Criado em{" "}
            {formatDate(plan.created_at.slice(0, 10))}
          </p>
        </Link>

        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Badge
            role="switch"
            aria-checked={plan.ativo}
            aria-label={`${plan.nome}: ${plan.ativo ? "ativo" : "inativo"}`}
            tabIndex={0}
            variant={plan.ativo ? "success" : "outline"}
            className="cursor-pointer select-none gap-1.5 rounded-full px-3 py-1"
            onClick={() =>
              rodar(
                () => toggleMealPlanStatus(plan.id, !plan.ativo, patientId),
                plan.ativo ? "Plano desativado." : "Plano ativado.",
              )
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                rodar(() => toggleMealPlanStatus(plan.id, !plan.ativo, patientId));
              }
            }}
          >
            <span
              aria-hidden
              className={cn("h-2 w-2 rounded-full", plan.ativo ? "bg-success" : "bg-muted-foreground/50")}
            />
            {plan.ativo ? "Ativo" : "Inativo"}
          </Badge>
          <span aria-hidden className="mx-2 h-7 w-px bg-border" />
          <IconeAcao
            rotulo={favorito ? `Tirar ${plan.nome} dos modelos` : `Favoritar ${plan.nome} como modelo`}
            onClick={alternarFavorito}
            disabled={isPending}
          >
            <Star className={cn("h-[18px] w-[18px]", favorito && "fill-amber-400 text-amber-500")} />
          </IconeAcao>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-foreground" asChild title="Baixar PDF">
            <a href={`${href}/pdf`} aria-label={`Baixar PDF de ${plan.nome}`}>
              <Download className="h-[18px] w-[18px]" />
            </a>
          </Button>
          <IconeAcao rotulo={`Editar ${plan.nome}`} onClick={() => router.push(href)}>
            <Pencil className="h-[18px] w-[18px]" />
          </IconeAcao>
          <IconeAcao
            rotulo={`Duplicar ${plan.nome}`}
            onClick={() => rodar(() => duplicateMealPlan(plan.id))}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Copy className="h-[18px] w-[18px]" />}
          </IconeAcao>
          <IconeAcao rotulo={`Excluir ${plan.nome}`} onClick={() => setConfirmOpen(true)} disabled={isPending}>
            <Trash2 className="h-[18px] w-[18px]" />
          </IconeAcao>

          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir plano alimentar</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir <strong>{plan.nome}</strong>? Todas as refeições e itens cadastrados
                  neste plano serão excluídos permanentemente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    startTransition(async () => {
                      const r = await deleteMealPlan(plan.id, patientId);
                      if (!r.success) {
                        toast.error("Não foi possível excluir o plano", { description: r.message });
                        return;
                      }
                      setConfirmOpen(false);
                      toast.success("Plano excluído.");
                    });
                  }}
                  disabled={isPending}
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
