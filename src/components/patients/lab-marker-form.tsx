"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Info, Loader2, Plus, Save, Search } from "lucide-react";
import { toast } from "sonner";

import {
  getReferenceRangeSuggestion,
  listReferenceMarkerCatalog,
  saveMyReferenceRange,
  type MarkerCatalogEntry,
  type ReferenceRangeOption,
} from "@/lib/actions/lab-markers";
import type { LabMarkerInput } from "@/lib/validations/lab-exam";
import { useComboboxKeyboardNav } from "@/lib/use-combobox-keyboard";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MarkerRangeBar } from "@/components/patients/marker-range-bar";

interface LabMarkerFormProps {
  patientId: string;
  /** "Adicionar marcador" só coloca na lista da janela — quem grava é "Salvar alterações". */
  onAdicionar: (marcador: LabMarkerInput) => void;
  /** Avisa se há algo digitado ainda não adicionado (a janela não deixa salvar/fechar sem perguntar). */
  onConteudoChange?: (temConteudo: boolean) => void;
}

const EMPTY = {
  nome_marcador: "",
  valor: "",
  unidade: "",
  referencia_min: "",
  referencia_max: "",
};

const numero = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));

/**
 * "Adicionar marcador" da janela dos marcadores (Fase 19): busca no catálogo,
 * faixa de referência sugerida (personalizada ou do sistema; pergunta o sexo
 * quando o paciente não tem), pré-visualização da faixa. O marcador vai para
 * a lista da janela; "Salvar como minha faixa padrão" continua gravando na hora
 * (é o catálogo do profissional, não este exame).
 */
export function LabMarkerForm({ patientId, onAdicionar, onConteudoChange }: LabMarkerFormProps) {
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
  const id = useId();

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

  function atualizar(novo: typeof EMPTY) {
    setForm(novo);
    onConteudoChange?.(Boolean(novo.nome_marcador.trim() || novo.valor.trim()));
  }

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
    atualizar({ ...form, nome_marcador: entry.nome_marcador });
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
    e.stopPropagation();

    const valor = numero(form.valor);
    if (!form.nome_marcador.trim() || valor === null || !Number.isFinite(valor) || !form.unidade.trim()) {
      toast.error("Preencha o marcador, o resultado e a unidade.");
      return;
    }
    const min = numero(form.referencia_min);
    const max = numero(form.referencia_max);
    if ((min !== null && !Number.isFinite(min)) || (max !== null && !Number.isFinite(max))) {
      toast.error("Confira a faixa de referência: use só números.");
      return;
    }

    onAdicionar({
      nome_marcador: form.nome_marcador.trim(),
      valor,
      unidade: form.unidade.trim(),
      referencia_min: min ?? undefined,
      referencia_max: max ?? undefined,
      referencia_editada: referenciaEditada,
    });
    atualizar(EMPTY);
    setReferenciaEditada(false);
    setOpcoesSexo([]);
    setSexoEscolhido("");
    setOrigemSugestao(null);
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

  const origemTexto = referenciaEditada
    ? "Faixa ajustada manualmente para este resultado."
    : origemSugestao
      ? `Faixa sugerida: ${origemSugestao === "personalizada" ? "sua faixa personalizada" : "catálogo padrão do sistema"}.`
      : "Escolha um marcador do catálogo para a faixa vir sugerida, ou digite a do laudo.";
  const valorPrevia = numero(form.valor);
  const minPrevia = numero(form.referencia_min);
  const maxPrevia = numero(form.referencia_max);
  const temFaixa = (minPrevia !== null && Number.isFinite(minPrevia)) || (maxPrevia !== null && Number.isFinite(maxPrevia));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div ref={containerRef} className="relative space-y-1.5">
        <Label htmlFor={`${id}-nome`}>Marcador *</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id={`${id}-nome`}
            className="pl-9"
            value={form.nome_marcador}
            onChange={(e) => {
              atualizar({ ...form, nome_marcador: e.target.value });
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
            aria-required="true"
            role="combobox"
            aria-expanded={listaAberta}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={listaAberta && highlightedNome ? optionId(highlightedNome) : undefined}
          />
        </div>

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

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-valor`}>Resultado *</Label>
          <Input
            id={`${id}-valor`}
            inputMode="decimal"
            placeholder="Ex.: 180"
            value={form.valor}
            onChange={(e) => atualizar({ ...form, valor: e.target.value })}
            aria-required="true"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-unidade`}>Unidade *</Label>
          <Input
            id={`${id}-unidade`}
            value={form.unidade}
            onChange={(e) => setForm((f) => ({ ...f, unidade: e.target.value }))}
            placeholder="mg/dL"
            aria-required="true"
          />
        </div>
      </div>

      {buscandoFaixa && <p className="text-xs text-muted-foreground">Buscando faixa de referência...</p>}

      {opcoesSexo.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-accent/40 bg-accent/10 p-3">
          <Label id={`${id}-sexo`} className="text-xs">
            Sexo do paciente não está cadastrado (ou é &quot;outro&quot;) — faixa de referência é para:
          </Label>
          <Select value={sexoEscolhido} onValueChange={(v) => handleEscolherSexo(v as "M" | "F")}>
            <SelectTrigger aria-labelledby={`${id}-sexo`} className="max-w-[200px]">
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

      <fieldset className="space-y-2">
        <legend className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          Faixa de referência
          <span title={origemTexto} className="cursor-help text-muted-foreground">
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">{origemTexto}</span>
          </span>
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-min`} className="text-xs text-muted-foreground">
              Referência mín.
            </Label>
            <Input
              id={`${id}-min`}
              inputMode="decimal"
              placeholder="Ex.: 0"
              value={form.referencia_min}
              onChange={(e) => handleReferenciaChange("referencia_min", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-max`} className="text-xs text-muted-foreground">
              Referência máx.
            </Label>
            <Input
              id={`${id}-max`}
              inputMode="decimal"
              placeholder="Ex.: 190"
              value={form.referencia_max}
              onChange={(e) => handleReferenciaChange("referencia_max", e.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{origemTexto}</p>
      </fieldset>

      {temFaixa && (
        <div className="flex items-center gap-4 rounded-lg border bg-muted/30 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-xs text-muted-foreground">Pré-visualização</p>
            <MarkerRangeBar
              valor={valorPrevia !== null && Number.isFinite(valorPrevia) ? valorPrevia : null}
              min={minPrevia !== null && Number.isFinite(minPrevia) ? minPrevia : null}
              max={maxPrevia !== null && Number.isFinite(maxPrevia) ? maxPrevia : null}
            />
          </div>
          <div className="shrink-0 border-l pl-4">
            <p className="text-xs text-muted-foreground">Valor inserido</p>
            <p className="text-sm font-semibold tabular-nums text-foreground">
              {valorPrevia !== null && Number.isFinite(valorPrevia) ? `${form.valor} ${form.unidade}` : "—"}
            </p>
          </div>
        </div>
      )}

      <Button type="submit" className="w-full">
        <Plus className="h-4 w-4" />
        Adicionar marcador
      </Button>
      {(form.referencia_min || form.referencia_max) && (
        <Button type="button" variant="ghost" size="sm" className="w-full" onClick={handleSalvarFaixaPadrao} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar esta faixa como minha faixa padrão
        </Button>
      )}
    </form>
  );
}
