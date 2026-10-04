"use client";

import { Fragment, useState, type ComponentType, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Activity,
  Baby,
  BookOpen,
  Calculator,
  Check,
  ChevronRight,
  ClipboardCheck,
  Copy,
  Database,
  Dumbbell,
  FileText,
  Flame,
  GitCompareArrows,
  HeartPulse,
  Loader2,
  MoreVertical,
  Pencil,
  PersonStanding,
  Ruler,
  Scale,
  Target,
  Trash2,
  Users,
  Zap,
} from "lucide-react";
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
import { dadosDoCalculo, resultadoDoCalculo, type EntradasCalculo } from "@/lib/energy-calculation";
import { atualizarCalculoEnergetico, excluirCalculoEnergetico, iniciarCalculoEnergetico } from "@/lib/actions/energy-calculations";
import { useAutoSave } from "@/lib/hooks/use-auto-save";
import { useUnsavedChangesWarning } from "@/lib/hooks/use-unsaved-changes-warning";
import { energyCalculationSchema, type EnergyCalculationInput } from "@/lib/validations/energy-calculation";
import type { AnthropometricAssessment, AtividadeMet, EnergyCalculation, Patient } from "@/lib/types/database.types";
import { cn, formatDate } from "@/lib/utils";

import { AutoSaveStatus } from "@/components/patients/auto-save-status";
import { GestanteDialog, MetDialog, ReferenciasDialog, VentaDialog } from "@/components/patients/energy-calculation-dialogs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CornerLeaves } from "@/components/shared/leaf-decoration";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  atividades_met: AtividadeMet[];
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

const INJURIA_OPCOES = FATORES_INJURIA.flatMap((g) => g.itens.map((i) => ({ chave: `${g.grupo} — ${i.label}`, ...i })));

/** Idade usada para listar as fórmulas quando não há data de nascimento. */
const ADULTO_PADRAO = 30;

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
    atividades_met: c.atividades_met ?? [],
    venta_kg: texto(c.venta_kg),
    venta_dias: texto(c.venta_dias),
    adicional_gestante_kcal: texto(c.adicional_gestante_kcal),
    observacoes: c.observacoes ?? "",
  };
}

type Janela = "importar" | "referencias" | "met" | "venta" | "gestante" | null;

interface Props {
  patient: Pick<Patient, "id" | "nome" | "sexo" | "data_nascimento">;
  calculo: EnergyCalculation;
  avaliacoes: AvaliacaoParaImportar[];
}

/**
 * Tela do cálculo energético (Fase 16; visual da Fase 19): dados utilizados,
 * método de cálculo, ajustes (abrem em janelas) e a conta passo a passo;
 * resultados e comparação de fórmulas à direita. Salva sozinho.
 */
export function EnergyCalculationForm({ patient, calculo, avaliacoes }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [janela, setJanela] = useState<Janela>(null);
  const [excluindo, setExcluindo] = useState(false);

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

  const v = useWatch({ control }) as FormValues;
  const alterar = <K extends keyof FormValues>(campo: K, valor: FormValues[K]) =>
    setValue(campo, valor as never, { shouldDirty: true, shouldValidate: true });

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
    atividades_met: v.atividades_met ?? [],
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

  /** "⋮ > Duplicar": grava o que falta e abre a cópia (mesma ação da lista de cálculos). */
  async function duplicar() {
    setLoading(true);
    const falha = await salvarAgora();
    if (falha) {
      setLoading(false);
      toast.error("Salve o cálculo antes de duplicar", { description: falha });
      return;
    }
    const r = await iniciarCalculoEnergetico(patient.id, "", calculo.id);
    if (r && !r.success) {
      setLoading(false);
      toast.error("Não foi possível duplicar o cálculo", { description: r.message });
    }
  }

  async function excluir() {
    setLoading(true);
    const r = await excluirCalculoEnergetico(patient.id, calculo.id);
    if (!r.success) {
      setLoading(false);
      setExcluindo(false);
      toast.error("Não foi possível excluir", { description: r.message });
      return;
    }
    toast.success("Cálculo excluído.");
    router.push(`/pacientes/${patient.id}?aba=calculo-energetico`);
  }

  function importar(a: AvaliacaoParaImportar) {
    alterar("peso_kg", texto(a.pesoKg));
    alterar("altura_cm", texto(a.alturaCm));
    alterar("massa_livre_gordura_kg", a.mlgKg ? a.mlgKg.toFixed(1) : "");
    alterar("assessment_id", a.id);
    if (precisaEscolherBase && a.sexoReferencia && !v.sexo_referencia) alterar("sexo_referencia", a.sexoReferencia);
    setJanela(null);
    toast.success(`Dados da avaliação de ${formatDate(a.data)} importados.`);
  }

  const erroDe = (name: keyof FormValues) => errors[name]?.message as string | undefined;

  const ajusteMet = resultado.adicionais.met;
  const ajusteVenta = resultado.adicionais.venta;
  const ajusteGestante = resultado.adicionais.gestante;
  const qtdAtividades = entradas.atividades_met.length;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_26rem] 2xl:grid-cols-[minmax(0,1fr)_30rem]">
      <Card className="min-w-0">
        <CardContent className="space-y-7 p-4 sm:p-6">
          {/* Título à esquerda; nome, data e "⋮" à direita. */}
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Cálculo energético</h2>
              <p className="text-sm text-muted-foreground">Configure os parâmetros e veja como o resultado é calculado.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                aria-label="Nome do cálculo"
                placeholder="Sem nome"
                maxLength={80}
                className="h-10 w-44 rounded-lg border border-input bg-card px-3 text-sm font-medium text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register("nome")}
              />
              <input
                type="date"
                aria-label="Data do cálculo"
                aria-required="true"
                className="h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register("data_calculo")}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" className="h-10 w-10" aria-label="Mais ações do cálculo">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={duplicar} disabled={loading}>
                    <Copy className="h-4 w-4" />
                    Duplicar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setExcluindo(true)} className="text-destructive focus:text-destructive">
                    <Trash2 className="h-4 w-4" />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <Bloco titulo="Dados utilizados">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
              <CaixaInput icone={Ruler} rotulo="Altura" unidade="cm" id="altura_cm" erro={erroDe("altura_cm")} {...register("altura_cm")} />
              <CaixaInput icone={Scale} rotulo="Peso atual" unidade="kg" id="peso_kg" erro={erroDe("peso_kg")} {...register("peso_kg")} />
              <CaixaInput
                icone={PersonStanding}
                rotulo="Massa livre de gordura"
                unidade="kg"
                id="massa_livre_gordura_kg"
                erro={erroDe("massa_livre_gordura_kg")}
                {...register("massa_livre_gordura_kg")}
              />
              <button
                type="button"
                onClick={() => setJanela("importar")}
                className="flex min-h-[4.25rem] items-center justify-center gap-2 rounded-xl border border-input bg-card px-3 text-sm font-medium text-primary transition-colors hover:border-primary/40 hover:bg-success-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Database className="h-4 w-4" aria-hidden="true" />
                Importar da antropometria
              </button>
            </div>
            {patient.data_nascimento === null && (
              <Aviso>Cadastre a data de nascimento do paciente: todas as fórmulas usam a idade.</Aviso>
            )}
            {precisaEscolherBase && (
              <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-2">
                <Caixa icone={Users} rotulo="Base para as fórmulas">
                  <Select value={v.sexo_referencia} onValueChange={(x) => alterar("sexo_referencia", x as "masculino" | "feminino")}>
                    <SelectTrigger aria-label="Base para as fórmulas" className={selectSemBorda}>
                      <SelectValue placeholder="Escolha a base" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="masculino">Masculino</SelectItem>
                      <SelectItem value="feminino">Feminino</SelectItem>
                    </SelectContent>
                  </Select>
                </Caixa>
                <p className="text-xs text-muted-foreground">
                  {patient.sexo === "outro" ? 'Paciente cadastrado como "outro".' : "Sexo não cadastrado."} As fórmulas só têm
                  coeficientes para masculino e feminino.
                </p>
              </div>
            )}
          </Bloco>

          <Bloco
            titulo="Método de cálculo"
            subtitulo="Selecione a fórmula e os fatores para o cálculo do gasto energético."
            acao={
              <button
                type="button"
                onClick={() => setJanela("referencias")}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:underline"
              >
                <BookOpen className="h-4 w-4" aria-hidden="true" />
                Ver referências
              </button>
            }
          >
            <Caixa icone={FileText} rotulo="Fórmula para cálculo teórico">
              <Select value={v.formula} onValueChange={(x) => alterar("formula", x as FormulaEnergia)}>
                <SelectTrigger aria-label="Fórmula para cálculo teórico" className={selectSemBorda}>
                  <SelectValue placeholder="Escolha sua fórmula" />
                </SelectTrigger>
                <SelectContent {...abrirParaBaixo}>
                  <SelectGroup>
                    <SelectLabel>
                      {idade !== null && idade < 18 ? "Protocolos para crianças" : "Protocolos para adultos e idosos"}
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
            </Caixa>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {eer ? (
                <Caixa icone={Activity} rotulo="Nível de atividade (EER)">
                  <Select value={v.nivel_eer} onValueChange={(x) => alterar("nivel_eer", x as NivelEER)}>
                    <SelectTrigger aria-label="Nível de atividade da EER" className={selectSemBorda}>
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
                </Caixa>
              ) : (
                <Caixa icone={Activity} rotulo="Fator atividade física (FAF)" desativada={!fatoresAplicam}>
                  <Select value={v.fator_atividade} disabled={!fatoresAplicam} onValueChange={(x) => alterar("fator_atividade", x)}>
                    <SelectTrigger aria-label="Fator atividade física" className={selectSemBorda}>
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
                </Caixa>
              )}

              <Caixa icone={HeartPulse} rotulo="Fator de injúria" desativada={!fatoresAplicam}>
                <Select
                  value={v.fator_injuria_label || "nenhum"}
                  disabled={!fatoresAplicam}
                  onValueChange={(chave) => {
                    const o = INJURIA_OPCOES.find((i) => i.chave === chave);
                    alterar("fator_injuria_label", o ? o.chave : "");
                    alterar("fator_injuria", String(o ? o.valor : 1));
                  }}
                >
                  <SelectTrigger aria-label="Fator injúria" className={selectSemBorda}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent {...abrirParaBaixo}>
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
              </Caixa>

              {formula === "formula_de_bolso" && (
                <CaixaInput
                  icone={Calculator}
                  rotulo="kcal por kg de peso"
                  id="kcal_por_kg"
                  erro={erroDe("kcal_por_kg")}
                  {...register("kcal_por_kg")}
                />
              )}
              {(formula === "tmb_manual" || formula === "get_manual") && (
                <CaixaInput
                  icone={Calculator}
                  rotulo={formula === "tmb_manual" ? "TMB" : "GET"}
                  unidade="kcal/dia"
                  id="valor_manual_kcal"
                  erro={erroDe("valor_manual_kcal")}
                  {...register("valor_manual_kcal")}
                />
              )}
            </div>
            {formula && !fatoresAplicam && (
              <p className="text-xs text-muted-foreground">
                {eer ? "A EER já dá o gasto total (de 0 a 2 anos, sem nível de atividade)." : "Esta opção já é o gasto total."} O
                fator de atividade e o fator de injúria não se aplicam.
              </p>
            )}
          </Bloco>

          <Bloco titulo="Ajustes energéticos" subtitulo="Adicionais e reduções aplicados ao cálculo.">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
              <CaixaBotao
                icone={Dumbbell}
                rotulo="Adicional calórico por MET"
                valor={qtdAtividades ? `+ ${fmt(Math.round(ajusteMet))} kcal/dia` : null}
                detalhe={qtdAtividades ? `${qtdAtividades} ${qtdAtividades === 1 ? "atividade cadastrada" : "atividades cadastradas"}` : null}
                vazio="Programar MET"
                onClick={() => setJanela("met")}
              />
              <CaixaBotao
                icone={Target}
                rotulo="Programar peso por VENTA"
                valor={ajusteVenta ? `${ajusteVenta > 0 ? "+" : "−"} ${fmt(Math.abs(Math.round(ajusteVenta)))} kcal/dia` : null}
                detalhe={ajusteVenta ? "Meta de peso ativa" : null}
                vazio="Programar peso"
                onClick={() => setJanela("venta")}
              />
              <CaixaBotao
                icone={Baby}
                rotulo="Adicional energético de gestante"
                valor={ajusteGestante ? `+ ${fmt(Math.round(ajusteGestante))} kcal/dia` : null}
                detalhe={null}
                vazio="Não utilizar"
                onClick={() => setJanela("gestante")}
              />
            </div>
          </Bloco>

          <Bloco titulo="Como chegamos ao resultado" subtitulo="Visualize a composição do cálculo passo a passo.">
            {resultado.motivo ? (
              <p className="rounded-lg bg-muted/50 px-3 py-3 text-sm text-muted-foreground">{resultado.motivo}</p>
            ) : (
              <PassoAPasso
                entradas={entradas}
                tmb={resultado.tmb}
                get={resultado.get}
                adicionais={resultado.adicionais}
                fatoresAplicam={fatoresAplicam}
                qtdAtividades={qtdAtividades}
              />
            )}
          </Bloco>

          <div className="flex flex-col gap-3 border-t border-border pt-5 lg:flex-row lg:items-end">
            <div className="min-w-0 flex-1 space-y-1.5">
              <label htmlFor="observacoes" className="flex items-center gap-2 text-sm font-medium text-foreground">
                <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Observações (opcional)
              </label>
              <Textarea id="observacoes" rows={2} placeholder="Adicione observações sobre este cálculo..." {...register("observacoes")} />
            </div>
            <div className="space-y-1.5 lg:w-56">
              <AutoSaveStatus estado={estado} erro={erroSalvamento} />
              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Salvar e voltar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="min-w-0 space-y-6">
        <Card className="relative overflow-hidden">
          <CornerLeaves className="pointer-events-none absolute -right-8 -top-4 h-[110px] w-[240px]" />
          <CardContent className="relative space-y-3 p-4 sm:p-5">
            <TituloDePainel icone={ClipboardCheck} titulo="Resultados" subtitulo="Calculados enquanto você digita." />
            <Linha icone={Flame} label="TMB — Taxa Metabólica Basal" valor={resultado.motivo ? "Não calculado" : kcal(resultado.tmb)} />
            <Linha
              icone={Zap}
              label="GET — Gasto Energético Total"
              valor={resultado.motivo ? "Não calculado" : kcal(resultado.get)}
              destaque
            />
            {resultado.motivo && <p className="px-1 text-sm text-muted-foreground">{resultado.motivo}</p>}
            {!resultado.motivo && (
              <Composicao entradas={entradas} tmb={resultado.tmb} adicionais={resultado.adicionais} fatoresAplicam={fatoresAplicam} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4 sm:p-5">
            <TituloDePainel
              icone={GitCompareArrows}
              titulo="Comparar fórmulas"
              subtitulo="Mesmos dados, fatores e ajustes. Clique numa linha para usar a fórmula."
            />
            {"motivo" in dados ? (
              <p className="text-sm text-muted-foreground">{dados.motivo}</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Fórmula</th>
                    <th className="px-2 py-2 text-right font-medium">TMB (kcal/dia)</th>
                    <th className="px-2 py-2 text-right font-medium">GET (kcal/dia)</th>
                  </tr>
                </thead>
                <tbody>
                  {comparacao.map((c) => {
                    const ativa = c.f === formula;
                    return (
                      <tr key={c.f} className={cn("border-t border-border/60", ativa && "bg-success-soft font-semibold text-primary")}>
                        <td className="px-2 py-1.5">
                          <button
                            type="button"
                            className="text-left underline-offset-4 hover:underline focus-visible:underline"
                            aria-pressed={ativa}
                            onClick={() => alterar("formula", c.f)}
                          >
                            {FORMULAS[c.f].label}
                          </button>
                        </td>
                        {c.motivo ? (
                          <td colSpan={2} className="px-2 py-1.5 text-right text-xs font-normal text-muted-foreground">
                            {c.motivo}
                          </td>
                        ) : (
                          <>
                            <td className="px-2 py-1.5 text-right tabular-nums">{c.tmb === null ? "—" : fmt(Math.round(c.tmb))}</td>
                            <td className="px-2 py-1.5 text-right font-medium tabular-nums">{fmt(Math.round(c.get!))}</td>
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

      <Dialog open={janela === "importar"} onOpenChange={(o) => !o && setJanela(null)}>
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

      <AlertDialog open={excluindo} onOpenChange={setExcluindo}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cálculo?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{v.nome || "Sem nome"}&quot;, de {formatDate(v.data_calculo)}. Ele some da lista.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                excluir();
              }}
              disabled={loading}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {janela === "referencias" && (
        <ReferenciasDialog onOpenChange={(o) => !o && setJanela(null)} formulaInicial={formula} opcoes={opcoesFormula} />
      )}
      {janela === "met" && (
        <MetDialog
          onOpenChange={(o) => !o && setJanela(null)}
          atividades={entradas.atividades_met}
          pesoKg={entradas.peso_kg}
          onConfirmar={(lista) => {
            alterar("atividades_met", lista);
            setJanela(null);
          }}
        />
      )}
      {janela === "venta" && (
        <VentaDialog
          onOpenChange={(o) => !o && setJanela(null)}
          kg={entradas.venta_kg ?? 0}
          dias={entradas.venta_dias ?? 90}
          onConfirmar={(kg, dias) => {
            alterar("venta_kg", kg ? String(kg) : "");
            alterar("venta_dias", kg ? String(dias) : "");
            setJanela(null);
          }}
        />
      )}
      {janela === "gestante" && (
        <GestanteDialog
          onOpenChange={(o) => !o && setJanela(null)}
          kcal={entradas.adicional_gestante_kcal}
          onConfirmar={(valor) => {
            alterar("adicional_gestante_kcal", valor ? String(valor) : "");
            setJanela(null);
          }}
        />
      )}
    </form>
  );
}

/** Listas longas abrem sempre para baixo, com rolagem no espaço que sobra na tela. */
const abrirParaBaixo = {
  side: "bottom" as const,
  avoidCollisions: false,
  className: "max-h-[min(24rem,var(--radix-select-content-available-height))]",
};

const selectSemBorda = "h-7 border-0 bg-transparent px-0 text-base font-semibold shadow-none focus:ring-0 focus:ring-offset-0";

type Icone = ComponentType<{ className?: string }>;

function IconeCaixa({ icone: I, className }: { icone: Icone; className?: string }) {
  return (
    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success-soft text-primary", className)}>
      <I className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}

/** Caixa com ícone: rótulo pequeno em cima, valor embaixo; o foco destaca a caixa inteira. */
function Caixa({
  icone,
  rotulo,
  children,
  desativada = false,
  erro,
  className,
}: {
  icone: Icone;
  rotulo: string;
  children: ReactNode;
  desativada?: boolean;
  erro?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div
        className={cn(
          "flex min-h-[4.25rem] items-center gap-3 rounded-xl border border-input bg-card px-3 py-2 focus-within:ring-2 focus-within:ring-ring",
          desativada && "opacity-50",
          erro && "border-destructive",
        )}
      >
        <IconeCaixa icone={icone} />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{rotulo}</p>
          {children}
        </div>
      </div>
      {erro && (
        <p className="mt-1 text-xs text-destructive" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}

function CaixaInput({
  icone,
  rotulo,
  unidade,
  id,
  erro,
  ...input
}: { icone: Icone; rotulo: string; unidade?: string; id: string; erro?: string } & React.InputHTMLAttributes<HTMLInputElement> & {
    ref?: React.Ref<HTMLInputElement>;
  }) {
  return (
    <Caixa icone={icone} rotulo={rotulo} erro={erro}>
      <label htmlFor={id} className="sr-only">
        {rotulo}
      </label>
      <div className="flex items-baseline gap-1">
        <input
          id={id}
          inputMode="decimal"
          aria-invalid={erro ? true : undefined}
          className="h-7 w-full min-w-0 bg-transparent text-base font-semibold text-foreground outline-none"
          {...input}
        />
        {unidade && <span className="shrink-0 text-sm text-muted-foreground">{unidade}</span>}
        <Pencil className="ml-1 h-3.5 w-3.5 shrink-0 self-center text-muted-foreground" aria-hidden="true" />
      </div>
    </Caixa>
  );
}

/** Caixa que abre uma janela (ajustes energéticos). */
function CaixaBotao({
  icone,
  rotulo,
  valor,
  detalhe,
  vazio,
  onClick,
}: {
  icone: Icone;
  rotulo: string;
  valor: string | null;
  detalhe: string | null;
  vazio: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[4.75rem] items-center gap-3 rounded-xl border border-input bg-card px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <IconeCaixa icone={icone} />
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-muted-foreground">{rotulo}</span>
        <span className={cn("block text-base", valor ? "font-semibold text-foreground" : "font-medium text-foreground")}>
          {valor ?? vazio}
        </span>
        {detalhe && <span className="block text-xs text-muted-foreground">{detalhe}</span>}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}

function Bloco({
  titulo,
  subtitulo,
  acao,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  acao?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-foreground">{titulo}</h3>
          {subtitulo && <p className="text-sm text-muted-foreground">{subtitulo}</p>}
        </div>
        {acao}
      </div>
      {children}
    </section>
  );
}

function TituloDePainel({ icone, titulo, subtitulo }: { icone: Icone; titulo: string; subtitulo: string }) {
  return (
    <div className="flex items-start gap-3 pb-1">
      <IconeCaixa icone={icone} />
      <div>
        <h3 className="font-semibold text-foreground">{titulo}</h3>
        <p className="text-sm text-muted-foreground">{subtitulo}</p>
      </div>
    </div>
  );
}

function Aviso({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-sm">{children}</p>;
}

/** A conta escrita por extenso, embaixo dos resultados. */
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
  return <p className="px-1 pt-1 text-xs text-muted-foreground">GET = {partes.join(" ")}</p>;
}

/**
 * "Como chegamos ao resultado": a mesma conta da Composição, em blocos —
 * TMB × fatores + MET − meta de peso + gestante = GET. Só aparecem as partes usadas.
 */
function PassoAPasso({
  entradas,
  tmb,
  get,
  adicionais,
  fatoresAplicam,
  qtdAtividades,
}: {
  entradas: EntradasCalculo;
  tmb: number | null;
  get: number | null;
  adicionais: { met: number; venta: number; gestante: number };
  fatoresAplicam: boolean;
  qtdAtividades: number;
}) {
  type Passo = { op?: string; icone: Icone; valor: string; rotulo: string; tom: string };
  const passos: Passo[] = [];
  if (tmb !== null) {
    passos.push({
      icone: Flame,
      valor: kcal(tmb),
      rotulo: fatoresAplicam ? "TMB" : "Resultado da fórmula",
      tom: "bg-[#2a78d6]/10 text-[#1f5fae]",
    });
    if (fatoresAplicam) {
      passos.push({ op: "×", icone: Activity, valor: fmt(entradas.fator_atividade, 3), rotulo: "Fator atividade", tom: "bg-muted text-foreground" });
      if (entradas.fator_injuria !== 1) {
        passos.push({ op: "×", icone: HeartPulse, valor: fmt(entradas.fator_injuria, 3), rotulo: "Fator de injúria", tom: "bg-muted text-foreground" });
      }
    }
  }
  if (adicionais.met) {
    passos.push({
      op: "+",
      icone: Dumbbell,
      valor: `${fmt(Math.round(adicionais.met))} kcal`,
      rotulo: `MET (${qtdAtividades} ${qtdAtividades === 1 ? "atividade" : "atividades"})`,
      tom: "bg-success-soft text-primary",
    });
  }
  if (adicionais.venta) {
    passos.push({
      op: adicionais.venta > 0 ? "+" : "−",
      icone: Target,
      valor: `${fmt(Math.abs(Math.round(adicionais.venta)))} kcal`,
      rotulo: "Meta de peso",
      tom: "bg-accent/10 text-[#b45309]",
    });
  }
  if (adicionais.gestante) {
    passos.push({ op: "+", icone: Baby, valor: `${fmt(Math.round(adicionais.gestante))} kcal`, rotulo: "Gestante", tom: "bg-success-soft text-primary" });
  }

  return (
    <ol className="flex flex-wrap items-center gap-2" aria-label="Composição do cálculo">
      {passos.map((p, i) => (
        <Fragment key={i}>
          {p.op && (
            <li aria-hidden="true" className="px-1 text-lg font-medium text-muted-foreground">
              {p.op}
            </li>
          )}
          <li className={cn("flex items-center gap-2.5 rounded-xl px-3 py-2.5", p.tom)}>
            <p.icone className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="leading-tight">
              <span className="sr-only">{p.op === "−" ? "menos " : p.op === "+" ? "mais " : p.op === "×" ? "vezes " : ""}</span>
              <span className="block text-sm font-semibold tabular-nums">{p.valor}</span>
              <span className="block text-xs opacity-80">{p.rotulo}</span>
            </span>
          </li>
        </Fragment>
      ))}
      <li aria-hidden="true" className="px-1 text-lg font-medium text-muted-foreground">
        =
      </li>
      <li className="flex items-center gap-2.5 rounded-xl bg-success-soft px-4 py-2.5 text-primary ring-1 ring-primary/20">
        <Zap className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="leading-tight">
          <span className="sr-only">igual a </span>
          <span className="block text-base font-bold tabular-nums">{kcal(get)}</span>
          <span className="block text-xs">GET (resultado)</span>
        </span>
      </li>
    </ol>
  );
}

function Linha({ icone: I, label, valor, destaque = false }: { icone: Icone; label: string; valor: string; destaque?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm",
        destaque ? "bg-success-soft" : "bg-muted/50",
      )}
    >
      <span className="flex items-center gap-2 text-muted-foreground">
        <I className={cn("h-4 w-4", destaque ? "text-primary" : "text-accent")} aria-hidden="true" />
        {label}
      </span>
      <span className={cn("whitespace-nowrap font-semibold tabular-nums", destaque ? "text-lg text-primary" : "text-foreground")}>{valor}</span>
    </div>
  );
}
