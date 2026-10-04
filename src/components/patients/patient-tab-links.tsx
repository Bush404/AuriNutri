import Link from "next/link";

import { cn } from "@/lib/utils";

/** Abas da ficha do paciente, na ordem em que aparecem (o valor vai na URL: ?aba=planos). */
export const ABAS_PACIENTE = [
  { valor: "informacoes", rotulo: "Informações gerais" },
  { valor: "anamnese", rotulo: "Anamnese" },
  { valor: "avaliacoes", rotulo: "Antropometria Geral" },
  { valor: "calculo-energetico", rotulo: "Cálculo energético" },
  { valor: "evolucao-fotografica", rotulo: "Evolução Fotográfica" },
  { valor: "planos", rotulo: "Planos alimentares" },
  { valor: "exames", rotulo: "Exames" },
  { valor: "financeiro", rotulo: "Financeiro" },
  { valor: "consentimentos", rotulo: "Consentimentos" },
] as const;

export type AbaPaciente = (typeof ABAS_PACIENTE)[number]["valor"];

/** Faixa branca com sublinhado na aba aberta; no celular rola para o lado. */
export const ABAS_FAIXA_CLASSE =
  "flex h-auto w-full justify-start gap-0 overflow-x-auto rounded-xl border bg-card px-2 py-0 shadow-sm";

export const ABA_CLASSE =
  "inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none";

/**
 * A mesma faixa de abas, em links, para as páginas que ficam "dentro" de uma
 * aba (ex.: um plano alimentar fica em "Planos alimentares").
 */
export function PatientTabLinks({ patientId, ativa }: { patientId: string; ativa: AbaPaciente }) {
  return (
    <nav aria-label="Ficha do paciente" className={ABAS_FAIXA_CLASSE}>
      {ABAS_PACIENTE.map((aba) => (
        <Link
          key={aba.valor}
          href={`/pacientes/${patientId}?aba=${aba.valor}`}
          aria-current={aba.valor === ativa ? "page" : undefined}
          data-state={aba.valor === ativa ? "active" : "inactive"}
          className={cn(ABA_CLASSE)}
        >
          {aba.rotulo}
        </Link>
      ))}
    </nav>
  );
}
