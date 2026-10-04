"use client";

import { useState } from "react";
import { Apple, ChefHat } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Miniatura de alimento ou receita (Fase 19). A imagem é opcional: sem ela —
 * ou se o endereço falhar —, mostra um ícone sobre o verde-claro do AuriNutri,
 * nunca uma imagem quebrada.
 */
export function FoodThumb({
  imageUrl,
  tipo = "alimento",
  className,
}: {
  imageUrl?: string | null;
  tipo?: "alimento" | "receita";
  className?: string;
}) {
  const [falhou, setFalhou] = useState(false);
  const Icone = tipo === "receita" ? ChefHat : Apple;

  return (
    <span
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-success-soft text-primary",
        className,
      )}
      aria-hidden="true"
    >
      {imageUrl && !falhou ? (
        // eslint-disable-next-line @next/next/no-img-element -- miniatura de endereço livre (Storage/externo), sem otimização do Next.
        <img src={imageUrl} alt="" className="h-full w-full object-cover" onError={() => setFalhou(true)} />
      ) : (
        <Icone className="h-1/2 w-1/2" />
      )}
    </span>
  );
}
