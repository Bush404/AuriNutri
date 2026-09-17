"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Search, X } from "lucide-react";

import type { PatientPickerResult } from "@/lib/actions/patients";
import { searchPatientsForPicker } from "@/lib/actions/patients";
import { Input } from "@/components/ui/input";

interface PatientComboboxProps {
  value: PatientPickerResult | null;
  onChange: (patient: PatientPickerResult | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

/** Campo de busca de pacientes, mesmo padrão do FoodCombobox (busca no servidor, respeitando RLS). */
export function PatientCombobox({ value, onChange, placeholder, disabled }: PatientComboboxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<PatientPickerResult[]>([]);
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
      const data = await searchPatientsForPicker(term);
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
    if (results.length === 0) runSearch(query);
  }

  function handleSelect(patient: PatientPickerResult) {
    onChange(patient);
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
            aria-label="Trocar paciente"
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
          placeholder={placeholder ?? "Buscar paciente..."}
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
              Nenhum paciente encontrado{query ? ` para "${query}"` : ""}.
            </p>
          )}

          {!isPending &&
            results.map((patient) => (
              <button
                key={patient.id}
                type="button"
                onClick={() => handleSelect(patient)}
                className="flex w-full items-center px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <span className="truncate">{patient.nome}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
