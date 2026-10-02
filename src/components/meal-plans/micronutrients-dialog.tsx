"use client";

import { useState } from "react";
import { AlertTriangle, ListChecks } from "lucide-react";

import { nutrientesDoCardapio, type Condicao, type Situacao } from "@/lib/dri";
import type { MealItem, Sexo } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { maximumFractionDigits: v >= 100 ? 0 : v >= 10 ? 1 : 2, minimumFractionDigits: 0 });

const SITUACAO: Record<Situacao, { rotulo: string; variante: "success" | "warning" | "outline" }> = {
  abaixo: { rotulo: "Abaixo", variante: "warning" },
  adequado: { rotulo: "Adequado", variante: "success" },
  acima: { rotulo: "Acima", variante: "warning" },
  so_limite: { rotulo: "Só limite", variante: "outline" },
  sem_dado: { rotulo: "Sem dado", variante: "outline" },
};

const CONDICOES: { valor: Condicao; rotulo: string }[] = [
  { valor: "nenhuma", rotulo: "Nenhuma" },
  { valor: "gestante", rotulo: "Gestante" },
  { valor: "lactante", rotulo: "Lactante" },
];

/**
 * "Ver todos os nutrientes" (Fase 17, Bloco F): micronutrientes do cardápio ×
 * DRI da faixa de idade e sexo do paciente, com adequação de ±20% e alerta de
 * limite (UL; no sódio, a CDRR). Mesma conta da página de nutrientes do PDF.
 */
export function MicronutrientsDialog({
  itens,
  paciente,
}: {
  itens: MealItem[];
  paciente: { sexo: Sexo | null; data_nascimento: string | null };
}) {
  const [condicao, setCondicao] = useState<Condicao>("nenhuma");
  const hoje = new Date().toISOString().slice(0, 10);
  const n = nutrientesDoCardapio(itens, paciente, condicao, hoje);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <ListChecks className="h-4 w-4" />
          Ver todos os nutrientes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Micronutrientes do cardápio</DialogTitle>
          <DialogDescription>
            Total de um dia do plano comparado à recomendação diária (DRI)
            {n.faixa ? ` para: ${n.faixa}.` : "."}
          </DialogDescription>
        </DialogHeader>

        {paciente.sexo === "feminino" && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Condição</span>
            <div className="flex gap-1.5" role="radiogroup" aria-label="Condição">
              {CONDICOES.map((c) => (
                <Button
                  key={c.valor}
                  type="button"
                  size="sm"
                  role="radio"
                  aria-checked={condicao === c.valor}
                  variant={condicao === c.valor ? "default" : "outline"}
                  className="h-7 text-xs"
                  onClick={() => setCondicao(c.valor)}
                >
                  {c.rotulo}
                </Button>
              ))}
            </div>
          </div>
        )}

        {n.linhas.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
            Cadastre o sexo (masculino ou feminino) e a data de nascimento do paciente para comparar com a recomendação
            da faixa de idade.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs text-muted-foreground">
                <tr className="text-left">
                  <th className="px-2 py-1.5 font-medium">Nutriente</th>
                  <th className="px-2 py-1.5 text-right font-medium">No cardápio</th>
                  <th className="px-2 py-1.5 text-right font-medium">Recomendação</th>
                  <th className="px-2 py-1.5 text-right font-medium">%</th>
                  <th className="px-2 py-1.5 text-right font-medium">Limite</th>
                  <th className="px-2 py-1.5 text-right font-medium">Situação</th>
                </tr>
              </thead>
              <tbody>
                {n.linhas.map((l) => (
                  <tr key={l.chave} className="border-t border-border/60">
                    <td className="px-2 py-1.5 text-foreground">
                      {l.rotulo} <span className="text-xs text-muted-foreground">({l.unidade})</span>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {l.consumo === null ? "—" : fmt(l.consumo)}
                      {l.consumo !== null && l.itensSemDado > 0 && (
                        <span
                          className="ml-0.5 text-muted-foreground"
                          title={`${l.itensSemDado} alimento(s) sem esse dado — total parcial`}
                        >
                          *
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                      {l.recomendacao === null ? "—" : `${fmt(l.recomendacao)} ${l.tipo}`}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {l.percentual === null ? "—" : `${Math.round(l.percentual)}%`}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                      {l.limite === null ? "—" : `${fmt(l.limite)}${l.chave === "sodio_mg" ? " (CDRR)" : ""}`}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      {l.acimaDoLimite ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                          Acima do limite
                        </Badge>
                      ) : (
                        <Badge variant={SITUACAO[l.situacao].variante}>{SITUACAO[l.situacao].rotulo}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Sem DRI:{" "}
          {n.semReferencia.map((s) => `${s.rotulo} ${s.valor === null ? "—" : fmt(s.valor)} ${s.unidade}`).join(" · ")}
        </p>
        <div className={cn("space-y-1 text-xs text-muted-foreground")}>
          <p>
            Adequado = entre 80% e 120% da recomendação (RDA ou AI). Limite = UL; no sódio, a CDRR (&quot;reduzir se
            acima de&quot;). Fonte: National Academies, <em>Dietary Reference Intakes Summary Tables</em> (2019).
          </p>
          {n.linhas.some((l) => l.itensSemDado > 0) && (
            <p>* Total parcial: algum alimento do cardápio não tem esse dado na tabela de origem (TACO).</p>
          )}
          {n.itensSemMicros > 0 && (
            <p>
              {n.itensSemMicros} alimento(s) do cardápio sem micronutrientes — alimentos próprios ou receitas
              adicionados antes desta versão. Remova e adicione de novo para incluir.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
