import type { LucideIcon } from "lucide-react";

import { formatCurrencyBRL } from "@/lib/finance";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";

export interface PatientAmount {
  nome: string;
  total: number;
}

interface PatientAmountsCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  emptyMessage: string;
  itens: PatientAmount[];
}

/** Painel só de leitura — lista nome do paciente + valor, sem nenhuma ação. Ordenado do maior valor para o menor. */
export function PatientAmountsCard({ icon, title, description, emptyMessage, itens }: PatientAmountsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {itens.length === 0 ? (
          <EmptyState icon={icon} title={emptyMessage} />
        ) : (
          // Altura fixa (~2 nomes visíveis) com rolagem própria — evita que a lista
          // empurre o resto da página quando tiver muitos pacientes.
          <div className="max-h-[104px] divide-y divide-border overflow-y-auto">
            {itens.map((item) => (
              <div key={item.nome} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                <span className="text-sm text-foreground">{item.nome}</span>
                <span className="text-sm font-medium text-foreground">{formatCurrencyBRL(item.total)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
