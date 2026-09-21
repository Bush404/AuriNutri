"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search } from "lucide-react";

import { LIBRARY_MATERIAL_TIPOS, LIBRARY_MATERIAL_TIPO_LABELS } from "@/lib/validations/library-material";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function LibraryMaterialFilters({ tags }: { tags: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [busca, setBusca] = useState(searchParams.get("busca") ?? "");
  const [, startTransition] = useTransition();

  const tipoAtual = searchParams.get("tipo") ?? "todos";
  const tagAtual = searchParams.get("tag") ?? "todas";

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
          placeholder="Buscar por nome..."
          className="pl-9"
        />
      </div>

      <Select value={tipoAtual} onValueChange={(value) => updateParams({ tipo: value })}>
        <SelectTrigger className="w-full sm:w-52">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os tipos</SelectItem>
          {LIBRARY_MATERIAL_TIPOS.map((tipo) => (
            <SelectItem key={tipo} value={tipo}>
              {LIBRARY_MATERIAL_TIPO_LABELS[tipo]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={tagAtual} onValueChange={(value) => updateParams({ tag: value })}>
        <SelectTrigger className="w-full sm:w-52">
          <SelectValue placeholder="Tag" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas as tags</SelectItem>
          {tags.map((tag) => (
            <SelectItem key={tag} value={tag}>
              {tag}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
