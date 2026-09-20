"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { formatCurrencyBRL } from "@/lib/finance";

interface CurrencyInputProps {
  id?: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/** Converte "1500" ou "1500,9" (o que o usuário digitou) para número — vírgula como separador decimal. */
function parseTypedValue(raw: string): number | undefined {
  if (!raw) return undefined;
  const normalized = raw.replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Campo de valor em reais: enquanto o usuário digita, aceita só dígitos e uma
 * vírgula decimal — sem exigir ponto de milhar nem "R$" (ex.: digita "1500").
 * Ao sair do campo, formata para o padrão pt-BR completo (ex.: "R$ 1.500,00")
 * via formatCurrencyBRL. Evita mascarar cada tecla digitada (abordagem
 * frágil quando o texto formatado tem sufixo/prefixo) — formata só ao perder
 * o foco, e volta a mostrar o número cru ao focar de novo para edição fácil.
 */
export function CurrencyInput({ id, value, onChange, onBlur, placeholder, disabled, className }: CurrencyInputProps) {
  const [editing, setEditing] = useState(false);
  const [rawText, setRawText] = useState("");

  const displayValue = editing
    ? rawText
    : value !== undefined && value !== null && !Number.isNaN(value)
      ? formatCurrencyBRL(value)
      : "";

  return (
    <Input
      id={id}
      inputMode="decimal"
      placeholder={placeholder ?? "R$ 0,00"}
      disabled={disabled}
      className={className}
      value={displayValue}
      onFocus={() => {
        setRawText(value !== undefined && value !== null && !Number.isNaN(value) ? String(value).replace(".", ",") : "");
        setEditing(true);
      }}
      onChange={(e) => {
        // Só dígitos e uma vírgula — descarta qualquer outro caractere colado/digitado.
        const cleaned = e.target.value.replace(/[^\d,]/g, "");
        const firstComma = cleaned.indexOf(",");
        const safe =
          firstComma === -1
            ? cleaned
            : cleaned.slice(0, firstComma + 1) + cleaned.slice(firstComma + 1).replace(/,/g, "");
        setRawText(safe);
        onChange(parseTypedValue(safe));
      }}
      onBlur={() => {
        setEditing(false);
        onBlur?.();
      }}
    />
  );
}
