"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, Loader2 } from "lucide-react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [abertas, setAbertas] = useState<Set<SecaoRecolhivel>>(new Set());
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

  const campo = (name: keyof FormValues, label: string, opts: { destaque?: boolean; required?: boolean; onInput?: () => void } = {}) => {
    const erro = errors[name]?.message as string | undefined;
    return (
      <div key={name} className="space-y-1.5">
        <Label htmlFor={name} className="text-xs">
          {label}
          {opts.required && " *"}
        </Label>
        <Input
          id={name}
          inputMode="decimal"
          aria-required={opts.required || undefined}
          aria-invalid={erro ? true : undefined}
          className={cn(opts.destaque && "border-l-4 border-l-primary")}
          {...register(name, { onChange: opts.onInput })}
        />
        {erro && (
          <p className="text-xs text-destructive" role="alert">
            {erro}
          </p>
        )}
      </div>
    );
  };

  return (
    <form
      // Campo com erro numa seção fechada ficaria invisível: abre todas para mostrar.
      onSubmit={handleSubmit(onSubmit, () => setAbertas(new Set(SECOES_RECOLHIVEIS)))}
      className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
      <div className="min-w-0 space-y-6">
        <Secao titulo="Dados básicos">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="data_avaliacao" className="text-xs">
                Data da avaliação *
              </Label>
              <Input id="data_avaliacao" type="date" aria-required="true" {...register("data_avaliacao")} />
            </div>
            {campo("peso_kg", `Peso (kg)${v.peso_estimado ? " — estimado" : ""}`, {
              required: true,
              onInput: () => setValue("peso_estimado", false),
            })}
            {campo("altura_cm", `Altura (cm)${v.altura_estimada ? " — estimada" : ""}`, {
              required: true,
              onInput: () => setValue("altura_estimada", false),
            })}
            {campo("altura_sentado_cm", "Altura sentado (cm)")}
            {campo("altura_joelho_cm", "Altura do joelho (cm)")}
          </div>

          <button
            type="button"
            className="text-sm text-primary underline-offset-4 hover:underline"
            aria-expanded={mostrarEstimativas}
            onClick={() => setMostrarEstimativas((x) => !x)}
          >
            Paciente acamado ou que não fica em pé? Estimar peso e altura
          </button>
          {mostrarEstimativas && (
            <div className="space-y-3 rounded-md border border-border bg-muted/40 p-3 text-sm">
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

          {precisaEscolherBase && (
            <div className="space-y-2 rounded-md border border-accent/40 bg-accent/10 p-3">
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

        <Secao titulo="Dobras cutâneas (mm)" {...secao("dobras")}>
          <fieldset className="space-y-3 rounded-md bg-muted/40 p-3">
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
          <div className="grid grid-cols-2 gap-4">
            {DOBRAS.map((d) =>
              campo(`dobra_${d}_mm` as CampoNumerico, DOBRA_LABELS[d], { destaque: dobrasDoProtocolo.includes(d) })
            )}
          </div>
        </Secao>

        <Secao titulo="Circunferências (cm)" {...secao("circunferencias")} descricao="Usadas no RCQ, RCEst, CMB e nas estimativas de peso.">
          <div className="grid grid-cols-2 gap-4">{TRONCO.map((t) => campo(t.campo, t.label))}</div>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-4">
              {CAMPOS_CIRCUNFERENCIAS_MEMBROS.flatMap(([dir, esq], i) => [
                campo(dir, `${MEMBRO_LABELS[i]} direito`),
                campo(esq, `${MEMBRO_LABELS[i]} esquerdo`),
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
            <div className="space-y-2 rounded-md border border-dashed border-border p-3">
              <p className="text-xs text-muted-foreground">
                Medidas do formato antigo desta avaliação (antes da nova antropometria), mantidas como foram registradas.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {assessment.circunferencia_braco_cm !== null && campo("circunferencia_braco_cm", "Braço (formato antigo)")}
                {assessment.circunferencia_coxa_cm !== null && campo("circunferencia_coxa_cm", "Coxa (formato antigo)")}
                {!assessment.protocolo_dobras &&
                  assessment.percentual_gordura !== null &&
                  campo("percentual_gordura", "% de gordura (digitado)")}
              </div>
            </div>
          )}
        </Secao>

        <Secao titulo="Diâmetros ósseos (cm)" {...secao("diametros")} descricao="Usados no peso ósseo e na massa muscular.">
          <div className="grid grid-cols-2 gap-4">
            {campo("diametro_umero_cm", "Úmero")}
            {campo("diametro_punho_cm", "Punho")}
            {campo("diametro_femur_cm", "Fêmur")}
          </div>
        </Secao>

        <Secao titulo="Bioimpedância" {...secao("bioimpedancia")} descricao="Digite os valores que o aparelho mostrou.">
          <div className="grid grid-cols-2 gap-4">
            {CAMPOS_BIOIMPEDANCIA.map((c) => campo(c, BIO_LABELS[c]))}
            {campo("bio_idade_metabolica", "Idade metabólica (anos)")}
          </div>
        </Secao>

        <Secao titulo="Observações" {...secao("observacoes")}>
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

      <div className="min-w-0">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resultados</CardTitle>
            <CardDescription>Calculados enquanto você digita.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <AssessmentResultsPanel
              r={resultados}
              pesoKg={n(v.peso_kg)}
              alturaCm={n(v.altura_cm)}
              bio={bio}
              classificacaoBio={classificacaoBio}
            />
          </CardContent>
        </Card>
      </div>
    </form>
  );
}

const SECOES_RECOLHIVEIS = ["dobras", "circunferencias", "diametros", "bioimpedancia", "observacoes"] as const;
type SecaoRecolhivel = (typeof SECOES_RECOLHIVEIS)[number];

interface SecaoProps {
  titulo: string;
  descricao?: string;
  children: ReactNode;
  /** Sem `aberta`, a seção fica sempre aberta (Dados básicos). */
  aberta?: boolean;
  onAlternar?: () => void;
}

/**
 * Seção do formulário. As recolhíveis abrem e fecham pelo título (como no WebDiet);
 * fechadas, os campos continuam montados (só escondidos) para não perder o que foi digitado.
 */
function Secao({ titulo, descricao, children, aberta, onAlternar }: SecaoProps) {
  const recolhivel = aberta !== undefined;
  const id = `secao-${titulo.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <Card>
      <CardHeader>
        {recolhivel ? (
          <CardTitle className="text-base">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 text-left"
              aria-expanded={aberta}
              aria-controls={id}
              onClick={onAlternar}
            >
              {titulo}
              <ChevronDown
                className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", aberta && "rotate-180")}
                aria-hidden="true"
              />
            </button>
          </CardTitle>
        ) : (
          <CardTitle className="text-base">{titulo}</CardTitle>
        )}
        {descricao && (!recolhivel || aberta) && <CardDescription>{descricao}</CardDescription>}
      </CardHeader>
      <CardContent id={id} hidden={recolhivel && !aberta} className="space-y-4">
        {children}
      </CardContent>
    </Card>
  );
}
