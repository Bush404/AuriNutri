"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Loader2, Search, X } from "lucide-react";

import type { Food } from "@/lib/types/database.types";
import { searchFoodsForPicker, type FontePicker } from "@/lib/actions/foods";
import { useComboboxKeyboardNav } from "@/lib/use-combobox-keyboard";
import { cn } from "@/lib/utils";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FONTE_LABELS } from "@/lib/nutrition";

interface FoodComboboxProps {
  value: Food | null;
  onChange: (food: Food | null) => void;
  disabled?: boolean;
}

const FONTES: { valor: FontePicker; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "taco", rotulo: "TACO" },
  { valor: "usda", rotulo: "USDA" },
  { valor: "meus", rotulo: "Meus alimentos" },
];

function optionId(listboxId: string, foodId: string) {
  return `${listboxId}-option-${foodId}`;
}

/**
 * Campo de busca de alimentos para o construtor de plano alimentar.
 * Busca no servidor (respeitando RLS) e agrupa os resultados em
 * "Meus alimentos" e "Base TACO", conforme a origem de cada alimento.
 *
 * Navegação por teclado (Fase 11, Bloco B): setas cima/baixo percorrem os
 * resultados achatados (os dois grupos juntos, na ordem em que aparecem na
 * tela), Enter seleciona o destacado, Escape fecha sem selecionar. Papel
 * ARIA de combobox completo (aria-expanded/aria-controls/aria-activedescendant)
 * porque isto não usa nenhum primitivo do Radix por baixo.
 */
export function FoodCombobox({ value, onChange, disabled }: FoodComboboxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<{ meus: Food[]; taco: Food[]; usda: Food[] }>({ meus: [], taco: [], usda: [] });
  const [fonte, setFonte] = useState<FontePicker>("todos");
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const listboxId = useId();

  const flatResults = [...results.meus, ...results.taco, ...results.usda];
  const nenhum = flatResults.length === 0;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function runSearch(term: string) {
    startTransition(async () => {
      const data = await searchFoodsForPicker(term, fonte);
      setResults(data);
    });
  }

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open, fonte]);

  function handleFocus() {
    setOpen(true);
    if (nenhum) {
      runSearch(query);
    }
  }

  function handleSelect(food: Food) {
    onChange(food);
    setOpen(false);
    setQuery("");
  }

  const { highlightedIndex, setHighlightedIndex, onKeyDown } = useComboboxKeyboardNav(
    flatResults,
    open,
    handleSelect,
    () => setOpen(false)
  );
  const highlightedFoodId = flatResults[highlightedIndex]?.id;

  if (value) {
    return (
      <div className="flex h-10 items-center justify-between rounded-md border border-input bg-muted/40 px-3 text-sm">
        <span className="flex items-center gap-2 truncate">
          <span className="truncate font-medium text-foreground">{value.nome}</span>
          <Badge variant={value.is_global ? "secondary" : "outline"} className="shrink-0">
            {FONTE_LABELS[value.fonte]}
          </Badge>
        </span>
        {!disabled && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="ml-2 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Trocar alimento"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleFocus}
          onKeyDown={onKeyDown}
          placeholder="Buscar alimentos..."
          aria-label="Alimento"
          aria-required="true"
          className="pl-9"
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={open && highlightedFoodId ? optionId(listboxId, highlightedFoodId) : undefined}
        />
      </div>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-md"
        >
          {isPending && (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Buscando...
            </div>
          )}

          {/* Fonte (Fase 19): as mesmas da janela da refeição. */}
          <div className="flex flex-wrap gap-1.5 border-b border-border px-3 py-2" role="radiogroup" aria-label="Fonte dos alimentos">
            {FONTES.map((f) => (
              <button
                key={f.valor}
                type="button"
                role="radio"
                aria-checked={fonte === f.valor}
                tabIndex={-1}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                  fonte === f.valor
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:border-primary/40",
                )}
                onClick={() => setFonte(f.valor)}
              >
                {f.rotulo}
              </button>
            ))}
          </div>

          {!isPending && nenhum && (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              Nenhum alimento encontrado{query ? ` para "${query}"` : ""}.
            </p>
          )}

          {!isPending && results.meus.length > 0 && (
            <FoodGroup
              label="Meus alimentos"
              foods={results.meus}
              listboxId={listboxId}
              highlightedFoodId={highlightedFoodId}
              onSelect={handleSelect}
              onHover={(foodId) => setHighlightedIndex(flatResults.findIndex((f) => f.id === foodId))}
            />
          )}
          {!isPending && results.taco.length > 0 && (
            <FoodGroup
              label="Base TACO"
              foods={results.taco}
              listboxId={listboxId}
              highlightedFoodId={highlightedFoodId}
              onSelect={handleSelect}
              onHover={(foodId) => setHighlightedIndex(flatResults.findIndex((f) => f.id === foodId))}
            />
          )}
          {!isPending && results.usda.length > 0 && (
            <FoodGroup
              label="USDA"
              foods={results.usda}
              listboxId={listboxId}
              highlightedFoodId={highlightedFoodId}
              onSelect={handleSelect}
              onHover={(foodId) => setHighlightedIndex(flatResults.findIndex((f) => f.id === foodId))}
            />
          )}
        </div>
      )}
    </div>
  );
}

function FoodGroup({
  label,
  foods,
  listboxId,
  highlightedFoodId,
  onSelect,
  onHover,
}: {
  label: string;
  foods: Food[];
  listboxId: string;
  highlightedFoodId: string | undefined;
  onSelect: (food: Food) => void;
  onHover: (foodId: string) => void;
}) {
  return (
    <div className="py-1">
      <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {foods.map((food) => (
        <button
          key={food.id}
          id={optionId(listboxId, food.id)}
          role="option"
          aria-selected={food.id === highlightedFoodId}
          type="button"
          tabIndex={-1}
          onClick={() => onSelect(food)}
          onMouseEnter={() => onHover(food.id)}
          className={cn(
            "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
            food.id === highlightedFoodId && "bg-muted"
          )}
        >
          <span className="truncate">
            {food.nome}
            {food.marca && <span className="text-muted-foreground"> ({food.marca})</span>}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {food.calorias_kcal === null ? "—" : Math.round(Number(food.calorias_kcal)).toLocaleString("pt-BR")} kcal/
            {Number(food.porcao_referencia_g).toLocaleString("pt-BR")} g
          </span>
        </button>
      ))}
    </div>
  );
}
