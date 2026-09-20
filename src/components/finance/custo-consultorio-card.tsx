"use client";

import { useMemo, useState } from "react";
import { Info } from "lucide-react";

import { costPerAppointment, formatCurrencyBRL, type CategoryBreakdownItem } from "@/lib/finance";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface CustoConsultorioCardProps {
  custoMensal: number;
  breakdown: CategoryBreakdownItem[];
  sugestaoAtendimentos: number;
}

export function CustoConsultorioCard({ custoMensal, breakdown, sugestaoAtendimentos }: CustoConsultorioCardProps) {
  const [atendimentos, setAtendimentos] = useState(sugestaoAtendimentos);

  const custoPorAtendimento = useMemo(
    () => costPerAppointment(custoMensal, atendimentos),
    [custoMensal, atendimentos]
  );

  const maiorCategoria = breakdown[0]?.custoMensal ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Custo do consultório</CardTitle>
        <CardDescription>
          Quanto o consultório custa por mês, e quanto disso cabe a cada atendimento.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Custo fixo mensal
          </p>
          <p className="mt-1 text-3xl font-semibold text-foreground">{formatCurrencyBRL(custoMensal)}</p>
        </div>

        {breakdown.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Por categoria
            </p>
            <div className="space-y-2">
              {breakdown.map((item) => (
                <div key={item.categoria} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{item.categoria}</span>
                    <span className="text-muted-foreground">{formatCurrencyBRL(item.custoMensal)}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary-500"
                      style={{
                        width: maiorCategoria > 0 ? `${(item.custoMensal / maiorCategoria) * 100}%` : "0%",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2 border-t border-border pt-4">
          <Label htmlFor="atendimentos_por_mes">Atendimentos por mês</Label>
          <Input
            id="atendimentos_por_mes"
            type="number"
            min="0"
            step="1"
            value={atendimentos}
            onChange={(e) => setAtendimentos(Math.max(0, Number(e.target.value) || 0))}
            className="max-w-[140px]"
          />
          <p className="text-xs text-muted-foreground">
            Sugestão: {sugestaoAtendimentos} atendimento{sugestaoAtendimentos === 1 ? "" : "s"}/mês (média
            de consultas realizadas nos últimos 3 meses). Altere para simular outro cenário.
          </p>
        </div>

        <div className="rounded-lg bg-muted/40 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Custo por atendimento
          </p>
          <p className="mt-1 text-3xl font-semibold text-foreground">{formatCurrencyBRL(custoPorAtendimento)}</p>
        </div>

        <div className="flex gap-2 rounded-md border border-accent/40 bg-accent/10 p-3 text-xs text-foreground">
          <Info className="h-4 w-4 shrink-0 text-accent-foreground" />
          <p>
            Este é o valor que cada atendimento precisa cobrir só para os custos fixos se pagarem — não
            inclui o quanto você quer ganhar, impostos ou custos variáveis. Não é o preço da consulta:
            cobrar exatamente esse valor é trabalhar de graça.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
