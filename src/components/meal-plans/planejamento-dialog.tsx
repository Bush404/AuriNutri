"use client";

import { useState, useTransition } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { distribuirMacros, equivalencias, type ModoDistribuicao } from "@/lib/meal-planning";
import { removerPlanejamentoTeorico, salvarPlanejamentoTeorico } from "@/lib/actions/meal-plans";
import type { MealPlan } from "@/lib/types/database.types";
import { formatDate } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface CalculoParaImportar {
  id: string;
  nome: string | null;
  data_calculo: string;
  get_kcal: number;
  peso_kg: number | null;
}

const fmt = (v: number, casas = 1) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const texto = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v).replace(".", ","));
const num = (v: string): number | null => {
  if (!v.trim()) return null;
  const x = Number(v.replace(",", "."));
  return Number.isFinite(x) ? x : null;
};

interface Props {
  planId: string;
  patientId: string;
  plan: Pick<
    MealPlan,
    | "meta_kcal"
    | "planejamento_modo"
    | "planejamento_peso_kg"
    | "planejamento_proteinas"
    | "planejamento_lipidios"
    | "planejamento_carboidratos"
    | "planejamento_calculo_id"
  >;
  pesoPaciente: number | null;
  calculos: CalculoParaImportar[];
  onClose: () => void;
}

/** "Referências de cálculos energéticos" do WebDiet: importar da aba Cálculo energético e distribuir os macros. */
export function PlanejamentoDialog({ planId, patientId, plan, pesoPaciente, calculos, onClose }: Props) {
  const [modo, setModo] = useState<ModoDistribuicao>(plan.planejamento_modo ?? "g_kg");
  const [peso, setPeso] = useState(texto(plan.planejamento_peso_kg ?? pesoPaciente));
  const [get, setGet] = useState(texto(plan.planejamento_modo === "percentual" ? plan.meta_kcal : null));
  const [ptn, setPtn] = useState(texto(plan.planejamento_proteinas));
  const [lip, setLip] = useState(texto(plan.planejamento_lipidios));
  const [cho, setCho] = useState(texto(plan.planejamento_carboidratos));
  const [calculoId, setCalculoId] = useState<string | null>(plan.planejamento_calculo_id);
  const [importando, setImportando] = useState(false);
  const [salvando, startSalvar] = useTransition();

  const importado = calculos.find((c) => c.id === calculoId) ?? null;
  const r = distribuirMacros({
    modo,
    pesoKg: num(peso),
    getKcal: num(get),
    proteinas: num(ptn),
    lipidios: num(lip),
    carboidratos: num(cho),
  });
  const eq = r.ok ? equivalencias(r.metas, num(peso)) : null;
  const unidade = modo === "g_kg" ? "g/kg corporal" : "% do GET";

  function importar(c: CalculoParaImportar) {
    setCalculoId(c.id);
    if (c.peso_kg) setPeso(texto(c.peso_kg));
    setGet(texto(Math.round(c.get_kcal)));
    setImportando(false);
  }

  function salvar() {
    startSalvar(async () => {
      const res = await salvarPlanejamentoTeorico(planId, {
        modo,
        peso_kg: num(peso) ?? undefined,
        get_kcal: modo === "percentual" ? num(get) ?? undefined : undefined,
        proteinas: num(ptn) ?? "",
        lipidios: num(lip) ?? "",
        carboidratos: num(cho) ?? "",
        calculo_id: calculoId ?? undefined,
      });
      if (!res.success) {
        toast.error("Não foi possível salvar o planejamento", { description: res.message });
        return;
      }
      toast.success("Planejamento teórico salvo.");
      onClose();
    });
  }

  function remover() {
    startSalvar(async () => {
      const res = await removerPlanejamentoTeorico(planId);
      if (!res.success) {
        toast.error("Não foi possível remover", { description: res.message });
        return;
      }
      toast.success("Planejamento teórico removido.");
      onClose();
    });
  }

  const campo = (id: string, rotulo: string, sub: string, value: string, set: (v: string) => void, disabled = false) => (
    <div className="flex items-center justify-between gap-3 rounded-md bg-muted/50 px-4 py-3">
      <Label htmlFor={id} className="text-sm font-medium">
        {rotulo}
        <span className="block text-xs font-normal text-muted-foreground">{sub}</span>
      </Label>
      <Input
        id={id}
        inputMode="decimal"
        className="h-10 w-28 bg-card text-right"
        value={value}
        disabled={disabled}
        onChange={(e) => set(e.target.value)}
      />
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && !salvando && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Referências de cálculos energéticos</DialogTitle>
          <DialogDescription>O planejamento vira o &quot;teórico&quot; da análise do cardápio.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          <Button type="button" className="w-full" onClick={() => setImportando((x) => !x)} aria-expanded={importando}>
            <Download className="h-4 w-4" />
            Importar dados da aba cálculos
          </Button>
          {importando &&
            (calculos.length === 0 ? (
              <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                Nenhum cálculo energético salvo para este paciente. Faça um na aba{" "}
                <a className="underline" href={`/pacientes/${patientId}?aba=calculo-energetico`}>
                  Cálculo energético
                </a>
                .
              </p>
            ) : (
              <ul className="space-y-2">
                {calculos.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => importar(c)}
                      className="w-full rounded-md bg-muted/60 px-3 py-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="font-medium text-foreground">{c.nome || "Sem nome"}</span>
                      <span className="block text-muted-foreground">
                        {fmt(Math.round(c.get_kcal), 0)} kcal/dia · {formatDate(c.data_calculo)}
                        {c.peso_kg ? ` · ${fmt(c.peso_kg)} kg` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ))}
          {importado && (
            <p className="text-xs text-muted-foreground">
              Importado: {importado.nome || "Sem nome"} ({formatDate(importado.data_calculo)}) — GET de {fmt(Math.round(importado.get_kcal), 0)}{" "}
              kcal/dia.
            </p>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Distribuição dos macronutrientes</Label>
            <Select value={modo} onValueChange={(x) => setModo(x as ModoDistribuicao)}>
              <SelectTrigger aria-label="Distribuição dos macronutrientes">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="g_kg">Distribuir usando fórmula de bolso (g/kg)</SelectItem>
                <SelectItem value="percentual">Distribuir usando percentual do GET</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {campo("plan_peso", "Peso do paciente", "Atual, em kg", peso, setPeso)}
          {campo("plan_ptn", "Proteínas totais", `(${unidade})`, ptn, setPtn)}
          {campo("plan_lip", "Lipídios totais", `(${unidade})`, lip, setLip)}
          {campo("plan_cho", "Carboidratos totais", `(${unidade})`, cho, setCho)}
          {modo === "g_kg"
            ? campo("plan_get", "Gasto energético total", "(kcal/dia) — soma dos macros", r.ok ? fmt(Math.round(r.metas.kcal), 0) : "", () => {}, true)
            : campo("plan_get", "Gasto energético total", "(kcal/dia)", get, setGet)}

          {modo === "g_kg" && importado && r.ok && (
            <p className="text-xs text-muted-foreground">
              Diferença para o GET importado: {r.metas.kcal - importado.get_kcal >= 0 ? "+" : "−"}
              {fmt(Math.abs(Math.round(r.metas.kcal - importado.get_kcal)), 0)} kcal.
            </p>
          )}

          <div className="rounded-md border border-border px-4 py-3 text-sm" role="status" aria-live="polite">
            {r.ok && eq ? (
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="pb-1 font-medium">Teórico</th>
                    <th className="pb-1 text-right font-medium">g</th>
                    <th className="pb-1 text-right font-medium">g/kg</th>
                    <th className="pb-1 text-right font-medium">%</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {(
                    [
                      ["Proteínas", r.metas.proteinas_g, eq.proteinas],
                      ["Lipídios", r.metas.lipidios_g, eq.lipidios],
                      ["Carboidratos", r.metas.carboidratos_g, eq.carboidratos],
                    ] as const
                  ).map(([rotulo, g, e]) => (
                    <tr key={rotulo}>
                      <td className="py-0.5">{rotulo}</td>
                      <td className="py-0.5 text-right">{fmt(g)}</td>
                      <td className="py-0.5 text-right">{e.gkg === null ? "—" : fmt(e.gkg, 2)}</td>
                      <td className="py-0.5 text-right">{e.pct === null ? "—" : fmt(e.pct)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-border font-medium">
                    <td className="pt-1">Total</td>
                    <td className="pt-1 text-right" colSpan={3}>
                      {fmt(Math.round(r.metas.kcal), 0)} kcal{eq.kcalPorKg !== null && ` · ${fmt(eq.kcalPorKg)} kcal/kg`}
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p className="text-muted-foreground">{r.ok ? "" : r.motivo}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button type="button" className="w-full" disabled={!r.ok || salvando} onClick={salvar}>
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmar
          </Button>
          {plan.meta_kcal !== null && (
            <Button type="button" variant="ghost" className="w-full" disabled={salvando} onClick={remover}>
              Remover planejamento teórico
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
