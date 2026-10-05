"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Activity, Bone, ChartColumn, Check, ChevronDown, ChevronRight, CircleDashed, FileText, Info, Loader2, Pipette, UserRound } from "lucide-react";
import { toast } from "sonner";

import {
  classificarPercentualGordura,
  DOBRA_LABELS,
  DOBRAS,
  estimarAlturaPeloJoelho,
  estimarPesoAcamado,
  FORMULA_DENSIDADE_LABELS,
  IDADE_IDOSO,
  idadeNaData,
  PROTOCOLO_INFO,
  PROTOCOLOS,
  type Dobra,
  type FormulaDensidade,
  type ProtocoloDobras,
  type SexoParaFormula,
} from "@/lib/anthropometry";
import { calcularResultados, sexoDasFormulas, type MedidasAvaliacao } from "@/lib/anthropometry-results";
import { progressoDeTotal, progressoDobras, progressoLivre, progressoTexto, type Progresso } from "@/lib/assessment-progress";
import {
  assessmentSchema,
  CAMPOS_BIOIMPEDANCIA,
  CAMPOS_CIRCUNFERENCIAS_MEMBROS,
  CAMPOS_NUMERICOS,
  type AssessmentInput,
  type CampoNumerico,
} from "@/lib/validations/assessment";
import { updateAssessment } from "@/lib/actions/clinical";
import { useAutoSave } from "@/lib/hooks/use-auto-save";
import { useUnsavedChangesWarning } from "@/lib/hooks/use-unsaved-changes-warning";
import type { AnthropometricAssessment, Patient } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";

import { AssessmentResultsPanel } from "@/components/patients/assessment-results-panel";
import { AutoSaveStatus } from "@/components/patients/auto-save-status";
import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type FormValues = Record<CampoNumerico | "bio_idade_metabolica" | "peso_kg" | "altura_cm", string> & {
  data_avaliacao: string;
  peso_estimado: boolean;
  altura_estimada: boolean;
  lado_referencia: "direito" | "esquerdo";
  protocolo_dobras: ProtocoloDobras | "";
  formula_densidade: FormulaDensidade;
  sexo_referencia: SexoParaFormula | "";
  observacoes: string;
};

const texto = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

function buildDefaults(assessment: AnthropometricAssessment): FormValues {
  const valores = Object.fromEntries(
    CAMPOS_NUMERICOS.map((c) => [c, texto(assessment[c as keyof AnthropometricAssessment] as number | null)])
  ) as Record<CampoNumerico, string>;
  return {
    ...valores,
    data_avaliacao: assessment.data_avaliacao,
    peso_kg: texto(assessment.peso_kg),
    altura_cm: texto(assessment.altura_cm),
    bio_idade_metabolica: texto(assessment.bio_idade_metabolica),
    peso_estimado: assessment.peso_estimado,
    altura_estimada: assessment.altura_estimada,
    lado_referencia: assessment.lado_referencia,
    protocolo_dobras: assessment.protocolo_dobras ?? "",
    formula_densidade: assessment.formula_densidade,
    sexo_referencia: assessment.sexo_referencia ?? "",
    observacoes: assessment.observacoes ?? "",
  };
}

/** "" ou inválido → null; senão o número (aceita vírgula decimal). */
function n(v: string | undefined): number | null {
  if (v === undefined || v.trim() === "") return null;
  const x = Number(v.replace(",", "."));
  return Number.isFinite(x) && x > 0 ? x : null;
}

const MEMBRO_LABELS = [
  "Braço relaxado",
  "Braço contraído",
  "Antebraço",
  "Coxa proximal",
  "Coxa medial",
  "Coxa distal",
  "Panturrilha",
];

const TRONCO: { campo: CampoNumerico; label: string }[] = [
  { campo: "circunferencia_pescoco_cm", label: "Pescoço" },
  { campo: "circunferencia_torax_cm", label: "Tórax" },
  { campo: "circunferencia_ombro_cm", label: "Ombro" },
  { campo: "circunferencia_cintura_cm", label: "Cintura" },
  { campo: "circunferencia_quadril_cm", label: "Quadril" },
  { campo: "circunferencia_abdomen_cm", label: "Abdômen" },
];

const BIO_LABELS: Record<(typeof CAMPOS_BIOIMPEDANCIA)[number], string> = {
  bio_percentual_gordura: "% de gordura",
  bio_massa_gorda_kg: "Massa de gordura (kg)",
  bio_percentual_massa_muscular: "% de massa muscular",
  bio_massa_muscular_kg: "Massa muscular (kg)",
  bio_massa_livre_gordura_kg: "Massa livre de gordura (kg)",
  bio_peso_osseo_kg: "Peso ósseo (kg)",
  bio_gordura_visceral: "Gordura visceral (nível)",
  bio_agua_corporal_percentual: "Água corporal (%)",
};

/** Unidade mostrada dentro do campo (gordura visceral é um nível do aparelho, sem unidade). */
const BIO_UNIDADES: Record<(typeof CAMPOS_BIOIMPEDANCIA)[number], string | undefined> = {
  bio_percentual_gordura: "%",
  bio_massa_gorda_kg: "kg",
  bio_percentual_massa_muscular: "%",
  bio_massa_muscular_kg: "kg",
  bio_massa_livre_gordura_kg: "kg",
  bio_peso_osseo_kg: "kg",
  bio_gordura_visceral: undefined,
  bio_agua_corporal_percentual: "%",
};

interface AssessmentFormProps {
  patient: Pick<Patient, "id" | "nome" | "sexo" | "data_nascimento">;
  /** Já existe no banco: "Nova avaliação" cria o registro ao abrir (iniciarAvaliacao). */
  assessment: AnthropometricAssessment;
}

export function AssessmentForm({ patient, assessment }: AssessmentFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const voltarPara = `/pacientes/${patient.id}?aba=avaliacoes`;

  const {
    register,
    handleSubmit,
    control,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(assessmentSchema) as unknown as Resolver<FormValues>,
    defaultValues: buildDefaults(assessment),
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
  const idade = idadeNaData(patient.data_nascimento, v.data_avaliacao);
  const protocolo = v.protocolo_dobras || null;
  const dobrasDoProtocolo: Dobra[] = protocolo && sexo ? PROTOCOLO_INFO[protocolo].dobras(sexo) : [];

  const resultados = calcularResultados(
    {
      ...Object.fromEntries(CAMPOS_NUMERICOS.map((c) => [c, n(v[c])])),
      peso_kg: n(v.peso_kg),
      altura_cm: n(v.altura_cm),
      lado_referencia: v.lado_referencia,
      protocolo_dobras: protocolo,
      formula_densidade: v.formula_densidade,
    } as MedidasAvaliacao,
    { sexo, idade }
  );

  const bio = {
    ...(Object.fromEntries(CAMPOS_BIOIMPEDANCIA.map((c) => [c, n(v[c])])) as Record<
      (typeof CAMPOS_BIOIMPEDANCIA)[number],
      number | null
    >),
    bio_idade_metabolica: n(v.bio_idade_metabolica),
  };
  const classificacaoBio = bio.bio_percentual_gordura && sexo ? classificarPercentualGordura(bio.bio_percentual_gordura, sexo) : null;

  // Estimativas de Chumlea (60 anos ou mais) — usam medidas já digitadas no formulário.
  const aj = n(v.altura_joelho_cm);
  const lado = v.lado_referencia;
  const cb = lado === "esquerdo"
    ? n(v.circunferencia_braco_relaxado_esq_cm) ?? n(v.circunferencia_braco_relaxado_dir_cm)
    : n(v.circunferencia_braco_relaxado_dir_cm) ?? n(v.circunferencia_braco_relaxado_esq_cm);
  const cp = lado === "esquerdo"
    ? n(v.circunferencia_panturrilha_esq_cm) ?? n(v.circunferencia_panturrilha_dir_cm)
    : n(v.circunferencia_panturrilha_dir_cm) ?? n(v.circunferencia_panturrilha_esq_cm);
  const se = n(v.dobra_subescapular_mm);
  const idosoParaEstimar = idade !== null && idade >= IDADE_IDOSO && sexo !== null;
  const alturaEstimada = idosoParaEstimar && aj ? estimarAlturaPeloJoelho(aj, idade, sexo) : null;
  const pesoEstimado =
    idosoParaEstimar && aj && cb && cp && se
      ? estimarPesoAcamado({ sexo, alturaJoelhoCm: aj, circunferenciaBracoCm: cb, circunferenciaPanturrilhaCm: cp, dobraSubescapularMm: se })
      : null;
  const [mostrarEstimativas, setMostrarEstimativas] = useState(false);
  // Dados básicos começa aberta; as outras, fechadas (ajuste de 01/10/2026).
  const [abertas, setAbertas] = useState<Set<SecaoRecolhivel>>(() => new Set(["basicos"]));
  const secao = (nome: SecaoRecolhivel) => ({
    aberta: abertas.has(nome),
    onAlternar: () =>
      setAbertas((atual) => {
        const nova = new Set(atual);
        if (!nova.delete(nome)) nova.add(nome);
        return nova;
      }),
  });

  const temCamposAntigos = Boolean(
    (assessment.circunferencia_braco_cm || assessment.circunferencia_coxa_cm || (!assessment.protocolo_dobras && assessment.percentual_gordura))
  );

  async function onSubmit(values: FormValues) {
    if (precisaEscolherBase && values.protocolo_dobras && !values.sexo_referencia) {
      toast.error("Escolha a base (masculino ou feminino) para as fórmulas.");
      return;
    }
    setLoading(true);
    const falha = await salvarAgora();
    if (falha) {
      setLoading(false);
      toast.error("Não foi possível salvar a avaliação", { description: falha });
      return;
    }
    router.push(voltarPara);
  }

  const campo = (
    name: keyof FormValues,
    label: string,
    opts: { destaque?: boolean; required?: boolean; onInput?: () => void; unidade?: string; exemplo?: string } = {},
  ) => {
    const erro = errors[name]?.message as string | undefined;
    return (
      <div key={name} className="space-y-1.5">
        <Label htmlFor={name} className="text-sm font-medium">
          {label}
          {opts.required && " *"}
        </Label>
        <div className="relative">
          <Input
            id={name}
            inputMode="decimal"
            placeholder={opts.exemplo ? `Ex.: ${opts.exemplo}` : undefined}
            aria-required={opts.required || undefined}
            aria-invalid={erro ? true : undefined}
            className={cn("h-10", opts.unidade && "pr-12", opts.destaque && "border-l-4 border-l-primary")}
            {...register(name, { onChange: opts.onInput })}
          />
          {/* Unidade dentro do campo (o rótulo já diz a unidade para leitores de tela). */}
          {opts.unidade && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-px right-px flex w-10 items-center justify-center rounded-r-md border-l bg-muted/50 text-xs text-muted-foreground"
            >
              {opts.unidade}
            </span>
          )}
        </div>
        {erro && (
          <p className="text-xs text-destructive" role="alert">
            {erro}
          </p>
        )}
      </div>
    );
  };

  // Contadores das seções: só leitura do que está digitado (src/lib/assessment-progress.ts).
  const valores = v as unknown as Record<string, string | undefined>;
  const progresso = {
    basicos: progressoDeTotal(valores, CAMPOS_BASICOS),
    dobras: progressoDobras(
      valores,
      DOBRAS.map((d) => `dobra_${d}_mm`),
      dobrasDoProtocolo.map((d) => `dobra_${d}_mm`),
    ),
    circunferencias: progressoLivre(valores, [...TRONCO.map((t) => t.campo), ...CAMPOS_CIRCUNFERENCIAS_MEMBROS.flat()]),
    diametros: progressoDeTotal(valores, CAMPOS_DIAMETROS),
    bioimpedancia: progressoLivre(valores, [...CAMPOS_BIOIMPEDANCIA, "bio_idade_metabolica"]),
    observacoes: progressoTexto(v.observacoes),
  };

  return (
    <form
      // Campo com erro numa seção fechada ficaria invisível: abre todas para mostrar.
      onSubmit={handleSubmit(onSubmit, () => setAbertas(new Set(SECOES_RECOLHIVEIS)))}
      className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
    >
      <div className="min-w-0 space-y-4">
        <Secao
          id="basicos"
          titulo="Dados básicos"
          subtitulo="Informações principais da avaliação antropométrica."
          icon={UserRound}
          tom="verde"
          progresso={progresso.basicos}
          {...secao("basicos")}
        >
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="data_avaliacao" className="text-sm font-medium">
                Data da avaliação *
              </Label>
              <Input id="data_avaliacao" type="date" aria-required="true" {...register("data_avaliacao")} />
            </div>
            {campo("peso_kg", `Peso (kg)${v.peso_estimado ? " — estimado" : ""}`, {
              required: true,
              unidade: "kg",
              exemplo: "70,5",
              onInput: () => setValue("peso_estimado", false),
            })}
            {campo("altura_cm", `Altura (cm)${v.altura_estimada ? " — estimada" : ""}`, {
              required: true,
              unidade: "cm",
              exemplo: "170",
              onInput: () => setValue("altura_estimada", false),
            })}
            {campo("altura_sentado_cm", "Altura sentado (cm)", { unidade: "cm", exemplo: "90" })}
            {campo("altura_joelho_cm", "Altura do joelho (cm)", { unidade: "cm", exemplo: "50" })}
          </div>

          <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Info className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="text-foreground">Paciente acamado ou que não fica em pé?</span>
              <button
                type="button"
                className="inline-flex items-center gap-0.5 font-medium text-primary underline underline-offset-4 hover:no-underline"
                aria-expanded={mostrarEstimativas}
                onClick={() => setMostrarEstimativas((x) => !x)}
              >
                Estimar peso e altura
                <ChevronRight className={cn("h-4 w-4 transition-transform", mostrarEstimativas && "rotate-90")} aria-hidden="true" />
              </button>
            </div>
            {mostrarEstimativas && (
              <div className="mt-3 space-y-3 border-t pt-3">
                {!idosoParaEstimar ? (
                  <p className="text-muted-foreground">
                    As equações de Chumlea disponíveis são para pacientes com 60 anos ou mais
                    {idade === null ? " — cadastre a data de nascimento do paciente" : ""}
                    {sexo === null ? " — escolha a base (masculino/feminino) abaixo" : ""}.
                  </p>
                ) : (
                  <>
                    <p className="text-muted-foreground">
                      Altura: pela altura do joelho (Chumlea, 1985). Peso: altura do joelho, braço relaxado e panturrilha do
                      lado de referência e dobra subescapular (Chumlea, 1988).
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={alturaEstimada === null}
                        onClick={() => {
                          setValue("altura_cm", alturaEstimada!.toFixed(1), { shouldDirty: true });
                          setValue("altura_estimada", true, { shouldDirty: true });
                        }}
                      >
                        {alturaEstimada ? `Usar altura estimada (${alturaEstimada.toFixed(1)} cm)` : "Altura: preencha a altura do joelho"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pesoEstimado === null}
                        onClick={() => {
                          setValue("peso_kg", pesoEstimado!.toFixed(1), { shouldDirty: true });
                          setValue("peso_estimado", true, { shouldDirty: true });
                        }}
                      >
                        {pesoEstimado
                          ? `Usar peso estimado (${pesoEstimado.toFixed(1)} kg)`
                          : "Peso: preencha joelho, braço, panturrilha e subescapular"}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {precisaEscolherBase && (
            <div className="space-y-2 rounded-lg border border-accent/40 bg-accent/10 p-3">
              <p className="text-sm text-foreground">
                {patient.sexo === "outro"
                  ? 'O paciente está cadastrado como "outro". As fórmulas só têm coeficientes publicados para masculino e feminino — escolha qual base usar nesta avaliação.'
                  : "O sexo do paciente não está cadastrado. Escolha uma base para as fórmulas desta avaliação."}
              </p>
              <div className="max-w-[200px] space-y-1">
                <Label className="text-xs">Base para as fórmulas</Label>
                <Select
                  value={v.sexo_referencia}
                  onValueChange={(x) => setValue("sexo_referencia", x as SexoParaFormula, { shouldDirty: true })}
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
          {idade === null && (
            <p className="text-xs text-muted-foreground">
              Sem data de nascimento no cadastro: a classificação de idoso e os protocolos que usam a idade ficam indisponíveis.
            </p>
          )}
        </Secao>

        <Secao
          id="dobras"
          titulo="Dobras cutâneas (mm)"
          subtitulo="Espessura das dobras cutâneas para cálculo da composição corporal."
          icon={Pipette}
          tom="verde"
          progresso={progresso.dobras}
          {...secao("dobras")}
        >
          <fieldset className="space-y-3 rounded-lg bg-muted/50 p-4">
            <legend className="sr-only">Protocolo de % de gordura</legend>
            <p className="text-sm font-medium text-foreground">Fórmula para o % de gordura</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Protocolo de % de gordura">
              {[...PROTOCOLOS, "" as const].map((p) => {
                const ativo = v.protocolo_dobras === p;
                return (
                  <Button
                    key={p || "nenhum"}
                    type="button"
                    size="sm"
                    role="radio"
                    aria-checked={ativo}
                    variant={ativo ? "default" : "outline"}
                    onClick={() => setValue("protocolo_dobras", p, { shouldDirty: true })}
                  >
                    {p ? PROTOCOLO_INFO[p].label : "Nenhuma"}
                  </Button>
                );
              })}
            </div>
            {protocolo && (
              <div className="flex flex-wrap items-end gap-4">
                {protocolo !== "faulkner" && (
                  <div className="w-44 space-y-1">
                    <Label className="text-xs">Densidade → % de gordura</Label>
                    <Select
                      value={v.formula_densidade}
                      onValueChange={(x) => setValue("formula_densidade", x as FormulaDensidade, { shouldDirty: true })}
                    >
                      <SelectTrigger aria-label="Fórmula de densidade para % de gordura">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(FORMULA_DENSIDADE_LABELS).map(([valor, label]) => (
                          <SelectItem key={valor} value={valor}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {sexo ? PROTOCOLO_INFO[protocolo].fonte(sexo) : PROTOCOLO_INFO[protocolo].label} · amostra original:{" "}
                  {PROTOCOLO_INFO[protocolo].faixaEtaria}. As dobras usadas estão destacadas.
                </p>
              </div>
            )}
          </fieldset>
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
            {DOBRAS.map((d) =>
              campo(`dobra_${d}_mm` as CampoNumerico, DOBRA_LABELS[d], { destaque: dobrasDoProtocolo.includes(d), unidade: "mm" })
            )}
          </div>
        </Secao>

        <Secao
          id="circunferencias"
          titulo="Circunferências (cm)"
          subtitulo="Medidas de perímetros corporais. Usadas no RCQ, RCEst, CMB e nas estimativas de peso."
          icon={CircleDashed}
          tom="laranja"
          progresso={progresso.circunferencias}
          {...secao("circunferencias")}
        >
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">{TRONCO.map((t) => campo(t.campo, t.label, { unidade: "cm" }))}</div>
          <div className="space-y-2">
            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
              {CAMPOS_CIRCUNFERENCIAS_MEMBROS.flatMap(([dir, esq], i) => [
                campo(dir, `${MEMBRO_LABELS[i]} direito`, { unidade: "cm" }),
                campo(esq, `${MEMBRO_LABELS[i]} esquerdo`, { unidade: "cm" }),
              ])}
            </div>
            <p className="text-xs text-muted-foreground">Preencher os dois lados é opcional — um lado basta.</p>
          </div>
          <div className="w-60 space-y-1">
            <Label className="text-xs">Lado usado nos cálculos (CMB e peso estimado)</Label>
            <Select
              value={v.lado_referencia}
              onValueChange={(x) => setValue("lado_referencia", x as "direito" | "esquerdo", { shouldDirty: true })}
            >
              <SelectTrigger aria-label="Lado usado nos cálculos">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="direito">Direito</SelectItem>
                <SelectItem value="esquerdo">Esquerdo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {temCamposAntigos && (
            <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
              <p className="text-xs text-muted-foreground">
                Medidas do formato antigo desta avaliação (antes da nova antropometria), mantidas como foram registradas.
              </p>
              <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                {assessment.circunferencia_braco_cm !== null && campo("circunferencia_braco_cm", "Braço (formato antigo)", { unidade: "cm" })}
                {assessment.circunferencia_coxa_cm !== null && campo("circunferencia_coxa_cm", "Coxa (formato antigo)", { unidade: "cm" })}
                {!assessment.protocolo_dobras &&
                  assessment.percentual_gordura !== null &&
                  campo("percentual_gordura", "% de gordura (digitado)", { unidade: "%" })}
              </div>
            </div>
          )}
        </Secao>

        <Secao
          id="diametros"
          titulo="Diâmetros ósseos (cm)"
          subtitulo="Medidas de diâmetros ósseos. Usados no peso ósseo e na massa muscular."
          icon={Bone}
          tom="azul"
          progresso={progresso.diametros}
          {...secao("diametros")}
        >
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
            {campo("diametro_umero_cm", "Úmero", { unidade: "cm" })}
            {campo("diametro_punho_cm", "Punho", { unidade: "cm" })}
            {campo("diametro_femur_cm", "Fêmur", { unidade: "cm" })}
          </div>
        </Secao>

        <Secao
          id="bioimpedancia"
          titulo="Bioimpedância"
          subtitulo="Dados da bioimpedância elétrica: digite os valores que o aparelho mostrou."
          icon={Activity}
          tom="roxo"
          progresso={progresso.bioimpedancia}
          {...secao("bioimpedancia")}
        >
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
            {CAMPOS_BIOIMPEDANCIA.map((c) => campo(c, BIO_LABELS[c], { unidade: BIO_UNIDADES[c] }))}
            {campo("bio_idade_metabolica", "Idade metabólica (anos)", { unidade: "anos" })}
          </div>
        </Secao>

        <Secao
          id="observacoes"
          titulo="Observações"
          subtitulo="Anotações adicionais sobre a avaliação."
          icon={FileText}
          tom="cinza"
          progresso={progresso.observacoes}
          {...secao("observacoes")}
        >
          <Textarea id="observacoes" aria-label="Observações" rows={4} {...register("observacoes")} />
        </Secao>

        <div className="flex flex-col-reverse items-stretch gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <AutoSaveStatus estado={estado} erro={erroSalvamento} />
          <Button type="submit" size="lg" className="sm:min-w-56" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Salvar e voltar
          </Button>
        </div>
      </div>

      <div className="min-w-0">
        <section aria-labelledby="resultados-titulo" className="space-y-4 rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-success-soft text-primary">
              <ChartColumn className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="resultados-titulo" className="text-lg font-semibold text-foreground">
                Resultados
              </h2>
              <p className="text-sm text-muted-foreground">Calculados enquanto você digita.</p>
            </div>
          </div>
          <AssessmentResultsPanel
            r={resultados}
            pesoKg={n(v.peso_kg)}
            alturaCm={n(v.altura_cm)}
            bio={bio}
            classificacaoBio={classificacaoBio}
          />
        </section>
      </div>
    </form>
  );
}

const CAMPOS_BASICOS = ["peso_kg", "altura_cm", "altura_sentado_cm", "altura_joelho_cm"] as const;
const CAMPOS_DIAMETROS = ["diametro_umero_cm", "diametro_punho_cm", "diametro_femur_cm"] as const;

const SECOES_RECOLHIVEIS = ["basicos", "dobras", "circunferencias", "diametros", "bioimpedancia", "observacoes"] as const;
type SecaoRecolhivel = (typeof SECOES_RECOLHIVEIS)[number];

const TOM_ICONE = {
  verde: "bg-success-soft text-primary",
  laranja: "bg-warning-soft text-accent",
  azul: "bg-info-soft text-info",
  roxo: "bg-violet-100 text-violet-600",
  cinza: "bg-muted text-muted-foreground",
} as const;

interface SecaoProps {
  id: SecaoRecolhivel;
  titulo: string;
  subtitulo: string;
  icon: ComponentType<{ className?: string }>;
  tom: keyof typeof TOM_ICONE;
  progresso: Progresso;
  children: ReactNode;
  aberta: boolean;
  onAlternar: () => void;
}

/**
 * Seção do formulário: abre e fecha pelo cabeçalho (como no WebDiet), com
 * ícone, explicação curta e quanto já foi preenchido. Fechada, os campos
 * continuam montados (só escondidos) para não perder o que foi digitado.
 */
function Secao({ id, titulo, subtitulo, icon: Icon, tom, progresso, children, aberta, onAlternar }: SecaoProps) {
  const conteudo = `secao-${id}`;
  const descricao = `secao-${id}-descricao`;
  const comBarra = progresso.total !== null && progresso.total > 0;
  return (
    <section className="rounded-xl border bg-card shadow-sm">
      <button
        type="button"
        className="flex w-full items-center gap-3 rounded-xl px-4 py-4 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-4 sm:px-5"
        aria-expanded={aberta}
        aria-controls={conteudo}
        aria-describedby={descricao}
        onClick={onAlternar}
      >
        <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", TOM_ICONE[tom])}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-foreground">{titulo}</span>
          <span id={descricao} className="block text-sm text-muted-foreground">
            {subtitulo}
            <span className="sr-only">. {progresso.rotulo}</span>
          </span>
        </span>
        {comBarra && (
          <span className="hidden w-36 shrink-0 space-y-1.5 sm:block" aria-hidden="true">
            <span className="block text-xs text-muted-foreground">{progresso.rotulo}</span>
            <span className="block h-1.5 overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${(progresso.preenchidos / progresso.total!) * 100}%` }}
              />
            </span>
          </span>
        )}
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-xs",
            progresso.preenchidos > 0 ? "bg-success-soft text-success" : "bg-muted text-muted-foreground",
            comBarra && "sm:hidden",
          )}
          aria-hidden="true"
        >
          {progresso.rotulo}
        </span>
        <ChevronDown
          className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", aberta && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      <div id={conteudo} hidden={!aberta} className="space-y-4 border-t px-4 pb-5 pt-4 sm:px-5">
        {children}
      </div>
    </section>
  );
}
