"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Download, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { idadeNaData } from "@/lib/anthropometry";
import {
  calcularFormula,
  calcularGETFinal,
  FATORES_ATIVIDADE_FASE16,
  FATORES_INJURIA,
  FORMULAS,
  formulasParaIdade,
  NIVEL_EER_LABELS,
  usaNivelEER,
  type FormulaEnergia,
  type NivelEER,
} from "@/lib/energy-formulas";
import { dadosDoCalculo, kcalAtividade, resultadoDoCalculo, type EntradasCalculo } from "@/lib/energy-calculation";
import { atualizarCalculoEnergetico } from "@/lib/actions/energy-calculations";
import { useAutoSave } from "@/lib/hooks/use-auto-save";
import { useUnsavedChangesWarning } from "@/lib/hooks/use-unsaved-changes-warning";
import { energyCalculationSchema, type EnergyCalculationInput } from "@/lib/validations/energy-calculation";
import type { AnthropometricAssessment, EnergyCalculation, Patient } from "@/lib/types/database.types";
import { cn, formatDate } from "@/lib/utils";

import { AutoSaveStatus } from "@/components/patients/auto-save-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export interface AvaliacaoParaImportar {
  id: string;
  data: string;
  tipo: AnthropometricAssessment["tipo"];
  pesoKg: number | null;
  alturaCm: number | null;
  mlgKg: number | null;
  sexoReferencia: "masculino" | "feminino" | null;
}

type AtividadeForm = { codigo: string; nome: string; met: string; minutos: string };

type FormValues = {
  nome: string;
  data_calculo: string;
  assessment_id: string;
  peso_kg: string;
  altura_cm: string;
  massa_livre_gordura_kg: string;
  sexo_referencia: "masculino" | "feminino" | "";
  formula: FormulaEnergia | "";
  nivel_eer: NivelEER | "";
  kcal_por_kg: string;
  valor_manual_kcal: string;
  fator_atividade: string;
  fator_injuria: string;
  fator_injuria_label: string;
  atividades_met: AtividadeForm[];
  venta_kg: string;
  venta_dias: string;
  adicional_gestante_kcal: string;
  observacoes: string;
};

const texto = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

/** "" ou inválido → null (aceita vírgula decimal). `negativo` libera valores < 0 (meta de perda de peso). */
function n(v: string | undefined, negativo = false): number | null {
  if (v === undefined || v.trim() === "") return null;
  const x = Number(v.replace(",", "."));
  if (!Number.isFinite(x)) return null;
  return negativo ? x : x > 0 ? x : null;
}

const fmt = (v: number, casas = 0) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const kcal = (v: number | null) => (v === null ? "—" : `${fmt(Math.round(v))} kcal/dia`);

/** Fórmulas que não entram na comparação: dependem de um número digitado à mão. */
const SEM_COMPARACAO: FormulaEnergia[] = ["formula_de_bolso", "tmb_manual", "get_manual"];

const INJURIA_OPCOES = FATORES_INJURIA.flatMap((g) => g.itens.map((i) => ({ chave: `${g.grupo} — ${i.label}`, ...i, grupo: g.grupo })));

function buildDefaults(c: EnergyCalculation): FormValues {
  return {
    nome: c.nome ?? "",
    data_calculo: c.data_calculo,
    assessment_id: c.assessment_id ?? "",
    peso_kg: texto(c.peso_kg),
    altura_cm: texto(c.altura_cm),
    massa_livre_gordura_kg: texto(c.massa_livre_gordura_kg),
    sexo_referencia: c.sexo_referencia ?? "",
    formula: (c.formula as FormulaEnergia | null) ?? "",
    nivel_eer: c.nivel_eer ?? "",
    kcal_por_kg: texto(c.kcal_por_kg),
    valor_manual_kcal: texto(c.valor_manual_kcal),
    fator_atividade: String(c.fator_atividade),
    fator_injuria: String(c.fator_injuria),
    fator_injuria_label: c.fator_injuria_label ?? "",
    atividades_met: (c.atividades_met ?? []).map((a) => ({ codigo: a.codigo, nome: a.nome, met: String(a.met), minutos: String(a.minutos) })),
    venta_kg: texto(c.venta_kg),
    venta_dias: texto(c.venta_dias),
    adicional_gestante_kcal: texto(c.adicional_gestante_kcal),
    observacoes: c.observacoes ?? "",
  };
}

interface Props {
  patient: Pick<Patient, "id" | "nome" | "sexo" | "data_nascimento">;
  calculo: EnergyCalculation;
  avaliacoes: AvaliacaoParaImportar[];
}

/**
 * Tela do cálculo energético (Fase 16, a partir do WebDiet): 1. dados
 * antropométricos (com "Importar de antropometria"), 2. fórmula e fatores,
 * 3. ajustes refinados, 4. resultados — e a comparação de todas as fórmulas
 * lado a lado. Salva sozinho, como a antropometria.
 */
export function EnergyCalculationForm({ patient, calculo, avaliacoes }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [importando, setImportando] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(energyCalculationSchema) as unknown as Resolver<FormValues>,
    defaultValues: buildDefaults(calculo),
  });
  const atividades = useFieldArray({ control, name: "atividades_met" });

  const v = useWatch({ control }) as FormValues;

  const { estado, erro: erroSalvamento, salvarAgora } = useAutoSave(v, async (valores) => {
    if (!(await trigger())) return { success: false, message: "Corrija os campos destacados para salvar." };
    return atualizarCalculoEnergetico(calculo.id, patient.id, valores as unknown as EnergyCalculationInput);
  });
  useUnsavedChangesWarning(estado !== "salvo" && !loading);

  const precisaEscolherBase = patient.sexo !== "masculino" && patient.sexo !== "feminino";
  const idade = idadeNaData(patient.data_nascimento, v.data_calculo);
  const formula = v.formula || null;

  const entradas: EntradasCalculo = {
    data_calculo: v.data_calculo,
    peso_kg: n(v.peso_kg),
    altura_cm: n(v.altura_cm),
    massa_livre_gordura_kg: n(v.massa_livre_gordura_kg),
    sexo_referencia: v.sexo_referencia || null,
    formula,
    nivel_eer: v.nivel_eer || null,
    kcal_por_kg: n(v.kcal_por_kg),
    valor_manual_kcal: n(v.valor_manual_kcal),
    fator_atividade: Number(v.fator_atividade) || 1,
    fator_injuria: Number(v.fator_injuria) || 1,
    atividades_met: (v.atividades_met ?? []).map((a) => ({ codigo: a.codigo, nome: a.nome, met: n(a.met) ?? 0, minutos: n(a.minutos) ?? 0 })),
    venta_kg: n(v.venta_kg, true),
    venta_dias: n(v.venta_dias),
    adicional_gestante_kcal: n(v.adicional_gestante_kcal),
  };
  const resultado = resultadoDoCalculo(entradas, patient);
  const dados = dadosDoCalculo(entradas, patient);
  const opcoesFormula = formulasParaIdade(idade ?? ADULTO_PADRAO);
  const eer = formula ? usaNivelEER(formula) : false;
  const fatoresAplicam = formula !== null && !eer && formula !== "get_manual" && formula !== "formula_de_bolso";

  // Comparação: todas as fórmulas que servem para a idade, com os mesmos dados, fatores e ajustes.
  const comparacao =
    "dados" in dados
      ? opcoesFormula
          .filter((f) => !SEM_COMPARACAO.includes(f))
          .map((f) => {
            const r = calcularFormula(f, dados.dados);
            if (!r.ok) return { f, motivo: r.motivo, tmb: null, get: null };
            const final = calcularGETFinal(
              r,
              { atividade: entradas.fator_atividade, injuria: entradas.fator_injuria },
              resultado.adicionais.total
            );
            return { f, motivo: null, tmb: final.tmb, get: final.get };
          })
      : [];

  async function onSubmit() {
    setLoading(true);
    const falha = await salvarAgora();
    if (falha) {
      setLoading(false);
      toast.error("Não foi possível salvar o cálculo", { description: falha });
      return;
    }
    router.push(`/pacientes/${patient.id}?aba=calculo-energetico`);
  }

  function importar(a: AvaliacaoParaImportar) {
    const opcoes = { shouldDirty: true };
    setValue("peso_kg", texto(a.pesoKg), opcoes);
    setValue("altura_cm", texto(a.alturaCm), opcoes);
    setValue("massa_livre_gordura_kg", a.mlgKg ? a.mlgKg.toFixed(1) : "", opcoes);
    setValue("assessment_id", a.id, opcoes);
    if (precisaEscolherBase && a.sexoReferencia && !v.sexo_referencia) setValue("sexo_referencia", a.sexoReferencia, opcoes);
    setImportando(false);
    toast.success(`Dados da avaliação de ${formatDate(a.data)} importados.`);
  }

  const campo = (name: keyof FormValues, label: string, extra: { placeholder?: string; dica?: string } = {}) => {
    const erro = errors[name]?.message as string | undefined;
    return (
      <div key={name} className="space-y-1.5">
        <Label htmlFor={name} className="text-xs">
          {label}
        </Label>
        <Input
          id={name}
          inputMode="decimal"
          placeholder={extra.placeholder}
          aria-invalid={erro ? true : undefined}
          {...register(name)}
        />
        {extra.dica && <p className="text-xs text-muted-foreground">{extra.dica}</p>}
        {erro && (
          <p className="text-xs text-destructive" role="alert">
            {erro}
          </p>
        )}
      </div>
    );
  };

  const info = formula ? FORMULAS[formula] : null;
  const venta = resultado.adicionais.venta;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
      <div className="min-w-0 space-y-6">
        <Secao titulo="Identificação">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="nome" className="text-xs">
                Nome do cálculo
              </Label>
              <Input id="nome" maxLength={80} placeholder="Ex.: Dias de treino" {...register("nome")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="data_calculo" className="text-xs">
                Data do cálculo *
              </Label>
              <Input id="data_calculo" type="date" aria-required="true" {...register("data_calculo")} />
            </div>
          </div>
        </Secao>

        <Secao
          titulo="1. Dados antropométricos"
          acao={
            <Button type="button" variant="outline" size="sm" onClick={() => setImportando(true)}>
              <Download className="h-4 w-4" />
              Importar de antropometria
            </Button>
          }
        >
          <div className="grid grid-cols-2 gap-4">
            {campo("altura_cm", "Altura (cm)")}
            {campo("peso_kg", "Peso (kg)")}
            {campo("massa_livre_gordura_kg", "Massa livre de gordura (kg)", {
              dica: "Usada em Katch-McArdle, Cunningham, Mifflin por MLG e Tinsley por MLG.",
            })}
          </div>
          {patient.data_nascimento === null && (
            <p role="alert" className="rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-sm">
              Cadastre a data de nascimento do paciente: todas as fórmulas usam a idade.
            </p>
          )}
          {precisaEscolherBase && (
            <div className="space-y-2 rounded-md border border-accent/40 bg-accent/10 p-3">
              <p className="text-sm text-foreground">
                {patient.sexo === "outro"
                  ? 'O paciente está cadastrado como "outro". As fórmulas só têm coeficientes publicados para masculino e feminino — escolha qual base usar neste cálculo.'
                  : "O sexo do paciente não está cadastrado. Escolha uma base para as fórmulas deste cálculo."}
              </p>
              <div className="max-w-[200px] space-y-1">
                <Label className="text-xs">Base para as fórmulas</Label>
                <Select
                  value={v.sexo_referencia}
                  onValueChange={(x) => setValue("sexo_referencia", x as "masculino" | "feminino", { shouldDirty: true })}
                >
                  <SelectTrigger aria-label="Base para as fórmulas">
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
        </Secao>

        <Secao titulo="2. Fórmula e fatores">
          <div className="space-y-1.5">
            <Label className="text-xs">Fórmula para cálculo teórico</Label>
            <Select value={v.formula} onValueChange={(x) => setValue("formula", x as FormulaEnergia, { shouldDirty: true })}>
              <SelectTrigger aria-label="Fórmula para cálculo teórico">
                <SelectValue placeholder="Escolha sua fórmula" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>
                    {idade !== null && idade < 18 ? "Protocolos para crianças e adolescentes" : "Protocolos para adultos e idosos"}
                  </SelectLabel>
                  {opcoesFormula
                    .filter((f) => !SEM_COMPARACAO.includes(f))
                    .map((f) => (
                      <SelectItem key={f} value={f}>
                        {FORMULAS[f].label}
                      </SelectItem>
                    ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Outros</SelectLabel>
                  {SEM_COMPARACAO.map((f) => (
                    <SelectItem key={f} value={f}>
                      {FORMULAS[f].label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {info && (
              <details className="rounded-md bg-muted/40 px-3 py-2 text-sm">
                <summary className="cursor-pointer font-medium text-foreground">O que diz a referência</summary>
                <p className="mt-2 text-muted-foreground">Usa: {info.usa}.</p>
                <p className="mt-1 text-muted-foreground">{info.sobre}</p>
                {info.referencia !== "—" && <p className="mt-1 text-xs text-muted-foreground">Fonte: {info.referencia}</p>}
              </details>
            )}
          </div>

          {formula === "formula_de_bolso" && campo("kcal_por_kg", "kcal por kg de peso", { placeholder: "Ex.: 30" })}
          {(formula === "tmb_manual" || formula === "get_manual") &&
            campo("valor_manual_kcal", formula === "tmb_manual" ? "TMB (kcal/dia)" : "GET (kcal/dia)")}

          {eer ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Nível de atividade (EER)</Label>
              <Select value={v.nivel_eer} onValueChange={(x) => setValue("nivel_eer", x as NivelEER, { shouldDirty: true })}>
                <SelectTrigger aria-label="Nível de atividade da EER">
                  <SelectValue placeholder="Escolha o nível" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(NIVEL_EER_LABELS) as NivelEER[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {NIVEL_EER_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                A EER já dá o gasto total: o fator de atividade e o fator injúria não se aplicam. De 0 a 2 anos não usa nível
                de atividade.
              </p>
            </div>
          ) : (
            <div className={cn("grid grid-cols-2 gap-4", !fatoresAplicam && "opacity-60")}>
              <div className="space-y-1.5">
                <Label className="text-xs">Fator atividade física</Label>
                <Select
                  value={v.fator_atividade}
                  disabled={!fatoresAplicam}
                  onValueChange={(x) => setValue("fator_atividade", x, { shouldDirty: true })}
                >
                  <SelectTrigger aria-label="Fator atividade física">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FATORES_ATIVIDADE_FASE16.map((f) => (
                      <SelectItem key={f.valor} value={String(f.valor)}>
                        {fmt(f.valor, 3)} - {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fator injúria</Label>
                <Select
                  value={v.fator_injuria_label || "nenhum"}
                  disabled={!fatoresAplicam}
                  onValueChange={(chave) => {
                    const o = INJURIA_OPCOES.find((i) => i.chave === chave);
                    setValue("fator_injuria_label", o ? o.chave : "", { shouldDirty: true });
                    setValue("fator_injuria", String(o ? o.valor : 1), { shouldDirty: true });
                  }}
                >
                  <SelectTrigger aria-label="Fator injúria">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">1,000 - Não utilizar</SelectItem>
                    {FATORES_INJURIA.map((g) => (
                      <SelectGroup key={g.grupo}>
                        <SelectLabel>{g.grupo}</SelectLabel>
                        {g.itens.map((i) => (
                          <SelectItem key={i.label} value={`${g.grupo} — ${i.label}`}>
                            {fmt(i.valor, 3)} - {i.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!fatoresAplicam && formula && (
                <p className="col-span-2 text-xs text-muted-foreground">Esta opção já é o gasto total: os fatores não se aplicam.</p>
              )}
            </div>
          )}
        </Secao>

        <Secao titulo="3. Ajustes refinados" descricao="Somados ao GET, em kcal por dia.">
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Adicional por atividade física (MET)</p>
            {atividades.fields.length > 0 && (
              <ul className="space-y-3">
                {atividades.fields.map((f, i) => {
                  const a = v.atividades_met?.[i];
                  const gasto = a ? kcalAtividade({ met: n(a.met) ?? 0, minutos: n(a.minutos) ?? 0 }, entradas.peso_kg) : 0;
                  return (
                    <li key={f.id} className="grid grid-cols-[minmax(0,1fr)_5rem_5.5rem_auto] items-end gap-2">
                      <div className="space-y-1">
                        <Label htmlFor={`atividade-${i}-nome`} className="text-xs">
                          Atividade
                        </Label>
                        <Input id={`atividade-${i}-nome`} placeholder="Ex.: Musculação" {...register(`atividades_met.${i}.nome`)} />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`atividade-${i}-met`} className="text-xs">
                          MET
                        </Label>
                        <Input id={`atividade-${i}-met`} inputMode="decimal" {...register(`atividades_met.${i}.met`)} />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`atividade-${i}-min`} className="text-xs">
                          Min/dia
                        </Label>
                        <Input id={`atividade-${i}-min`} inputMode="numeric" {...register(`atividades_met.${i}.minutos`)} />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remover ${a?.nome || "atividade"}`}
                        onClick={() => atividades.remove(i)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      {gasto > 0 && <p className="col-span-4 -mt-1 text-xs text-muted-foreground">+ {fmt(Math.round(gasto))} kcal/dia</p>}
                    </li>
                  );
                })}
              </ul>
            )}
            {errors.atividades_met && (
              <p className="text-xs text-destructive" role="alert">
                Confira as atividades: cada uma precisa de nome, MET e minutos.
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => atividades.append({ codigo: "", nome: "", met: "", minutos: "" })}
            >
              <Plus className="h-4 w-4" />
              Adicionar atividade
            </Button>
            <p className="text-xs text-muted-foreground">Gasto = MET × peso × horas por dia.</p>
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-sm font-medium text-foreground">Meta de peso (VENTA)</p>
            <div className="grid grid-cols-2 gap-4">
              {campo("venta_kg", "Kg a ganhar (+) ou perder (−)", { placeholder: "Ex.: -3" })}
              {campo("venta_dias", "Em quantos dias", { placeholder: "Ex.: 90" })}
            </div>
            <p className="text-xs text-muted-foreground">
              Valor Energético do Tecido Adiposo: 7.700 kcal por kg.
              {venta !== 0 && ` ${venta > 0 ? "Soma" : "Tira"} ${fmt(Math.abs(Math.round(venta)))} kcal por dia.`}
            </p>
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            {campo("adicional_gestante_kcal", "Adicional energético de gestante (kcal/dia)", {
              dica: "Digitado à mão. O cálculo automático entra com o acompanhamento gestacional.",
            })}
          </div>
        </Secao>

        <Secao titulo="Observações">
          <Textarea id="observacoes" aria-label="Observações" rows={3} {...register("observacoes")} />
        </Secao>

        <div className="space-y-2">
          <AutoSaveStatus estado={estado} erro={erroSalvamento} />
          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar e voltar
          </Button>
        </div>
      </div>

      <div className="min-w-0 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">4. Resultados</CardTitle>
            <CardDescription>Calculados enquanto você digita.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Linha label="TMB — Taxa Metabólica Basal" valor={resultado.motivo ? "Não calculado" : kcal(resultado.tmb)} />
            <Linha label="GET — Gasto Energético Total" valor={resultado.motivo ? "Não calculado" : kcal(resultado.get)} destaque />
            {resultado.motivo && <p className="px-1 text-sm text-muted-foreground">{resultado.motivo}</p>}
            {!resultado.motivo && <Composicao entradas={entradas} tmb={resultado.tmb} adicionais={resultado.adicionais} fatoresAplicam={fatoresAplicam} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comparar fórmulas</CardTitle>
            <CardDescription>Mesmos dados, fatores e ajustes. Clique numa linha para usar a fórmula.</CardDescription>
          </CardHeader>
          <CardContent>
            {"motivo" in dados ? (
              <p className="text-sm text-muted-foreground">{dados.motivo}</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-2 font-medium">Fórmula</th>
                    <th className="py-2 pr-2 text-right font-medium">TMB</th>
                    <th className="py-2 text-right font-medium">GET</th>
                  </tr>
                </thead>
                <tbody>
                  {comparacao.map((c) => {
                    const ativa = c.f === formula;
                    return (
                      <tr key={c.f} className={cn("border-b border-border/60 last:border-0", ativa && "bg-primary/10")}>
                        <td className="py-1.5 pr-2">
                          <button
                            type="button"
                            className="text-left underline-offset-4 hover:underline focus-visible:underline"
                            aria-pressed={ativa}
                            onClick={() => setValue("formula", c.f, { shouldDirty: true })}
                          >
                            {FORMULAS[c.f].label}
                          </button>
                        </td>
                        {c.motivo ? (
                          <td colSpan={2} className="py-1.5 text-right text-xs text-muted-foreground">
                            {c.motivo}
                          </td>
                        ) : (
                          <>
                            <td className="py-1.5 pr-2 text-right tabular-nums">{c.tmb === null ? "—" : fmt(Math.round(c.tmb))}</td>
                            <td className="py-1.5 text-right font-medium tabular-nums">{fmt(Math.round(c.get!))}</td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={importando} onOpenChange={setImportando}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Importar de antropometria</DialogTitle>
            <DialogDescription>Escolha a avaliação. Peso, altura e massa livre de gordura são copiados para este cálculo.</DialogDescription>
          </DialogHeader>
          {avaliacoes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Este paciente ainda não tem avaliação com peso registrado.</p>
          ) : (
            <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
              {avaliacoes.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    className="w-full rounded-md bg-muted/60 px-4 py-3 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => importar(a)}
                  >
                    <span className="font-medium text-foreground">
                      Avaliação {a.tipo === "crianca" ? "infantil" : "de adulto"} — {formatDate(a.data)}
                    </span>
                    <span className="block text-muted-foreground">
                      {a.pesoKg !== null && `${fmt(a.pesoKg, 1)} kg`}
                      {a.alturaCm !== null && ` · ${fmt(a.alturaCm, 1)} cm`}
                      {a.mlgKg !== null ? ` · MLG ${fmt(a.mlgKg, 1)} kg` : " · sem massa livre de gordura"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </form>
  );
}

/** Idade usada para listar as fórmulas quando não há data de nascimento. */
const ADULTO_PADRAO = 30;

function Composicao({
  entradas,
  tmb,
  adicionais,
  fatoresAplicam,
}: {
  entradas: EntradasCalculo;
  tmb: number | null;
  adicionais: { met: number; venta: number; gestante: number };
  fatoresAplicam: boolean;
}) {
  const partes: string[] = [];
  if (tmb !== null && fatoresAplicam) {
    partes.push(`TMB × ${fmt(entradas.fator_atividade, 3)} (atividade)`);
    if (entradas.fator_injuria !== 1) partes.push(`× ${fmt(entradas.fator_injuria, 3)} (injúria)`);
  }
  if (adicionais.met) partes.push(`+ ${fmt(Math.round(adicionais.met))} kcal de atividades (MET)`);
  if (adicionais.venta) partes.push(`${adicionais.venta > 0 ? "+" : "−"} ${fmt(Math.abs(Math.round(adicionais.venta)))} kcal da meta de peso`);
  if (adicionais.gestante) partes.push(`+ ${fmt(Math.round(adicionais.gestante))} kcal de gestante`);
  if (!partes.length) return null;
  return <p className="px-1 text-xs text-muted-foreground">GET = {partes.join(" ")}</p>;
}

function Linha({ label, valor, destaque = false }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-muted/50 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium", destaque && "text-base text-foreground")}>{valor}</span>
    </div>
  );
}

function Secao({ titulo, descricao, acao, children }: { titulo: string; descricao?: string; acao?: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-2 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="text-base">{titulo}</CardTitle>
          {descricao && <CardDescription>{descricao}</CardDescription>}
        </div>
        {acao}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}
