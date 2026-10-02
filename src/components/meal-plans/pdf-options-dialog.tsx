"use client";

import { useState } from "react";
import { Download } from "lucide-react";

import type { Condicao } from "@/lib/dri";
import type { Sexo } from "@/lib/types/database.types";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { OPCOES_DIAS } from "@/components/meal-plans/shopping-list-dialog";

/** Monta o endereço de download com as opções (lidas por opcoesDoPdf na rota). */
export function urlDoPdf(
  planId: string,
  o: {
    estilo: "tabela" | "lista";
    nutrientes: boolean;
    compras: boolean;
    dias: number;
    quebra: boolean;
    condicao: Condicao;
  },
) {
  const p = new URLSearchParams();
  if (o.estilo === "lista") p.set("estilo", "lista");
  if (o.nutrientes) p.set("nutrientes", "1");
  if (o.nutrientes && o.condicao !== "nenhuma") p.set("condicao", o.condicao);
  if (o.compras) {
    p.set("compras", "1");
    p.set("dias", String(o.dias));
  }
  if (o.quebra) p.set("quebra", "1");
  const q = p.toString();
  return `/planos/${planId}/pdf${q ? `?${q}` : ""}`;
}

function Opcao({
  id,
  checked,
  onChange,
  titulo,
  detalhe,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  titulo: string;
  detalhe: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} className="mt-0.5" />
      <Label htmlFor={id} className="space-y-0.5 font-normal">
        <span className="block text-sm font-medium text-foreground">{titulo}</span>
        <span className="block text-xs text-muted-foreground">{detalhe}</span>
      </Label>
    </div>
  );
}

/**
 * "Baixar PDF" com opções (Fase 17, Bloco F), como no WebDiet: estilo,
 * relatório de nutrientes, lista de compras e uma refeição por página.
 */
export function PdfOptionsDialog({ planId, sexo }: { planId: string; sexo: Sexo | null }) {
  const [estilo, setEstilo] = useState<"tabela" | "lista">("tabela");
  const [nutrientes, setNutrientes] = useState(false);
  const [compras, setCompras] = useState(false);
  const [dias, setDias] = useState(7);
  const [quebra, setQuebra] = useState(false);
  const [condicao, setCondicao] = useState<Condicao>("nenhuma");

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4" />
          Baixar PDF
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Baixar PDF do plano</DialogTitle>
          <DialogDescription>Escolha o que entra no PDF.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">Estilo</p>
            <div className="flex gap-1.5" role="radiogroup" aria-label="Estilo do PDF">
              {(
                [
                  ["tabela", "Tabela com macros"],
                  ["lista", "Lista simples"],
                ] as const
              ).map(([valor, rotulo]) => (
                <Button
                  key={valor}
                  type="button"
                  size="sm"
                  role="radio"
                  aria-checked={estilo === valor}
                  variant={estilo === valor ? "default" : "outline"}
                  className="h-8 text-xs"
                  onClick={() => setEstilo(valor)}
                >
                  {rotulo}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {estilo === "tabela"
                ? "Alimento, quantidade, calorias e macros de cada item e o total do dia."
                : "Só alimento e quantidade — mais simples para o paciente."}
            </p>
          </div>

          <Opcao
            id="pdf-nutrientes"
            checked={nutrientes}
            onChange={setNutrientes}
            titulo="Relatório de nutrientes"
            detalhe="Página com macros por refeição e micronutrientes × recomendação diária (DRI)."
          />
          {nutrientes && sexo === "feminino" && (
            <div className="flex flex-wrap items-center gap-1.5 pl-6" role="radiogroup" aria-label="Condição">
              {(
                [
                  ["nenhuma", "Sem condição"],
                  ["gestante", "Gestante"],
                  ["lactante", "Lactante"],
                ] as const
              ).map(([valor, rotulo]) => (
                <Button
                  key={valor}
                  type="button"
                  size="sm"
                  role="radio"
                  aria-checked={condicao === valor}
                  variant={condicao === valor ? "default" : "outline"}
                  className="h-7 text-xs"
                  onClick={() => setCondicao(valor)}
                >
                  {rotulo}
                </Button>
              ))}
            </div>
          )}

          <Opcao
            id="pdf-compras"
            checked={compras}
            onChange={setCompras}
            titulo="Lista de compras"
            detalhe="Página com os alimentos do plano somados pelos dias escolhidos."
          />
          {compras && (
            <div
              className="flex flex-wrap items-center gap-1.5 pl-6"
              role="radiogroup"
              aria-label="Dias da lista de compras"
            >
              {OPCOES_DIAS.map((d) => (
                <Button
                  key={d}
                  type="button"
                  size="sm"
                  role="radio"
                  aria-checked={dias === d}
                  variant={dias === d ? "default" : "outline"}
                  className="h-7 text-xs"
                  onClick={() => setDias(d)}
                >
                  {d} {d === 1 ? "dia" : "dias"}
                </Button>
              ))}
            </div>
          )}

          <Opcao
            id="pdf-quebra"
            checked={quebra}
            onChange={setQuebra}
            titulo="Uma refeição por página"
            detalhe="Cada refeição começa numa página nova."
          />
        </div>

        <div className="flex justify-end">
          <Button asChild>
            <a href={urlDoPdf(planId, { estilo, nutrientes, compras, dias, quebra, condicao })}>
              <Download className="h-4 w-4" />
              Baixar
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
