import { AlertCircle, Check, Loader2 } from "lucide-react";

import type { EstadoSalvamento } from "@/lib/hooks/use-auto-save";

/** Linha discreta que diz se o que foi digitado já está gravado (salvamento automático). */
export function AutoSaveStatus({ estado, erro }: { estado: EstadoSalvamento; erro: string | null }) {
  return (
    <p role="status" aria-live="polite" className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
      {estado === "salvo" && (
        <>
          <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          Tudo salvo automaticamente
        </>
      )}
      {(estado === "pendente" || estado === "salvando") && (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          Salvando…
        </>
      )}
      {estado === "erro" && (
        <span className="flex items-center gap-1.5 text-destructive">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
          Não salvo: {erro}
        </span>
      )}
    </p>
  );
}
