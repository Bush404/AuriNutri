"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Search, X } from "lucide-react";

import type { Food } from "@/lib/types/database.types";
import { searchFoodsForPicker } from "@/lib/actions/foods";
import { cn } from "@/lib/utils";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface FoodComboboxProps {
  value: Food | null;
  onChange: (food: Food | null) => void;
  disabled?: boolean;
}

/**
 * Campo de busca de alimentos para o construtor de plano alimentar.
 * Busca no servidor (respeitando RLS) e agrupa os resultados em
 * "Meus alimentos" e "Base TACO", conforme a origem de cada alimento.
 */
export function FoodCombobox({ value, onChange, disabled }: FoodComboboxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<{ meus: Food[]; taco: Food[] }>({ meus: [], taco: [] });
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

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
      const data = await searchFoodsForPicker(term);
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
  }, [query, open]);

  function handleFocus() {
    setOpen(true);
    if (results.meus.length === 0 && results.taco.length === 0) {
      runSearch(query);
    }
  }

  function handleSelect(food: Food) {
    onChange(food);
    setOpen(false);
    setQuery("");
  }

  if (value) {
    return (
      <div className="flex h-10 items-center justify-between rounded-md border border-input bg-muted/40 px-3 text-sm">
        <span className="flex items-center gap-2 truncate">
          <span className="truncate font-medium text-foreground">{value.nome}</span>
          <Badge variant={value.is_global ? "secondary" : "outline"} className="shrink-0">
            {value.is_global ? "TACO" : "Personalizado"}
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
          placeholder="Buscar alimento (TACO ou seus)..."
          className="pl-9"
          disabled={disabled}
        />
      </div>

      {open && (
        <div className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-md">
          {isPending && (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Buscando...
            </div>
          )}

          {!isPending && results.meus.length === 0 && results.taco.length === 0 && (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              Nenhum alimento encontrado{query ? ` para "${query}"` : ""}.
            </p>
          )}

          {!isPending && results.meus.length > 0 && (
            <FoodGroup label="Meus alimentos" foods={results.meus} onSelect={handleSelect} />
          )}
          {!isPending && results.taco.length > 0 && (
            <FoodGroup label="Base TACO" foods={results.taco} onSelect={handleSelect} />
          )}
        </div>
      )}
    </div>
  );
}

function FoodGroup({
  label,
  foods,
  onSelect,
}: {
  label: string;
  foods: Food[];
  onSelect: (food: Food) => void;
}) {
  return (
    <div className="py-1">
      <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {foods.map((food) => (
        <button
          key={food.id}
          type="button"
          onClick={() => onSelect(food)}
          className={cn(
            "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
          )}
        >
          <span className="truncate">
            {food.nome}
            {food.marca && <span className="text-muted-foreground"> ({food.marca})</span>}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {food.calorias_kcal ?? "—"} kcal/{food.porcao_referencia_g}g
          </span>
        </button>
      ))}
    </div>
  );
}
