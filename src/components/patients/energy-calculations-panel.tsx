"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { CalendarDays, Calculator, Copy, FileText, Flame, Loader2, Pencil, Plus, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";

import { excluirCalculoEnergetico, iniciarCalculoEnergetico } from "@/lib/actions/energy-calculations";
import type { EnergyCalculation } from "@/lib/types/database.types";
import { formatDate } from "@/lib/utils";

import { EmptyState } from "@/components/shared/empty-state";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const totalDoCalculo = (v: number | null) =>
  v === null ? "Total ainda não calculado" : `Total de ${Math.round(v).toLocaleString("pt-BR")} kcal/dia`;

/**
 * Aba "Cálculo energético" (Fase 16, a partir do WebDiet): lista dos
 * cálculos com nome, total e data — Editar | Duplicar | Excluir. "Novo
 * cálculo" pede um nome e já cria o registro (salva sozinho, como a antropometria).
 */
export function EnergyCalculationsPanel({ patientId, calculos }: { patientId: string; calculos: EnergyCalculation[] }) {
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [excluindo, setExcluindo] = useState<EnergyCalculation | null>(null);
  const [isPending, startTransition] = useTransition();

  function abrir(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await iniciarCalculoEnergetico(patientId, nome);
      if (r && !r.success) toast.error("Não foi possível criar o cálculo", { description: r.message });
    });
  }

  function duplicar(id: string) {
    startTransition(async () => {
      const r = await iniciarCalculoEnergetico(patientId, "", id);
      if (r && !r.success) toast.error("Não foi possível duplicar o cálculo", { description: r.message });
    });
  }

  function confirmarExclusao() {
    const alvo = excluindo;
    if (!alvo) return;
    startTransition(async () => {
      const r = await excluirCalculoEnergetico(patientId, alvo.id);
      setExcluindo(null);
      if (!r.success) toast.error("Não foi possível excluir", { description: r.message });
      else toast.success("Cálculo excluído.");
    });
  }

  return (
    <Card>
      <CardContent className="space-y-5 p-4 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-success-soft text-primary">
              <Zap className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Cálculo energético</h2>
              <p className="text-sm text-muted-foreground">Gerencie os cálculos energéticos do paciente.</p>
            </div>
          </div>
          <Button size="lg" className="shrink-0" onClick={() => setCriando(true)}>
            <Plus className="h-4 w-4" />
            Novo cálculo energético
          </Button>
        </div>

        {calculos.length === 0 ? (
          <EmptyState
            icon={Calculator}
            title="Nenhum cálculo energético"
            description="Calcule a TMB e o GET deste paciente. O cálculo salvo é usado depois para montar o plano alimentar."
          />
        ) : (
          <ul className="space-y-3">
            {calculos.map((c) => {
              const titulo = c.nome || "Sem nome";
              return (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border border-border bg-card px-4 py-4 sm:px-5"
                >
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-success-soft text-primary">
                    <FileText className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1 basis-48 space-y-1">
                    <p className="break-words text-lg font-semibold text-foreground">{titulo}</p>
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Flame className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {totalDoCalculo(c.get_kcal)}
                    </p>
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
                      Calculado em {formatDate(c.data_calculo)}
                    </p>
                  </div>
                  <div
                    className="flex flex-wrap items-center gap-2 sm:border-l sm:border-border sm:pl-5"
                    aria-label={`Ações: ${titulo}`}
                  >
                    <Button variant="outline" asChild>
                      <Link href={`/pacientes/${patientId}/calculos/${c.id}`}>
                        <Pencil className="h-4 w-4" />
                        Editar
                      </Link>
                    </Button>
                    <Button variant="outline" disabled={isPending} onClick={() => duplicar(c.id)}>
                      <Copy className="h-4 w-4" />
                      Duplicar
                    </Button>
                    <Button
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={isPending}
                      onClick={() => setExcluindo(c)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Excluir
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      <Dialog open={criando} onOpenChange={(o) => !isPending && setCriando(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo cálculo energético</DialogTitle>
            <DialogDescription>Dê um nome para reconhecer este cálculo na hora de montar o plano.</DialogDescription>
          </DialogHeader>
          <form onSubmit={abrir} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nome_calculo">Nome (opcional)</Label>
              <Input
                id="nome_calculo"
                placeholder="Ex.: Dias de treino"
                maxLength={80}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Criar cálculo energético
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(excluindo)} onOpenChange={(o) => !o && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cálculo?</AlertDialogTitle>
            <AlertDialogDescription>
              {excluindo ? `"${excluindo.nome || "Sem nome"}", de ${formatDate(excluindo.data_calculo)}. ` : ""}
              Ele some da lista.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExclusao}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
