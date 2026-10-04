"use client";

import { useState, useTransition } from "react";
import { Clock, Loader2, Trash2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";

import type { FoodMeasure } from "@/lib/types/database.types";
import type { ResultadoBusca } from "@/lib/actions/meal-food-search";
import { previaParaRefeicao, salvarRefeicao } from "@/lib/actions/meal-editor";
import { deleteMeal } from "@/lib/actions/meals";
import {
  linhasInvalidas,
  novaChave,
  payloadDoRascunho,
  textoDeNumero,
  pesoDoRascunho,
  rascunhoAlterado,
  rascunhoDaRefeicao,
  totaisDoRascunho,
  usarSubstituto,
  type ItemRascunho,
  type RefeicaoRascunho,
} from "@/lib/meal-draft";
import { cn } from "@/lib/utils";
import { useUnsavedChangesWarning } from "@/lib/hooks/use-unsaved-changes-warning";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
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
import { RichTextEditor } from "@/components/shared/rich-text-editor";
import { useMedidasDoPlano } from "@/components/meal-plans/medidas-context";
import type { MealWithItemsAndSubstitutions } from "@/components/meal-plans/meal-card";
import { MealEditorSearch } from "@/components/meal-plans/meal-editor-search";
import { GRADE_ALIMENTOS, MealEditorItem, type CarregarPrevia } from "@/components/meal-plans/meal-editor-line";
import { MealEditorSummary } from "@/components/meal-plans/meal-editor-summary";

const fmt = (v: number, casas = 0) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

/**
 * Janela "Editar refeição" (Fase 19): busca e alimentos à esquerda, resumo e
 * observações à direita. Tudo fica em rascunho (src/lib/meal-draft.ts) até
 * "Salvar alterações"; fechar com algo não salvo pede confirmação, e fechar a
 * aba do navegador também avisa.
 */
export function MealEditorDialog({
  open,
  onOpenChange,
  planId,
  meal,
  nome,
  horario,
  onSalvo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
  meal: MealWithItemsAndSubstitutions;
  /** Nome e horário como estão na linha (podem ter acabado de ser editados lá). */
  nome: string;
  horario: string;
  onSalvo: (nome: string, horario: string) => void;
}) {
  // Monta só aberta: cada abertura começa um rascunho novo a partir do que está gravado.
  return open ? (
    <Editor planId={planId} meal={meal} nome={nome} horario={horario} onFechar={() => onOpenChange(false)} onSalvo={onSalvo} />
  ) : null;
}

function Editor({
  planId,
  meal,
  nome,
  horario,
  onFechar,
  onSalvo,
}: {
  planId: string;
  meal: MealWithItemsAndSubstitutions;
  nome: string;
  horario: string;
  onFechar: () => void;
  onSalvo: (nome: string, horario: string) => void;
}) {
  const doGravado = () => rascunhoDaRefeicao({ nome, horario, observacoes: meal.observacoes ?? "", items: meal.items });
  const [inicial, setInicial] = useState<RefeicaoRascunho>(doGravado);
  const [r, setR] = useState(inicial);
  // Os dados do servidor podem chegar depois de abrir (ex.: reabrir logo após
  // salvar): sem nada alterado ainda, o rascunho acompanha o que foi gravado.
  const [mealVisto, setMealVisto] = useState(meal);
  if (meal !== mealVisto) {
    setMealVisto(meal);
    if (!rascunhoAlterado(inicial, r)) {
      const novo = doGravado();
      setInicial(novo);
      setR(novo);
    }
  }
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [salvando, startSalvar] = useTransition();
  const [excluindo, startExcluir] = useTransition();
  const medidasDoPlano = useMedidasDoPlano();
  const [medidasNovas, setMedidasNovas] = useState<Record<string, FoodMeasure[]>>({});

  const alterado = rascunhoAlterado(inicial, r);
  const invalidas = linhasInvalidas(r);
  const totais = totaisDoRascunho(r);
  const semNome = r.nome.trim() === "";

  // Fechar a aba do navegador (ou sair por um link) com alterações não salvas: pergunta antes.
  useUnsavedChangesWarning(alterado && !salvando, "Você tem alterações não salvas nesta refeição. Deseja sair mesmo assim?");

  function tentarFechar() {
    if (alterado && !salvando) setConfirmarSaida(true);
    else onFechar();
  }

  const apoio = {
    planId,
    medidasDe: (foodId: string | null) => (foodId ? (medidasNovas[foodId] ?? medidasDoPlano[foodId] ?? []) : []),
    onMedidaCriada: (foodId: string, m: FoodMeasure) =>
      setMedidasNovas((x) => ({ ...x, [foodId]: [...(x[foodId] ?? medidasDoPlano[foodId] ?? []), m] })),
    onMedidaExcluida: (foodId: string, id: string) =>
      setMedidasNovas((x) => ({ ...x, [foodId]: (x[foodId] ?? medidasDoPlano[foodId] ?? []).filter((m) => m.id !== id) })),
  };

  const carregarPrevia: CarregarPrevia = async (fonte) => {
    const p = await previaParaRefeicao(fonte);
    if (!p.success) {
      toast.error("Não foi possível adicionar", { description: p.message });
      return null;
    }
    if (fonte.de === "alimento") setMedidasNovas((x) => ({ ...x, [fonte.food_id]: p.medidas }));
    return p;
  };

  async function adicionarDaBusca(res: ResultadoBusca) {
    const fonte = res.tipo === "alimento" ? ({ de: "alimento", food_id: res.id } as const) : ({ de: "receita", recipe_id: res.id } as const);
    const p = await carregarPrevia(fonte);
    if (!p) return;
    const novo: ItemRascunho = {
      chave: novaChave(),
      id: null,
      fonte,
      snapshot: p.snapshot,
      // Alimento entra em 1 medida caseira usual (ou na porção de referência); receita, em 1 porção.
      quantidade:
        res.tipo === "receita"
          ? { tipo: "porcoes", texto: "1" }
          : res.medida
            ? { tipo: "medida", texto: "1", medida_id: res.medida.id, nome: res.medida.nome, gramas: res.medida.gramas }
            : { tipo: "g", texto: textoDeNumero(res.porcaoG) },
      substitutos: [],
    };
    setR((atual) => ({ ...atual, itens: [...atual.itens, novo] }));
  }

  const setItem = (chave: string, novo: ItemRascunho) =>
    setR((atual) => ({ ...atual, itens: atual.itens.map((i) => (i.chave === chave ? novo : i)) }));

  function salvar() {
    if (semNome) return toast.error("Informe o nome da refeição.");
    if (invalidas.length) return toast.error("Confira as quantidades", { description: invalidas.join(", ") });
    startSalvar(async () => {
      const res = await salvarRefeicao(planId, meal.id, payloadDoRascunho(r));
      if (!res.success) {
        toast.error("Não foi possível salvar", { description: res.message });
        return;
      }
      toast.success("Refeição salva.");
      onSalvo(r.nome.trim(), r.horario);
      onFechar();
    });
  }

  function excluir() {
    startExcluir(async () => {
      const res = await deleteMeal(planId, meal.id);
      if (!res.success) {
        toast.error("Não foi possível excluir a refeição", { description: res.message });
        return;
      }
      setConfirmarExclusao(false);
      onFechar();
    });
  }

  return (
    <>
      <Dialog open onOpenChange={(v) => !v && tentarFechar()}>
        <DialogContent className="flex h-[min(94dvh,960px)] w-[calc(100%-1rem)] max-w-[1440px] flex-col gap-0 overflow-hidden p-0 sm:w-[calc(100%-2rem)]">
          {/* Cabeçalho: título à esquerda; horário e nome da refeição à direita. */}
          <div className="flex flex-col gap-4 border-b border-border px-5 py-4 pr-12 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-success-soft text-primary">
                <UtensilsCrossed className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <DialogTitle className="text-xl font-bold">Editar refeição</DialogTitle>
                <DialogDescription>Adicione, remova ou ajuste os alimentos desta refeição.</DialogDescription>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="space-y-1">
                <Label htmlFor={`editor-horario-${meal.id}`} className="text-xs text-muted-foreground">
                  Horário
                </Label>
                <div className="relative">
                  <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id={`editor-horario-${meal.id}`}
                    type="time"
                    value={r.horario}
                    onChange={(e) => setR((a) => ({ ...a, horario: e.target.value }))}
                    className="h-10 w-32 pl-9 tabular-nums"
                  />
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-1 sm:w-64 sm:flex-none">
                <Label htmlFor={`editor-nome-${meal.id}`} className="text-xs text-muted-foreground">
                  Nome da refeição
                </Label>
                <Input
                  id={`editor-nome-${meal.id}`}
                  value={r.nome}
                  maxLength={120}
                  aria-invalid={semNome || undefined}
                  onChange={(e) => setR((a) => ({ ...a, nome: e.target.value }))}
                  className={cn("h-10 font-medium", semNome && "border-destructive")}
                />
              </div>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_360px] lg:overflow-hidden">
            <div className="space-y-6 p-5 lg:overflow-y-auto">
              <MealEditorSearch onAdicionar={adicionarDaBusca} />

              <section aria-labelledby={`alimentos-${meal.id}`} className="space-y-3">
                <div>
                  <h3 id={`alimentos-${meal.id}`} className="text-lg font-semibold text-foreground">
                    Alimentos da refeição
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {r.itens.length} {r.itens.length === 1 ? "alimento" : "alimentos"} ·{" "}
                    <span className="font-semibold tabular-nums text-primary">{fmt(Math.round(totais.calorias))} kcal</span>
                  </p>
                </div>

                {r.itens.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                    Nenhum alimento ainda. Busque acima e clique em <strong>Adicionar</strong>.
                  </p>
                ) : (
                  <>
                    <div
                      className={cn(
                        "hidden px-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground",
                        GRADE_ALIMENTOS,
                      )}
                      aria-hidden="true"
                    >
                      <span>Alimento</span>
                      <span>Qtd.</span>
                      <span className="text-right">kcal</span>
                      <span className="text-right">Prot.</span>
                      <span className="text-right">Carb.</span>
                      <span className="text-right">Gord.</span>
                      <span className="text-right">Ações</span>
                    </div>
                    <ul className="space-y-2">
                      {r.itens.map((item) => (
                        <MealEditorItem
                          key={item.chave}
                          item={item}
                          apoio={apoio}
                          carregarPrevia={carregarPrevia}
                          onChange={(novo) => setItem(item.chave, novo)}
                          onRemover={() => setR((a) => ({ ...a, itens: a.itens.filter((i) => i.chave !== item.chave) }))}
                          onUsar={(subChave) => setR((a) => usarSubstituto(a, item.chave, subChave))}
                        />
                      ))}
                    </ul>
                  </>
                )}
              </section>
            </div>

            <aside className="space-y-4 border-t border-border bg-muted/30 p-5 lg:overflow-y-auto lg:border-l lg:border-t-0">
              <MealEditorSummary totais={totais} pesoG={pesoDoRascunho(r)} />
              <section className="space-y-2 rounded-xl border border-border bg-card p-4" aria-labelledby={`obs-${meal.id}`}>
                <h3 id={`obs-${meal.id}`} className="font-semibold text-foreground">
                  Observações da refeição
                </h3>
                <RichTextEditor
                  value={inicial.observacoes}
                  onChange={(html) => setR((a) => ({ ...a, observacoes: html }))}
                  ariaLabel="Observações da refeição"
                />
                <p className="text-xs text-muted-foreground">Opcional. Sai no PDF do plano, abaixo da refeição.</p>
              </section>
            </aside>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-3 sm:px-5">
            <Button
              type="button"
              variant="outline"
              className="border-destructive/30 px-3 text-destructive hover:bg-destructive/10 hover:text-destructive sm:px-4"
              onClick={() => setConfirmarExclusao(true)}
              disabled={salvando || excluindo}
              aria-label="Excluir refeição"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Excluir refeição</span>
            </Button>
            <div className="flex items-center justify-end gap-2">
              <span className="mr-1 hidden text-xs text-muted-foreground md:inline" role="status">
                {alterado ? "Alterações não salvas" : "Nenhuma alteração"}
              </span>
              <Button type="button" variant="outline" onClick={tentarFechar} disabled={salvando}>
                Cancelar
              </Button>
              <Button type="button" onClick={salvar} disabled={!alterado || salvando}>
                {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar alterações
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmarSaida} onOpenChange={setConfirmarSaida}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair sem salvar?</AlertDialogTitle>
            <AlertDialogDescription>
              Você fez alterações nesta refeição que ainda não foram salvas. Se sair agora, elas serão perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setConfirmarSaida(false);
                onFechar();
              }}
            >
              Sair sem salvar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmarExclusao} onOpenChange={setConfirmarExclusao}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir refeição</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{meal.nome}</strong> e todos os alimentos adicionados a ela?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                excluir();
              }}
              disabled={excluindo}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
