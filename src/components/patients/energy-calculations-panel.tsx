"use client";

import { Fragment, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { Calculator, Loader2, Plus } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const acao =
  "text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:underline disabled:opacity-50";

const kcal = (v: number | null) =>
  v === null ? "não calculado" : `${Math.round(v).toLocaleString("pt-BR")} kcal/dia`;

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
      <CardHeader>
        <CardTitle>Cálculo energético</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button className="w-full" onClick={() => setCriando(true)}>
          <Plus className="h-4 w-4" />
          Novo cálculo energético
        </Button>

        {calculos.length === 0 ? (
          <EmptyState
            icon={Calculator}
            title="Nenhum cálculo energético"
            description="Calcule a TMB e o GET deste paciente. O cálculo salvo é usado depois para montar o plano alimentar."
          />
        ) : (
          <ul className="space-y-2">
            {calculos.map((c) => {
              const titulo = c.nome || "Sem nome";
              return (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-md bg-muted/60 px-4 py-3"
                >
                  <div className="text-sm">
                    <p className="font-medium text-foreground">{titulo}</p>
                    <p className="text-muted-foreground">Total de {kcal(c.get_kcal)}</p>
                    <p className="text-muted-foreground">Calculado em {formatDate(c.data_calculo)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1" aria-label={`Ações: ${titulo}`}>
                    {[
                      <Link key="edit" className={acao} href={`/pacientes/${patientId}/calculos/${c.id}`}>
                        Editar
                      </Link>,
                      <button key="dup" type="button" className={acao} disabled={isPending} onClick={() => duplicar(c.id)}>
                        Duplicar
                      </button>,
                      <button key="del" type="button" className={acao} disabled={isPending} onClick={() => setExcluindo(c)}>
                        Excluir
                      </button>,
                    ].map((a, i) => (
                      <Fragment key={i}>
                        {i > 0 && (
                          <span className="text-muted-foreground" aria-hidden="true">
                            |
                          </span>
                        )}
                        {a}
                      </Fragment>
                    ))}
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
