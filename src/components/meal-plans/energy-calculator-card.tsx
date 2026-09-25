"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Zap } from "lucide-react";
import { toast } from "sonner";

import {
  calcularGET,
  calcularTMB,
  ATIVIDADE_LABELS,
  FORMULA_LABELS,
  type FormulaTMB,
  type NivelAtividade,
  type SexoParaFormula,
} from "@/lib/energy";
import { setMealPlanCalorieGoal } from "@/lib/actions/meal-plans";
import type { Sexo } from "@/lib/types/database.types";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EnergyCalculatorCardProps {
  planId: string;
  patientId: string;
  sexo: Sexo | null;
  idade: number | null;
  pesoKg: number | null;
  alturaCm: number | null;
}

export function EnergyCalculatorCard({ planId, patientId, sexo, idade, pesoKg, alturaCm }: EnergyCalculatorCardProps) {
  const [formula, setFormula] = useState<FormulaTMB>("mifflin_st_jeor");
  const [nivelAtividade, setNivelAtividade] = useState<NivelAtividade>("sedentario");
  const [baseEscolhida, setBaseEscolhida] = useState<SexoParaFormula | "">("");
  const [modoManual, setModoManual] = useState(false);
  const [getManual, setGetManual] = useState("");
  const [saving, setSaving] = useState(false);

  const precisaEscolherBase = sexo === "outro" || sexo === null;
  const sexoParaFormula: SexoParaFormula | null = precisaEscolherBase ? baseEscolhida || null : (sexo as SexoParaFormula);

  const faltaAntropometria = pesoKg === null || alturaCm === null;
  const faltaIdade = idade === null;

  const resultado = useMemo(() => {
    if (modoManual || faltaAntropometria || faltaIdade || !sexoParaFormula) return null;
    const tmb = calcularTMB({ pesoKg: pesoKg as number, alturaCm: alturaCm as number, idade: idade as number, sexo: sexoParaFormula, formula });
    const get = calcularGET(tmb, nivelAtividade);
    return { tmb, get };
  }, [modoManual, faltaAntropometria, faltaIdade, sexoParaFormula, pesoKg, alturaCm, idade, formula, nivelAtividade]);

  const getFinal = modoManual ? Number(getManual) || null : resultado?.get ?? null;

  async function handleUsarComoMeta() {
    if (!getFinal || getFinal <= 0) return;
    setSaving(true);
    const result = await setMealPlanCalorieGoal(planId, Math.round(getFinal));
    setSaving(false);
    if (!result.success) {
      toast.error("Não foi possível salvar a meta", { description: result.message });
      return;
    }
    toast.success("Meta calórica do plano atualizada.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="h-4 w-4" />
          Calculadora de gasto energético
        </CardTitle>
        <CardDescription>
          Estima a Taxa Metabólica Basal (TMB) e o Gasto Energético Total (GET) do paciente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {faltaAntropometria && !modoManual && (
          <p className="text-sm text-muted-foreground">
            Registre peso e altura em uma avaliação antropométrica (aba{" "}
            <Link href={`/pacientes/${patientId}?aba=avaliacoes`} className="underline">
              avaliações do paciente
            </Link>
            ) para calcular automaticamente — ou informe o GET manualmente abaixo.
          </p>
        )}

        {!faltaAntropometria && faltaIdade && !modoManual && (
          <p className="text-sm text-muted-foreground">
            Informe a data de nascimento do paciente no cadastro para calcular a idade usada na fórmula.
          </p>
        )}

        {precisaEscolherBase && !modoManual && (
          <div className="space-y-2 rounded-md border border-accent/40 bg-accent/10 p-3">
            <p className="text-sm text-foreground">
              {sexo === "outro"
                ? 'O paciente está cadastrado como "outro". As fórmulas de TMB só têm coeficientes publicados para masculino e feminino — escolha qual base usar para estimar, ou informe o GET manualmente.'
                : "O sexo do paciente não está cadastrado. Escolha uma base para o cálculo, ou informe o GET manualmente."}
            </p>
            <div className="max-w-[200px] space-y-1">
              <Label className="text-xs">Base para o cálculo</Label>
              <Select value={baseEscolhida} onValueChange={(v) => setBaseEscolhida(v as SexoParaFormula)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="masculino">Masculino</SelectItem>
                  <SelectItem value="feminino">Feminino</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {!modoManual && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Fórmula</Label>
              <Select value={formula} onValueChange={(v) => setFormula(v as FormulaTMB)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FORMULA_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nível de atividade física</Label>
              <Select value={nivelAtividade} onValueChange={(v) => setNivelAtividade(v as NivelAtividade)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ATIVIDADE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {resultado && (
          <div className="grid grid-cols-2 gap-4 rounded-md bg-muted/40 p-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">TMB</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{resultado.tmb.toFixed(0)} kcal</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">GET</p>
              <p className="mt-1 text-lg font-semibold text-primary-700">{resultado.get.toFixed(0)} kcal</p>
            </div>
          </div>
        )}

        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs"
          onClick={() => setModoManual((v) => !v)}
        >
          {modoManual ? "Calcular pela fórmula" : "Inserir GET manualmente"}
        </Button>

        {modoManual && (
          <div className="max-w-[200px] space-y-1">
            <Label htmlFor="get_manual" className="text-xs">
              GET (kcal/dia)
            </Label>
            <Input
              id="get_manual"
              type="number"
              step="1"
              value={getManual}
              onChange={(e) => setGetManual(e.target.value)}
              placeholder="Ex: 2000"
            />
          </div>
        )}

        <div className="flex justify-end">
          <Button size="sm" onClick={handleUsarComoMeta} disabled={!getFinal || getFinal <= 0 || saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Usar como meta calórica do plano
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
