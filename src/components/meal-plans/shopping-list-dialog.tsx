"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { listaDeComprasDoPlano } from "@/lib/actions/shopping-list";
import type { GrupoListaDeCompras } from "@/lib/shopping-list";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const OPCOES_DIAS = [1, 7, 15, 30];

/** Texto para colar no WhatsApp ou num e-mail. */
function comoTexto(lista: GrupoListaDeCompras[], dias: number) {
  const linhas = [`Lista de compras (${dias} ${dias === 1 ? "dia" : "dias"})`];
  for (const g of lista) {
    linhas.push("", `*${g.grupo}*`, ...g.itens.map((i) => `- ${i.nome}: ${i.texto}`));
  }
  return linhas.join("\n");
}

/**
 * Lista de compras (Fase 17, Bloco F): os alimentos do plano somados pelo
 * número de dias e agrupados por grupo da TACO. Copiar para mandar ao paciente;
 * no PDF, marque "Lista de compras" ao baixar.
 */
export function ShoppingListDialog({ planId }: { planId: string }) {
  const [open, setOpen] = useState(false);
  const [dias, setDias] = useState(7);
  const [resposta, setResposta] = useState<{ chave: string; lista: GrupoListaDeCompras[] } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const chave = `${planId}|${dias}`;
  const lista = resposta?.chave === chave ? resposta.lista : null;

  useEffect(() => {
    if (!open) return;
    let ativo = true;
    void listaDeComprasDoPlano(planId, dias).then((l) => ativo && setResposta({ chave, lista: l }));
    return () => {
      ativo = false;
    };
  }, [open, planId, dias, chave]);

  async function copiar() {
    if (!lista) return;
    try {
      await navigator.clipboard.writeText(comoTexto(lista, dias));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto e copie manualmente.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ShoppingCart className="h-4 w-4" />
          Lista de compras
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lista de compras</DialogTitle>
          <DialogDescription>
            Alimentos do plano somados pelos dias escolhidos. Receitas entram pelos ingredientes; substitutos não
            entram.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Para</span>
          <div className="flex gap-1.5" role="radiogroup" aria-label="Dias da lista de compras">
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
        </div>

        {lista === null ? (
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" aria-label="Montando a lista" />
        ) : lista.length === 0 ? (
          <p className="text-sm text-muted-foreground">O plano ainda não tem alimentos.</p>
        ) : (
          <div className="space-y-3">
            {lista.map((g) => (
              <section key={g.grupo} aria-label={g.grupo}>
                <h3 className="mb-1 text-sm font-semibold text-foreground">{g.grupo}</h3>
                <ul className="divide-y divide-border rounded-md border border-border text-sm">
                  {g.itens.map((i) => (
                    <li key={i.nome} className="flex items-center justify-between gap-3 px-3 py-1.5">
                      <span>{i.nome}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">{i.texto}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        <div className="flex justify-end">
          <Button type="button" variant="secondary" size="sm" onClick={copiar} disabled={!lista?.length}>
            {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copiado ? "Copiada" : "Copiar lista"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
