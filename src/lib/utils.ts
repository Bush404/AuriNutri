import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formata uma data ISO (yyyy-mm-dd) para o formato brasileiro dd/mm/aaaa. */
export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString("pt-BR");
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

/** Classifica o IMC segundo as faixas padrão da OMS (uso informativo). */
export function classifyBMI(imc: number) {
  if (imc < 18.5) return { label: "Abaixo do peso", tone: "warning" as const };
  if (imc < 25) return { label: "Peso adequado", tone: "success" as const };
  if (imc < 30) return { label: "Sobrepeso", tone: "warning" as const };
  if (imc < 35) return { label: "Obesidade grau I", tone: "destructive" as const };
  if (imc < 40) return { label: "Obesidade grau II", tone: "destructive" as const };
  return { label: "Obesidade grau III", tone: "destructive" as const };
}
