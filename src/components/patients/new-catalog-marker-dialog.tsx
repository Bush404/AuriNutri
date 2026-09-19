"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { saveMyReferenceRange } from "@/lib/actions/lab-markers";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const EMPTY = {
  nome_marcador: "",
  unidade: "",
  fonte: "",
  valor_min: "",
  valor_max: "",
  valor_min_m: "",
  valor_max_m: "",
  valor_min_f: "",
  valor_max_f: "",
};

/**
 * Adiciona um marcador novo ao catálogo PESSOAL do profissional — fora do
 * contexto de um resultado de um paciente específico. Fica disponível na
 * busca de marcadores (LabMarkerForm) para qualquer paciente dali em diante.
 *
 * Quando o marcador varia por sexo, mostra os DOIS blocos de referência
 * (masculino e feminino) lado a lado — o profissional preenche os dois de
 * uma vez e um único "Salvar" grava as duas faixas (duas linhas em
 * lab_reference_ranges, uma por sexo), em vez de precisar abrir o diálogo
 * duas vezes.
 */
export function NewCatalogMarkerDialog() {
  const [open, setOpen] = useState(false);
  const [variaPorSexo, setVariaPorSexo] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [isPending, startTransition] = useTransition();

  function set<K extends keyof typeof EMPTY>(campo: K, valor: string) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  function resetTudo() {
    setForm(EMPTY);
    setVariaPorSexo(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.nome_marcador.trim() || !form.unidade.trim()) {
      toast.error("Preencha o nome do marcador e a unidade.");
      return;
    }

    const paraNumero = (v: string) => (v === "" ? null : Number(v));

    const entradas = variaPorSexo
      ? [
          { sexo: "M" as const, valor_min: paraNumero(form.valor_min_m), valor_max: paraNumero(form.valor_max_m) },
          { sexo: "F" as const, valor_min: paraNumero(form.valor_min_f), valor_max: paraNumero(form.valor_max_f) },
        ].filter((e) => e.valor_min !== null || e.valor_max !== null)
      : [{ sexo: "ambos" as const, valor_min: paraNumero(form.valor_min), valor_max: paraNumero(form.valor_max) }].filter(
          (e) => e.valor_min !== null || e.valor_max !== null
        );

    if (entradas.length === 0) {
      toast.error(
        variaPorSexo
          ? "Informe ao menos um valor (mínimo ou máximo) para masculino ou para feminino."
          : "Informe ao menos um valor (mínimo ou máximo)."
      );
      return;
    }

    startTransition(async () => {
      for (const entrada of entradas) {
        const result = await saveMyReferenceRange({
          nome_marcador: form.nome_marcador.trim(),
          unidade: form.unidade.trim(),
          sexo: entrada.sexo,
          valor_min: entrada.valor_min,
          valor_max: entrada.valor_max,
          fonte: form.fonte || null,
        });
        if (!result.success) {
          toast.error("Não foi possível salvar o marcador", { description: result.message });
          return;
        }
      }

      toast.success(
        entradas.length === 2 ? "Marcador adicionado (masculino e feminino)." : "Marcador adicionado ao seu catálogo."
      );
      resetTudo();
      setOpen(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetTudo();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4" />
          Adicionar marcador ao catálogo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo marcador no catálogo</DialogTitle>
          <DialogDescription>
            Fica disponível na busca de marcadores para qualquer paciente a partir de agora. Se já existir uma
            faixa global com esse nome, a sua passa a valer no lugar dela nas próximas sugestões.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome_marcador">Nome do marcador *</Label>
            <Input
              id="nome_marcador"
              placeholder="Ex.: Homocisteína"
              value={form.nome_marcador}
              onChange={(e) => set("nome_marcador", e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="unidade">Unidade *</Label>
            <Input
              id="unidade"
              placeholder="µmol/L"
              value={form.unidade}
              onChange={(e) => set("unidade", e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2 rounded-md border border-border p-3">
            <Label>Esse marcador varia por sexo?</Label>
            <p className="text-xs text-muted-foreground">
              Ex.: HDL, ferritina, hemoglobina — a faixa é diferente para masculino e feminino.
            </p>
            <Select
              value={variaPorSexo ? "sim" : "nao"}
              onValueChange={(v) => setVariaPorSexo(v === "sim")}
              disabled={isPending}
            >
              <SelectTrigger className="max-w-[280px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nao">Não — uma faixa só, para todos</SelectItem>
                <SelectItem value="sim">Sim — faixas diferentes por sexo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {variaPorSexo ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2 rounded-md border border-border p-3">
                <p className="text-sm font-medium text-foreground">Faixa — Masculino</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Mín.</Label>
                    <Input
                      type="number"
                      step="any"
                      value={form.valor_min_m}
                      onChange={(e) => set("valor_min_m", e.target.value)}
                      disabled={isPending}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Máx.</Label>
                    <Input
                      type="number"
                      step="any"
                      value={form.valor_max_m}
                      onChange={(e) => set("valor_max_m", e.target.value)}
                      disabled={isPending}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2 rounded-md border border-border p-3">
                <p className="text-sm font-medium text-foreground">Faixa — Feminino</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Mín.</Label>
                    <Input
                      type="number"
                      step="any"
                      value={form.valor_min_f}
                      onChange={(e) => set("valor_min_f", e.target.value)}
                      disabled={isPending}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Máx.</Label>
                    <Input
                      type="number"
                      step="any"
                      value={form.valor_max_f}
                      onChange={(e) => set("valor_max_f", e.target.value)}
                      disabled={isPending}
                    />
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Pode preencher só um dos dois agora e voltar depois para completar o outro.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valor_min">Referência mín.</Label>
                <Input
                  id="valor_min"
                  type="number"
                  step="any"
                  value={form.valor_min}
                  onChange={(e) => set("valor_min", e.target.value)}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="valor_max">Referência máx.</Label>
                <Input
                  id="valor_max"
                  type="number"
                  step="any"
                  value={form.valor_max}
                  onChange={(e) => set("valor_max", e.target.value)}
                  disabled={isPending}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="fonte">Fonte (opcional)</Label>
            <Input
              id="fonte"
              placeholder="Ex.: laboratório X, diretriz Y"
              value={form.fonte}
              onChange={(e) => set("fonte", e.target.value)}
              disabled={isPending}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar no catálogo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
