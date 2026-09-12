"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function FoodFilters({ categorias }: { categorias: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [busca, setBusca] = useState(searchParams.get("busca") ?? "");
  const [, startTransition] = useTransition();

  const categoriaAtual = searchParams.get("categoria") ?? "todas";
  const ordenarAtual = searchParams.get("ordenar") ?? "nome";

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === "todos" || value === "todas") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    params.delete("pagina");
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  function handleBuscaChange(value: string) {
    setBusca(value);
    updateParams({ busca: value });
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => handleBuscaChange(e.target.value)}
          placeholder="Buscar alimento..."
          className="pl-9"
        />
      </div>

      <Select value={categoriaAtual} onValueChange={(value) => updateParams({ categoria: value })}>
        <SelectTrigger className="w-full sm:w-52">
          <SelectValue placeholder="Categoria" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas as categorias</SelectItem>
          {categorias.map((cat) => (
            <SelectItem key={cat} value={cat}>
              {cat}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={ordenarAtual} onValueChange={(value) => updateParams({ ordenar: value })}>
        <SelectTrigger className="w-full sm:w-48">
          <SelectValue placeholder="Ordenar por" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="nome">Nome (A-Z)</SelectItem>
          <SelectItem value="calorias">Calorias</SelectItem>
          <SelectItem value="proteinas">Proteínas</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
