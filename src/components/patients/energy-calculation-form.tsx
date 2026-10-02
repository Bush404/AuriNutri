"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
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
import { atualizarCalculoEnergetico } from "@/lib/actions/energy-calculations";
import { useAutoSave } from "@/lib/hooks/use-auto-save";
import { useUnsavedChangesWarning } from "@/lib/hooks/use-unsaved-changes-warning";
import { energyCalculationSchema, type EnergyCalculationInput } from "@/lib/validations/energy-calculation";
import type { AnthropometricAssessment, AtividadeMet, EnergyCalculation, Patient } from "@/lib/types/database.types";
import { cn, formatDate } from "@/lib/utils";

import { AutoSaveStatus } from "@/components/patients/auto-save-status";
import { GestanteDialog, MetDialog, ReferenciasDialog, VentaDialog } from "@/components/patients/energy-calculation-dialogs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
 * Tela do cálculo energético no formato do WebDiet: caixas compactas de 3 em
 * 3 (dados, fórmula e fatores, ajustes) e os ajustes abrindo em janelas ao
 * clicar. Resultados e comparação de fórmulas à direita. Salva sozinho.
 */
export function EnergyCalculationForm({ patient, calculo, avaliacoes }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [janela, setJanela] = useState<Janela>(null);
  const [mostrarObs, setMostrarObs] = useState(Boolean(calculo.observacoes));

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
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
      <Card className="min-w-0">
        <CardContent className="space-y-7 pt-6">
          <div className="flex flex-wrap items-end gap-3">
            <input
              aria-label="Nome do cálculo"
              placeholder="Sem nome"
              maxLength={80}
              className="min-w-0 flex-1 bg-transparent text-xl font-semibold text-foreground outline-none placeholder:text-foreground focus-visible:underline"
              {...register("nome")}
            />
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Data
              <input
                type="date"
                aria-required="true"
                className="rounded-md border border-input bg-card px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register("data_calculo")}
              />
            </label>
          </div>

          <Bloco titulo="1. Dados antropométricos" acao={<LinkTexto onClick={() => setJanela("importar")}>Importar de antropometria</LinkTexto>}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <CaixaInput rotulo="Altura do paciente (cm)" id="altura_cm" erro={erroDe("altura_cm")} {...register("altura_cm")} />
              <CaixaInput rotulo="Peso do paciente (kg)" id="peso_kg" erro={erroDe("peso_kg")} {...register("peso_kg")} />
              <CaixaInput
                rotulo="Massa livre de gordura (kg)"
                id="massa_livre_gordura_kg"
                erro={erroDe("massa_livre_gordura_kg")}
                {...register("massa_livre_gordura_kg")}
              />
            </div>
            {patient.data_nascimento === null && (
              <Aviso>Cadastre a data de nascimento do paciente: todas as fórmulas usam a idade.</Aviso>
            )}
            {precisaEscolherBase && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Caixa rotulo="Base para as fórmulas" className="sm:col-span-1">
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
                <p className="self-center text-xs text-muted-foreground sm:col-span-2">
                  {patient.sexo === "outro" ? 'Paciente cadastrado como "outro".' : "Sexo não cadastrado."} As fórmulas só têm
                  coeficientes para masculino e feminino.
                </p>
              </div>
            )}
          </Bloco>

          <Bloco titulo="2. Fórmulas padronizadas" acao={<LinkTexto onClick={() => setJanela("referencias")}>Ver referências</LinkTexto>}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Caixa rotulo="Fórmula para cálculo teórico">
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

              {eer ? (
                <Caixa rotulo="Nível de atividade (EER)">
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
                <Caixa rotulo="Fator atividade física" desativada={!fatoresAplicam}>
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

              <Caixa rotulo="Fator injúria" desativada={!fatoresAplicam}>
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
                <CaixaInput rotulo="kcal por kg de peso" id="kcal_por_kg" erro={erroDe("kcal_por_kg")} {...register("kcal_por_kg")} />
              )}
              {(formula === "tmb_manual" || formula === "get_manual") && (
                <CaixaInput
                  rotulo={formula === "tmb_manual" ? "TMB (kcal/dia)" : "GET (kcal/dia)"}
                  id="valor_manual_kcal"
                  erro={erroDe("valor_manual_kcal")}
                  {...register("valor_manual_kcal")}
                />
              )}
            </div>
            {formula && !fatoresAplicam && (
              <p className="text-xs text-muted-foreground">
                {eer ? "A EER já dá o gasto total (de 0 a 2 anos, sem nível de atividade)." : "Esta opção já é o gasto total."} O
                fator de atividade e o fator injúria não se aplicam.
              </p>
            )}
          </Bloco>

          <Bloco titulo="3. Ajustes refinados">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <CaixaBotao
                rotulo="Adicional calórico por MET (kcal/dia)"
                valor={qtdAtividades ? `+${fmt(Math.round(ajusteMet))} · ${qtdAtividades} ${qtdAtividades === 1 ? "atividade" : "atividades"}` : null}
                vazio="Programar MET"
                onClick={() => setJanela("met")}
              />
              <CaixaBotao
                rotulo="Programar peso por VENTA (kcal/dia)"
                valor={ajusteVenta ? `${ajusteVenta > 0 ? "+" : "−"}${fmt(Math.abs(Math.round(ajusteVenta)))}` : null}
                vazio="Programar peso"
                onClick={() => setJanela("venta")}
              />
              <CaixaBotao
                rotulo="Adicional energético de gestante"
                valor={ajusteGestante ? `+${fmt(Math.round(ajusteGestante))}` : null}
                vazio="Incluir adicional"
                onClick={() => setJanela("gestante")}
              />
            </div>
          </Bloco>

          {mostrarObs ? (
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">Observações</h3>
              <Textarea id="observacoes" aria-label="Observações" rows={3} {...register("observacoes")} />
            </div>
          ) : (
            <LinkTexto onClick={() => setMostrarObs(true)}>+ Adicionar observações</LinkTexto>
          )}

          <div className="space-y-2">
            <AutoSaveStatus estado={estado} erro={erroSalvamento} />
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar e voltar
            </Button>
          </div>
        </CardContent>
      </Card>

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
            {!resultado.motivo && (
              <Composicao entradas={entradas} tmb={resultado.tmb} adicionais={resultado.adicionais} fatoresAplicam={fatoresAplicam} />
            )}
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
                            onClick={() => alterar("formula", c.f)}
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

const selectSemBorda = "h-7 border-0 bg-transparent px-0 shadow-none focus:ring-0 focus:ring-offset-0";

/** Caixa no estilo do WebDiet: rótulo pequeno em cima, valor embaixo; o foco destaca a caixa inteira. */
function Caixa({
  rotulo,
  children,
  desativada = false,
  erro,
  className,
}: {
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
          "rounded-lg border border-input bg-card px-3 pb-1 pt-2 focus-within:ring-2 focus-within:ring-ring",
          desativada && "opacity-50",
          erro && "border-destructive"
        )}
      >
        <p className="text-xs text-muted-foreground">{rotulo}</p>
        {children}
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
  rotulo,
  id,
  erro,
  ...input
}: { rotulo: string; id: string; erro?: string } & React.InputHTMLAttributes<HTMLInputElement> & {
    ref?: React.Ref<HTMLInputElement>;
  }) {
  return (
    <Caixa rotulo={rotulo} erro={erro}>
      <label htmlFor={id} className="sr-only">
        {rotulo}
      </label>
      <input
        id={id}
        inputMode="decimal"
        aria-invalid={erro ? true : undefined}
        className="h-7 w-full bg-transparent text-sm text-foreground outline-none"
        {...input}
      />
    </Caixa>
  );
}

/** Caixa que abre uma janela (ajustes refinados). */
function CaixaBotao({ rotulo, valor, vazio, onClick }: { rotulo: string; valor: string | null; vazio: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-input bg-card px-3 pb-2 pt-2 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="block text-xs text-muted-foreground">{rotulo}</span>
      <span className={cn("block pt-1 text-sm", valor ? "font-medium text-foreground" : "text-foreground")}>{valor ?? vazio}</span>
    </button>
  );
}

function Bloco({ titulo, acao, children }: { titulo: string; acao?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-foreground">{titulo}</h3>
        {acao}
      </div>
      {children}
    </section>
  );
}

function LinkTexto({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:underline"
    >
      {children}
    </button>
  );
}

function Aviso({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-sm">{children}</p>;
}

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
