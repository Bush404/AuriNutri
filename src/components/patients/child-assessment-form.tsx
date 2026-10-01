"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { SexoParaFormula } from "@/lib/anthropometry";
import { sexoDasFormulas } from "@/lib/anthropometry-results";
import {
  calcularResultadosCrianca,
  formatarIdadeMeses,
  gorduraInfantil,
  idadeEmMeses,
  INDICADOR_LABELS,
  MESES_MAXIMO_INFANTIL,
  type IndicadorCrescimento,
} from "@/lib/growth/growth";
import { assessmentSchema, type AssessmentInput } from "@/lib/validations/assessment";
import { updateAssessment } from "@/lib/actions/clinical";
import { useAutoSave } from "@/lib/hooks/use-auto-save";
import { useUnsavedChangesWarning } from "@/lib/hooks/use-unsaved-changes-warning";
import type { AnthropometricAssessment, Patient } from "@/lib/types/database.types";

import { AutoSaveStatus } from "@/components/patients/auto-save-status";
import { GrowthChart, janelaDoGrafico, type PontoCrescimento } from "@/components/patients/growth-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Campo = "peso_kg" | "altura_cm" | "dobra_triceps_mm" | "dobra_subescapular_mm" | "dobra_panturrilha_mm";

type FormValues = Record<Campo, string> & {
  tipo: "crianca";
  data_avaliacao: string;
  sexo_referencia: SexoParaFormula | "";
  observacoes: string;
};

export type AvaliacaoInfantilResumo = Pick<AnthropometricAssessment, "id" | "data_avaliacao" | "peso_kg" | "altura_cm">;

const texto = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

function n(v: string | undefined): number | null {
  if (v === undefined || v.trim() === "") return null;
  const x = Number(v.replace(",", "."));
  return Number.isFinite(x) && x > 0 ? x : null;
}

const fmt = (v: number, casas = 1) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

interface ChildAssessmentFormProps {
  patient: Pick<Patient, "id" | "nome" | "sexo" | "data_nascimento">;
  /** Já existe no banco: "Nova avaliação" cria o registro ao abrir (iniciarAvaliacao). */
  assessment: AnthropometricAssessment;
  /** Outras avaliações infantis do paciente — viram pontos nas curvas. */
  historico: AvaliacaoInfantilResumo[];
}

export function ChildAssessmentForm({ patient, assessment, historico }: ChildAssessmentFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(assessmentSchema) as unknown as Resolver<FormValues>,
    defaultValues: {
      tipo: "crianca",
      data_avaliacao: assessment.data_avaliacao,
      peso_kg: texto(assessment.peso_kg),
      altura_cm: texto(assessment.altura_cm),
      dobra_triceps_mm: texto(assessment.dobra_triceps_mm),
      dobra_subescapular_mm: texto(assessment.dobra_subescapular_mm),
      dobra_panturrilha_mm: texto(assessment.dobra_panturrilha_mm),
      sexo_referencia: assessment.sexo_referencia ?? "",
      observacoes: assessment.observacoes ?? "",
    },
  });
  const v = useWatch({ control }) as FormValues;

  // Salva sozinho a cada alteração; campo inválido fica destacado e não é enviado.
  const { estado, erro: erroSalvamento, salvarAgora } = useAutoSave(v, async (valores) => {
    if (!(await trigger())) return { success: false, message: "Corrija os campos destacados para salvar." };
    return updateAssessment(assessment.id, patient.id, valores as unknown as AssessmentInput);
  });
  useUnsavedChangesWarning(estado !== "salvo" && !loading);
  const precisaEscolherBase = patient.sexo !== "masculino" && patient.sexo !== "feminino";
  const sexo = sexoDasFormulas(patient.sexo, v.sexo_referencia || null);
  const meses = idadeEmMeses(patient.data_nascimento, v.data_avaliacao);
  const foraDaIdade = meses !== null && meses > MESES_MAXIMO_INFANTIL;
  const peso = n(v.peso_kg);
  const altura = n(v.altura_cm);

  const r = sexo && meses !== null && !foraDaIdade ? calcularResultadosCrianca({ sexo, meses, pesoKg: peso, alturaCm: altura }) : null;
  const gordura =
    sexo && meses !== null
      ? gorduraInfantil({
          sexo,
          idadeAnos: Math.floor(meses / 12),
          tricepsMm: n(v.dobra_triceps_mm),
          subescapularMm: n(v.dobra_subescapular_mm),
          panturrilhaMm: n(v.dobra_panturrilha_mm),
        })
      : null;

  function pontos(indicador: IndicadorCrescimento): PontoCrescimento[] {
    const lista: PontoCrescimento[] = [];
    for (const h of historico) {
      if (h.id === assessment.id || h.peso_kg === null || h.altura_cm === null) continue;
      const m = idadeEmMeses(patient.data_nascimento, h.data_avaliacao);
      if (m === null) continue;
      const imc = h.peso_kg / (h.altura_cm / 100) ** 2;
      const porIdade = { peso_idade: h.peso_kg, altura_idade: h.altura_cm, imc_idade: imc }[indicador as string];
      if (porIdade !== undefined) lista.push({ x: m, valor: porIdade, data: h.data_avaliacao });
      else lista.push({ x: h.altura_cm, valor: h.peso_kg, data: h.data_avaliacao });
    }
    const atual = r?.indicadores.find((i) => i.indicador === indicador);
    if (atual) lista.push({ x: atual.x, valor: atual.valor, data: v.data_avaliacao, atual: true });
    return lista;
  }

  async function onSubmit() {
    setLoading(true);
    const falha = await salvarAgora();
    if (falha) {
      setLoading(false);
      toast.error("Não foi possível salvar a avaliação", { description: falha });
      return;
    }
    router.push(`/pacientes/${patient.id}?aba=avaliacoes`);
  }

  const campo = (name: Campo, label: string, required = false) => {
    const erro = errors[name]?.message as string | undefined;
    return (
      <div key={name} className="space-y-1.5">
        <Label htmlFor={name} className="text-xs">
          {label}
          {required && " *"}
        </Label>
        <Input id={name} inputMode="decimal" aria-required={required || undefined} aria-invalid={erro ? true : undefined} {...register(name)} />
        {erro && (
          <p className="text-xs text-destructive" role="alert">
            {erro}
          </p>
        )}
      </div>
    );
  };

  const deitado = meses !== null && meses < 24;
  const graficos: IndicadorCrescimento[] = r
    ? r.indicadores.map((i) => i.indicador)
    : [];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-base">Dados antropométricos</CardTitle>
            <CardDescription>
              {meses !== null ? `Idade na avaliação: ${formatarIdadeMeses(meses)} (${Math.floor(meses)} meses).` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {meses === null && (
              <p role="alert" className="rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-sm">
                Cadastre a data de nascimento do paciente — a idade exata é a base das curvas da OMS.
              </p>
            )}
            {foraDaIdade && (
              <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
                O paciente tem {formatarIdadeMeses(meses!)} nesta data. Pela recomendação da OMS, o protocolo infantil vai até
                19 anos (228 meses) — use a avaliação de adultos.
              </p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="data_avaliacao" className="text-xs">
                  Data da avaliação *
                </Label>
                <Input id="data_avaliacao" type="date" aria-required="true" {...register("data_avaliacao")} />
              </div>
              {campo("peso_kg", "Peso (kg)", true)}
              {campo("altura_cm", deitado ? "Comprimento (cm)" : "Altura (cm)", true)}
            </div>
            {deitado && (
              <p className="text-xs text-muted-foreground">Abaixo de 2 anos a OMS usa o comprimento, com a criança deitada.</p>
            )}

            {precisaEscolherBase && (
              <div className="space-y-2 rounded-md border border-accent/40 bg-accent/10 p-3">
                <p className="text-sm">
                  {patient.sexo === "outro"
                    ? 'O paciente está cadastrado como "outro". As curvas da OMS existem só para meninos e meninas — escolha qual usar nesta avaliação.'
                    : "O sexo do paciente não está cadastrado. Escolha qual curva da OMS usar nesta avaliação."}
                </p>
                <div className="max-w-[200px] space-y-1">
                  <Label className="text-xs">Base para as curvas</Label>
                  <Select
                    value={v.sexo_referencia}
                    onValueChange={(x) => setValue("sexo_referencia", x as SexoParaFormula, { shouldDirty: true })}
                  >
                    <SelectTrigger aria-label="Base para as curvas">
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

            <p className="pt-2 text-sm font-medium">Dobras cutâneas (mm)</p>
            <div className="grid grid-cols-2 gap-4">
              {campo("dobra_triceps_mm", "Tricipital")}
              {campo("dobra_subescapular_mm", "Subescapular")}
              {campo("dobra_panturrilha_mm", "Panturrilha")}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="observacoes" className="text-xs">
                Observações
              </Label>
              <Textarea id="observacoes" rows={3} {...register("observacoes")} />
            </div>

            <div className="space-y-2">
              <AutoSaveStatus estado={estado} erro={erroSalvamento} />
              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar e voltar
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="min-w-0">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resultados</CardTitle>
              <CardDescription>Curvas da OMS; classificação do SISVAN.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!sexo && <p className="text-sm text-muted-foreground">Escolha a base para as curvas.</p>}
              {r?.imc && (
                <Linha label="IMC" valor={`${fmt(r.imc, 2)} kg/m²`} />
              )}
              {r?.indicadores.map((i) => (
                <div key={i.indicador} className="space-y-1 rounded-md bg-muted/50 px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-muted-foreground">{INDICADOR_LABELS[i.indicador]}</span>
                    <Badge variant={i.classificacao.tom} className="whitespace-normal text-left">
                      {i.classificacao.label}
                    </Badge>
                  </div>
                  <p className="font-medium">
                    escore-z {i.z >= 0 ? "+" : ""}
                    {fmt(i.z, 2)} · percentil {fmt(i.percentil, 1)}
                  </p>
                </div>
              ))}
              {r?.foraDaFaixa.map((f) => (
                <p key={f.indicador} className="px-1 text-xs text-muted-foreground">
                  {INDICADOR_LABELS[f.indicador]}: {f.motivo}
                </p>
              ))}
              {gordura && !gordura.ok && (
                <p className="rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-xs">{gordura.motivo}</p>
              )}
              {gordura?.ok && (
                <div className="space-y-1 rounded-md bg-muted/50 px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-muted-foreground">% de gordura ({gordura.fonte})</span>
                    <Badge variant={gordura.classificacao.tom}>{gordura.classificacao.label}</Badge>
                  </div>
                  <p className="font-medium">
                    {fmt(gordura.percentualGordura)}% · {gordura.dobras} · classificação {gordura.classificacao.fonte}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {sexo && meses !== null && graficos.length > 0 && (
        <div className="grid gap-6 xl:grid-cols-2">
          {graficos.map((indicador) => {
            const atual = r!.indicadores.find((i) => i.indicador === indicador)!;
            return (
              <Card key={indicador} className="min-w-0">
                <CardHeader>
                  <CardTitle className="text-base">{INDICADOR_LABELS[indicador]}</CardTitle>
                </CardHeader>
                <CardContent>
                  <GrowthChart
                    indicador={indicador}
                    sexo={sexo}
                    pontos={pontos(indicador)}
                    janela={janelaDoGrafico(indicador, sexo, atual.x)}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </form>
  );
}

function Linha({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-muted/50 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{valor}</span>
    </div>
  );
}
