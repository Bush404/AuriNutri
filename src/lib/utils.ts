import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Os tamanhos de texto do design system (text-h1, text-h2, text-h3, text-overline, em
// tailwind.config.ts) precisam ser conhecidos aqui: sem isso o tailwind-merge acha que
// "text-h1" é uma cor e o descarta ao lado de "text-foreground".
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["h1", "h2", "h3", "overline"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formata uma data ISO (yyyy-mm-dd) para o formato brasileiro dd/mm/aaaa. */
export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString("pt-BR");
}

/** Formata um timestamp ISO completo (ex.: created_at) para dd/mm/aaaa às HH:mm. */
export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return `${date.toLocaleDateString("pt-BR")} às ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

/** Calcula a idade em anos a partir de uma data de nascimento (yyyy-mm-dd). */
export function calculateAge(birthDate: string | null | undefined) {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(`${birthDate}T00:00:00`);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/** Retorna as iniciais de um nome, para uso em avatares. */
export function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Formata um telefone brasileiro só para exibição: "(11) 99899-7906" / "(11) 3456-7890".
 * Aceita com ou sem DDI 55. Qualquer outro formato volta como foi digitado.
 */
export function formatTelefone(telefone: string) {
  let digitos = telefone.replace(/\D/g, "");
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) {
    digitos = digitos.slice(2);
  }
  if (digitos.length === 11) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
  if (digitos.length === 10) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  return telefone;
}

/** Classifica o IMC segundo as faixas padrão da OMS (uso informativo). */
export function classifyBMI(imc: number) {
  if (imc < 18.5) return { label: "Abaixo do peso", tone: "warning" as const };
  if (imc < 25) return { label: "Peso adequado", tone: "success" as const };
  if (imc < 30) return { label: "Sobrepeso", tone: "warning" as const };
  if (imc < 35) return { label: "Obesidade grau I", tone: "destructive" as const };
  if (imc < 40) return { label: "Obesidade grau II", tone: "destructive" as const };
  return { label: "Obesidade grau III", tone: "destructive" as const };
}
