"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";

import { MAX_ITENS_COMPARACAO, selecaoPadrao, type ChaveItem, type ItemEvolucao } from "@/lib/evolution";
import { formatDate } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** "Evolução": escolher até 5 datas e baixar o PDF comparando-as. */
export function EvolutionDialog({
  patientId,
  itens,
  aPartirDe,
  open,
  onOpenChange,
}: {
  patientId: string;
  itens: ItemEvolucao[];
  /** Item clicado: vem marcado junto com os até 4 anteriores. */
  aPartirDe: ChaveItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [escolhidos, setEscolhidos] = useState<ChaveItem[]>(() => selecaoPadrao(itens, aPartirDe));
  const cheio = escolhidos.length >= MAX_ITENS_COMPARACAO;
  // Ordem cronológica na URL: o PDF reordena de qualquer jeito, mas fica legível.
  const href = `/pacientes/${patientId}/evolucao/pdf?itens=${itens
    .filter((i) => escolhidos.includes(i.chave))
    .reverse()
    .map((i) => i.chave)
    .join(",")}`;

  function alternar(chave: ChaveItem, marcado: boolean) {
    setEscolhidos((atual) => (marcado ? [...atual, chave].slice(0, MAX_ITENS_COMPARACAO) : atual.filter((c) => c !== chave)));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Evolução</DialogTitle>
          <DialogDescription>
            Escolha as datas das avaliações que deseja comparar (máximo {MAX_ITENS_COMPARACAO}). O PDF mostra a composição
            corporal, as análises e as medidas lado a lado.
          </DialogDescription>
        </DialogHeader>
        <fieldset className="space-y-1">
          <legend className="sr-only">Avaliações para comparar</legend>
          {itens.map((i) => {
            const marcado = escolhidos.includes(i.chave);
            const id = `evo-${i.chave}`;
            return (
              <label
                key={i.chave}
                htmlFor={id}
                className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted/60 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"
              >
                <Checkbox
                  id={id}
                  checked={marcado}
                  disabled={!marcado && cheio}
                  onCheckedChange={(v) => alternar(i.chave, v === true)}
                />
                <span className="font-medium">{formatDate(i.data)}</span>
                <span className="text-muted-foreground">{i.rotulo}</span>
              </label>
            );
          })}
        </fieldset>
        <DialogFooter className="items-center gap-2 sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {escolhidos.length} de {MAX_ITENS_COMPARACAO} escolhidas
          </p>
          <Button asChild disabled={escolhidos.length === 0}>
            <a href={escolhidos.length ? href : undefined} download onClick={() => onOpenChange(false)}>
              <FileDown className="h-4 w-4" />
              Gerar PDF
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
