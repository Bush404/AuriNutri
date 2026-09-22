"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Loader2, Plus, Save } from "lucide-react";
import { toast } from "sonner";

import {
  addLabMarker,
  getReferenceRangeSuggestion,
  listReferenceMarkerCatalog,
  saveMyReferenceRange,
  type MarkerCatalogEntry,
  type ReferenceRangeOption,
} from "@/lib/actions/lab-markers";
import { useComboboxKeyboardNav } from "@/lib/use-combobox-keyboard";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface LabMarkerFormProps {
  patientId: string;
  examId: string;
}

const EMPTY = {
  nome_marcador: "",
  valor: "",
  unidade: "",
  referencia_min: "",
  referencia_max: "",
};

export function LabMarkerForm({ patientId, examId }: LabMarkerFormProps) {
  const [form, setForm] = useState(EMPTY);
  const [referenciaEditada, setReferenciaEditada] = useState(false);
  const [opcoesSexo, setOpcoesSexo] = useState<ReferenceRangeOption[]>([]);
  const [sexoEscolhido, setSexoEscolhido] = useState<"M" | "F" | "">("");
  const [origemSugestao, setOrigemSugestao] = useState<ReferenceRangeOption["origem"] | null>(null);
  const [buscandoFaixa, setBuscandoFaixa] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [catalogo, setCatalogo] = useState<MarkerCatalogEntry[]>([]);
  const [listaAberta, setListaAberta] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  useEffect(() => {
    listReferenceMarkerCatalog().then(setCatalogo);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setListaAberta(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const termoBusca = form.nome_marcador.trim().toLowerCase();
  const sugestoes = termoBusca
    ? catalogo.filter((c) => c.nome_marcador.toLowerCase().includes(termoBusca))
    : catalogo;

  async function buscarFaixaPara(nome: string) {
    if (!nome.trim()) return;

    setBuscandoFaixa(true);
    const suggestion = await getReferenceRangeSuggestion(patientId, nome);
    setBuscandoFaixa(false);

    if (suggestion.precisaEscolherSexo) {
      setOpcoesSexo(suggestion.opcoes);
      setSexoEscolhido("");
      setOrigemSugestao(null);
      return;
    }

    setOpcoesSexo([]);
    if (suggestion.opcoes[0]) {
      aplicarOpcao(suggestion.opcoes[0]);
    } else {
      setOrigemSugestao(null);
    }
  }

  function aplicarOpcao(opcao: ReferenceRangeOption) {
    setForm((f) => ({
      ...f,
      unidade: opcao.unidade,
      referencia_min: opcao.valor_min !== null ? String(opcao.valor_min) : "",
      referencia_max: opcao.valor_max !== null ? String(opcao.valor_max) : "",
    }));
    setReferenciaEditada(false);
    setOrigemSugestao(opcao.origem);
  }

  function handleSelecionarCatalogo(entry: MarkerCatalogEntry) {
    setForm((f) => ({ ...f, nome_marcador: entry.nome_marcador }));
    setListaAberta(false);
    buscarFaixaPara(entry.nome_marcador);
  }

  const { highlightedIndex, setHighlightedIndex, onKeyDown } = useComboboxKeyboardNav(
    sugestoes,
    listaAberta,
    handleSelecionarCatalogo,
    () => setListaAberta(false)
  );
  const highlightedNome = sugestoes[highlightedIndex]?.nome_marcador;

  function optionId(nomeMarcador: string) {
    return `${listboxId}-option-${nomeMarcador}`;
  }

  function handleEscolherSexo(valor: "M" | "F") {
    setSexoEscolhido(valor);
    const opcao = opcoesSexo.find((o) => o.sexo === valor);
    if (opcao) aplicarOpcao(opcao);
  }

  function handleReferenciaChange(campo: "referencia_min" | "referencia_max", valor: string) {
    setForm((f) => ({ ...f, [campo]: valor }));
    setReferenciaEditada(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.nome_marcador.trim() || !form.valor || !form.unidade.trim()) {
      toast.error("Preencha o marcador, o valor e a unidade.");
      return;
    }

    startTransition(async () => {
      const result = await addLabMarker(patientId, examId, {
        nome_marcador: form.nome_marcador.trim(),
        valor: Number(form.valor),
        unidade: form.unidade.trim(),
        referencia_min: form.referencia_min === "" ? undefined : Number(form.referencia_min),
        referencia_max: form.referencia_max === "" ? undefined : Number(form.referencia_max),
        referencia_editada: referenciaEditada,
      });

      if (!result.success) {
        toast.error("Não foi possível registrar o marcador", { description: result.message });
        return;
      }

      toast.success(result.message ?? "Marcador registrado.");
      setForm(EMPTY);
      setReferenciaEditada(false);
      setOpcoesSexo([]);
      setSexoEscolhido("");
      setOrigemSugestao(null);
    });
  }

  function handleSalvarFaixaPadrao() {
    const sexoParaSalvar = sexoEscolhido || opcoesSexo[0]?.sexo;
    if (!form.nome_marcador.trim() || !form.unidade.trim()) {
      toast.error("Preencha o marcador e a unidade antes de salvar como padrão.");
      return;
    }
    if (opcoesSexo.length > 0 && !sexoParaSalvar) {
      toast.error("Escolha se essa faixa é para masculino ou feminino antes de salvar como padrão.");
      return;
    }

    startTransition(async () => {
      const result = await saveMyReferenceRange({
        nome_marcador: form.nome_marcador.trim(),
        unidade: form.unidade.trim(),
        sexo: (sexoParaSalvar as "M" | "F") ?? "ambos",
        valor_min: form.referencia_min === "" ? null : Number(form.referencia_min),
        valor_max: form.referencia_max === "" ? null : Number(form.referencia_max),
      });

      if (!result.success) {
        toast.error("Não foi possível salvar a faixa", { description: result.message });
        return;
      }
      toast.success(result.message ?? "Faixa salva.");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-md border border-dashed border-border p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div ref={containerRef} className="relative space-y-1 sm:col-span-2">
          <Label className="text-xs">Marcador *</Label>
          <Input
            value={form.nome_marcador}
            onChange={(e) => {
              setForm((f) => ({ ...f, nome_marcador: e.target.value }));
              setListaAberta(true);
            }}
            onFocus={() => setListaAberta(true)}
            onBlur={() => {
              // Pequeno atraso pra um clique na lista registrar antes do blur fechar tudo.
              setTimeout(() => setListaAberta(false), 150);
              buscarFaixaPara(form.nome_marcador);
            }}
            onKeyDown={onKeyDown}
            placeholder="Buscar ou digitar um marcador..."
            disabled={isPending}
            aria-required="true"
            role="combobox"
            aria-expanded={listaAberta}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={listaAberta && highlightedNome ? optionId(highlightedNome) : undefined}
          />

          {listaAberta && (
            <div
              id={listboxId}
              role="listbox"
              className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-md"
            >
              {sugestoes.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  Nenhum marcador do catálogo encontrado — pode digitar um nome livre.
                </p>
              ) : (
                sugestoes.map((entry) => (
                  <button
                    key={entry.nome_marcador}
                    id={optionId(entry.nome_marcador)}
                    role="option"
                    aria-selected={entry.nome_marcador === highlightedNome}
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelecionarCatalogo(entry)}
                    onMouseEnter={() => setHighlightedIndex(sugestoes.findIndex((s) => s.nome_marcador === entry.nome_marcador))}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
                      entry.nome_marcador === highlightedNome && "bg-muted"
                    )}
                  >
                    <span className="truncate">{entry.nome_marcador}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{entry.unidade}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Valor *</Label>
          <Input
            type="number"
            step="any"
            value={form.valor}
            onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
            disabled={isPending}
            aria-required="true"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Unidade *</Label>
          <Input
            value={form.unidade}
            onChange={(e) => setForm((f) => ({ ...f, unidade: e.target.value }))}
            placeholder="mg/dL"
            disabled={isPending}
            aria-required="true"
          />
        </div>
      </div>

      {buscandoFaixa && <p className="text-xs text-muted-foreground">Buscando faixa de referência...</p>}

      {opcoesSexo.length > 0 && (
        <div className="space-y-1 rounded-md border border-accent/40 bg-accent/10 p-2 max-w-[220px]">
          <Label className="text-xs">
            Sexo do paciente não está cadastrado (ou é &quot;outro&quot;) — faixa de referência é para:
          </Label>
          <Select value={sexoEscolhido} onValueChange={(v) => handleEscolherSexo(v as "M" | "F")}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {opcoesSexo.map((o) => (
                <SelectItem key={o.sexo} value={o.sexo}>
                  {o.sexo === "M" ? "Masculino" : "Feminino"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:max-w-xs">
        <div className="space-y-1">
          <Label className="text-xs">Referência mín.</Label>
          <Input
            type="number"
            step="any"
            value={form.referencia_min}
            onChange={(e) => handleReferenciaChange("referencia_min", e.target.value)}
            disabled={isPending}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Referência máx.</Label>
          <Input
            type="number"
            step="any"
            value={form.referencia_max}
            onChange={(e) => handleReferenciaChange("referencia_max", e.target.value)}
            disabled={isPending}
          />
        </div>
      </div>

      {origemSugestao && !referenciaEditada && (
        <p className="text-xs text-muted-foreground">
          Faixa sugerida: {origemSugestao === "personalizada" ? "sua faixa personalizada" : "catálogo padrão do sistema"}.
        </p>
      )}
      {referenciaEditada && (form.referencia_min || form.referencia_max) && (
        <p className="text-xs text-muted-foreground">Faixa ajustada manualmente para este resultado.</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Adicionar marcador
        </Button>
        {(form.referencia_min || form.referencia_max) && (
          <Button type="button" size="sm" variant="outline" onClick={handleSalvarFaixaPadrao} disabled={isPending}>
            <Save className="h-4 w-4" />
            Salvar como minha faixa padrão
          </Button>
        )}
      </div>
    </form>
  );
}
