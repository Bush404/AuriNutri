"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Search, X } from "lucide-react";

import type { Recipe } from "@/lib/types/database.types";
import { searchRecipesForPicker } from "@/lib/actions/recipes";
import { cn } from "@/lib/utils";

import { Input } from "@/components/ui/input";

interface RecipeComboboxProps {
  value: Recipe | null;
  onChange: (recipe: Recipe | null) => void;
  disabled?: boolean;
}

/**
 * Campo de busca de receitas para o construtor de plano alimentar — mesmo
 * padrão de FoodCombobox, mas só um grupo (receitas finalizadas do próprio
 * profissional; searchRecipesForPicker já filtra rascunhos).
 */
export function RecipeCombobox({ value, onChange, disabled }: RecipeComboboxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Recipe[]>([]);
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
      const data = await searchRecipesForPicker(term);
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
    if (results.length === 0) {
      runSearch(query);
    }
  }

  function handleSelect(recipe: Recipe) {
    onChange(recipe);
    setOpen(false);
    setQuery("");
  }

  if (value) {
    return (
      <div className="flex h-10 items-center justify-between rounded-md border border-input bg-muted/40 px-3 text-sm">
        <span className="truncate font-medium text-foreground">{value.nome}</span>
        {!disabled && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="ml-2 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Trocar receita"
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
          placeholder="Buscar receita..."
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

          {!isPending && results.length === 0 && (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              Nenhuma receita finalizada encontrada{query ? ` para "${query}"` : ""}.
            </p>
          )}

          {!isPending && results.length > 0 && (
            <div className="py-1">
              {results.map((recipe) => (
                <button
                  key={recipe.id}
                  type="button"
                  onClick={() => handleSelect(recipe)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                  )}
                >
                  <span className="truncate">{recipe.nome}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{recipe.numero_porcoes} porções</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
