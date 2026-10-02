"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowUpDown, Loader2, Plus, Repeat, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { Food, FoodMeasure, MealItem, MealItemSubstitution } from "@/lib/types/database.types";
import { calculateMealItemMacros, FONTE_LABELS, type MacroTotals } from "@/lib/nutrition";
import { formatarMedida, medidaUsual, quantidadeDoItem } from "@/lib/household-measures";
import {
  arredondarQuantidade,
  CRITERIOS,
  gramasEquivalentes,
  macrosEm,
  type CriterioEquivalencia,
} from "@/lib/substitutions";
import {
  addMealItemSubstitution,
  deleteMealItemSubstitution,
  inverterSubstituto,
  sugerirSubstitutos,
  type SugestaoSubstituto,
} from "@/lib/actions/meal-item-substitutions";
import { medidasDosAlimentos } from "@/lib/actions/meal-food-search";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FoodCombobox } from "@/components/meal-plans/food-combobox";

interface MealItemSubstitutionsDialogProps {
  planId: string;
  item: MealItem;
  substitutions: MealItemSubstitution[];
}

const fmt = (v: number, casas = 1) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const GRAMAS = "g";

/**
 * Substitutos de um alimento do plano (Fase 17, Bloco E), como no WebDiet:
 * original e substitutos lado a lado (quantidade, kcal e macros), quantidade
 * equivalente por calorias, carboidrato ou proteína, sugestões rápidas do
 * mesmo grupo, "inverter" e medida caseira.
 */
export function MealItemSubstitutionsDialog({ planId, item, substitutions }: MealItemSubstitutionsDialogProps) {
  const [open, setOpen] = useState(false);
  const [criterio, setCriterio] = useState<CriterioEquivalencia>("kcal");
  // Sugestões guardadas com a chave da busca; chave diferente da atual = ainda carregando.
  const [resposta, setResposta] = useState<{ chave: string; lista: SugestaoSubstituto[] } | null>(null);
  const [isPending, startTransition] = useTransition();
  const isReceita = item.recipe_id !== null;
  const original = calculateMealItemMacros(item);
  // substitutions.length: depois de adicionar, a sugestão usada sai da lista.
  const chave = `${item.id}|${criterio}|${substitutions.length}`;
  const sugestoes = resposta?.chave === chave ? resposta.lista : null;

  useEffect(() => {
    if (!open || isReceita) return;
    let ativo = true;
    void sugerirSubstitutos(item.id, criterio).then((lista) => ativo && setResposta({ chave, lista }));
    return () => {
      ativo = false;
    };
  }, [open, chave, criterio, item.id, isReceita]);

  function rodar(acao: () => Promise<{ success: boolean; message?: string }>, sucesso?: string) {
    startTransition(async () => {
      const r = await acao();
      if (!r.success) toast.error("Não foi possível concluir", { description: r.message });
      else if (sucesso ?? r.message) toast.success(sucesso ?? r.message);
    });
  }

  function adicionarSugestao(s: SugestaoSubstituto) {
    rodar(() =>
      addMealItemSubstitution(planId, item.id, {
        food_id: s.foodId,
        quantidade_g: s.gramas,
        ...(s.medida && s.medidaQuantidade ? { medida_id: s.medida.id, medida_quantidade: s.medidaQuantidade } : {}),
      }),
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title="Substitutos"
          aria-label={`Substitutos de ${item.nome_alimento}`}
          className="relative"
        >
          <Repeat className="h-4 w-4 text-muted-foreground" />
          {substitutions.length > 0 && (
            <span className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-primary-600 text-[10px] text-white">
              {substitutions.length}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Substitutos de {item.nome_alimento}</DialogTitle>
          <DialogDescription>Opções que o paciente pode usar no lugar deste alimento.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Equivaler por</span>
          <div className="flex gap-1.5" role="radiogroup" aria-label="Equivaler por">
            {CRITERIOS.map((c) => (
              <Button
                key={c.valor}
                type="button"
                size="sm"
                role="radio"
                aria-checked={criterio === c.valor}
                variant={criterio === c.valor ? "default" : "outline"}
                className="h-7 text-xs"
                onClick={() => setCriterio(c.valor)}
              >
                {c.rotulo}
              </Button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr className="text-left">
                <th className="px-2 py-1.5 font-medium">Alimento</th>
                <th className="px-2 py-1.5 font-medium">Quantidade</th>
                <th className="px-2 py-1.5 text-right font-medium">kcal</th>
                <th className="px-2 py-1.5 text-right font-medium">PTN</th>
                <th className="px-2 py-1.5 text-right font-medium">CHO</th>
                <th className="px-2 py-1.5 text-right font-medium">LIP</th>
                <th className="w-20 px-2 py-1.5" aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              <LinhaComparacao
                nome={item.nome_alimento}
                rotulo="Original"
                quantidade={quantidadeDoItem(item)}
                macros={original}
                destaque
              />
              {substitutions.map((sub) => (
                <LinhaComparacao
                  key={sub.id}
                  nome={sub.nome_alimento}
                  rotulo={FONTE_LABELS[sub.fonte_alimento]}
                  quantidade={quantidadeDoItem(sub)}
                  macros={calculateMealItemMacros(sub)}
                  original={original}
                  criterio={criterio}
                >
                  {!isReceita && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Inverter: este vira o alimento do plano"
                      aria-label={`Inverter: ${sub.nome_alimento} vira o alimento do plano`}
                      disabled={isPending}
                      onClick={() => rodar(() => inverterSubstituto(planId, sub.id))}
                    >
                      <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label={`Remover substituto ${sub.nome_alimento}`}
                    disabled={isPending}
                    onClick={() => rodar(() => deleteMealItemSubstitution(planId, sub.id))}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </LinhaComparacao>
              ))}
            </tbody>
          </table>
        </div>
        {substitutions.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum substituto ainda. Escolha uma sugestão ou busque abaixo.
          </p>
        )}

        {!isReceita && (
          <section aria-labelledby={`sugestoes-${item.id}`} className="space-y-2">
            <h3 id={`sugestoes-${item.id}`} className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Sparkles className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Sugestões rápidas
            </h3>
            {sugestoes === null ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Buscando sugestões" />
            ) : sugestoes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma sugestão do mesmo grupo para este alimento.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {sugestoes.map((s) => (
                  <Button
                    key={s.foodId}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-auto max-w-full whitespace-normal py-1 text-left text-xs"
                    disabled={isPending}
                    onClick={() => adicionarSugestao(s)}
                    title="Adicionar como substituto"
                  >
                    <Plus className="h-3 w-3 shrink-0" />
                    <span>
                      {s.nome} —{" "}
                      {s.medida && s.medidaQuantidade
                        ? formatarMedida(s.medidaQuantidade, s.medida.nome, s.medida.gramas)
                        : `${fmt(s.gramas, 0)} g`}{" "}
                      · {fmt(s.macros.calorias, 0)} kcal
                    </span>
                  </Button>
                ))}
              </div>
            )}
          </section>
        )}

        <BuscarSubstituto planId={planId} item={item} original={original} criterio={criterio} />
      </DialogContent>
    </Dialog>
  );
}

function LinhaComparacao({
  nome,
  rotulo,
  quantidade,
  macros,
  original,
  criterio,
  destaque,
  children,
}: {
  nome: string;
  rotulo: string;
  quantidade: string;
  macros: MacroTotals;
  original?: MacroTotals;
  criterio?: CriterioEquivalencia;
  destaque?: boolean;
  children?: React.ReactNode;
}) {
  const celulas: { chave: CriterioEquivalencia | "gorduras"; valor: number; casas: number }[] = [
    { chave: "kcal", valor: macros.calorias, casas: 0 },
    { chave: "proteinas", valor: macros.proteinas, casas: 1 },
    { chave: "carboidratos", valor: macros.carboidratos, casas: 1 },
    { chave: "gorduras", valor: macros.gorduras, casas: 1 },
  ];
  const doOriginal = (c: string) =>
    !original
      ? 0
      : c === "kcal"
        ? original.calorias
        : c === "proteinas"
          ? original.proteinas
          : c === "carboidratos"
            ? original.carboidratos
            : original.gorduras;

  return (
    <tr className={cn("border-t border-border/60", destaque && "bg-primary-50/60 font-medium dark:bg-primary-950/30")}>
      <td className="px-2 py-1.5">
        <span className="text-foreground">{nome}</span>{" "}
        <Badge variant={destaque ? "default" : "secondary"} className="ml-1 align-middle text-[10px]">
          {rotulo}
        </Badge>
      </td>
      <td className="px-2 py-1.5 text-muted-foreground">{quantidade}</td>
      {celulas.map((c) => {
        const diferenca = original ? c.valor - doOriginal(c.chave) : 0;
        return (
          <td
            key={c.chave}
            className={cn("px-2 py-1.5 text-right tabular-nums", criterio === c.chave && "font-semibold")}
          >
            {fmt(c.valor, c.casas)}
            {original && Math.abs(diferenca) >= (c.casas ? 0.05 : 0.5) && (
              <span className="block text-[10px] font-normal text-muted-foreground">
                {diferenca > 0 ? "+" : "−"}
                {fmt(Math.abs(diferenca), c.casas)}
              </span>
            )}
          </td>
        );
      })}
      <td className="px-2 py-1.5">
        <div className="flex justify-end gap-0.5">{children}</div>
      </td>
    </tr>
  );
}

/** Busca livre: escolhe o alimento, já vem a quantidade equivalente (em medida caseira, se houver). */
function BuscarSubstituto({
  planId,
  item,
  original,
  criterio,
}: {
  planId: string;
  item: MealItem;
  original: MacroTotals;
  criterio: CriterioEquivalencia;
}) {
  const [food, setFood] = useState<Food | null>(null);
  const [medidas, setMedidas] = useState<FoodMeasure[]>([]);
  const [unidade, setUnidade] = useState(GRAMAS);
  // O que o profissional digitou vale só para o critério e a unidade em que digitou;
  // trocou um dos dois, volta a quantidade equivalente sugerida.
  const [digitada, setDigitada] = useState<{ valor: string; criterio: string; unidade: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const medida = medidas.find((m) => m.id === unidade) ?? null;
  const equivalente = food ? gramasEquivalentes(original, food, criterio) : null;
  const sugerida =
    equivalente === null ? null : arredondarQuantidade(equivalente, medida ? { gramas: Number(medida.gramas) } : null);
  const quantidade =
    digitada && digitada.criterio === criterio && digitada.unidade === unidade
      ? digitada.valor
      : sugerida
        ? String(sugerida.medidaQuantidade ?? sugerida.gramas)
        : "";
  const setQuantidade = (valor: string) => setDigitada({ valor, criterio, unidade });

  function escolher(f: Food | null) {
    setFood(f);
    setMedidas([]);
    setUnidade(GRAMAS);
    setDigitada(null);
    if (!f) return;
    startTransition(async () => {
      const lista = (await medidasDosAlimentos([f.id]))[f.id] ?? [];
      setMedidas(lista);
      setUnidade(medidaUsual(lista)?.id ?? GRAMAS);
    });
  }

  const gramas = (Number(quantidade.replace(",", ".")) || 0) * (medida ? Number(medida.gramas) : 1);

  function adicionar() {
    if (!food || !(gramas > 0)) {
      toast.error("Informe uma quantidade maior que zero.");
      return;
    }
    startTransition(async () => {
      const r = await addMealItemSubstitution(planId, item.id, {
        food_id: food.id,
        quantidade_g: Math.round(gramas * 100) / 100,
        ...(medida ? { medida_id: medida.id, medida_quantidade: Number(quantidade.replace(",", ".")) } : {}),
      });
      if (!r.success) {
        toast.error("Não foi possível adicionar", { description: r.message });
        return;
      }
      toast.success("Substituto adicionado.");
      setFood(null);
      setDigitada(null);
      setMedidas([]);
    });
  }

  return (
    <section className="space-y-2 border-t border-border pt-3" aria-label="Buscar outro substituto">
      <p className="text-sm font-medium text-foreground">Buscar outro alimento</p>
      <FoodCombobox value={food} onChange={escolher} disabled={isPending} />
      {food && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="number"
              step={medida ? "0.5" : "1"}
              className="h-8 w-20"
              aria-label={`Quantidade do substituto (${medida ? "medidas" : "g"})`}
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              disabled={isPending}
            />
            <select
              value={unidade}
              aria-label="Unidade do substituto"
              disabled={isPending}
              className="h-8 max-w-56 rounded-md border border-input bg-background px-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onChange={(e) => setUnidade(e.target.value)}
            >
              <option value={GRAMAS}>g</option>
              {medidas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome} ({fmt(Number(m.gramas), 0)} g)
                </option>
              ))}
            </select>
            {medida && <span className="text-xs tabular-nums text-muted-foreground">= {fmt(gramas)} g</span>}
            <Button type="button" size="sm" onClick={adicionar} disabled={isPending || !(gramas > 0)}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Adicionar
            </Button>
          </div>
          {gramas > 0 && (
            <div className="overflow-x-auto rounded-md border border-dashed border-border">
              <table className="w-full text-sm">
                <tbody>
                  <LinhaComparacao
                    nome={food.nome}
                    rotulo="Prévia"
                    quantidade={
                      medida
                        ? formatarMedida(Number(quantidade.replace(",", ".")), medida.nome, Number(medida.gramas))
                        : `${fmt(gramas, 0)} g`
                    }
                    macros={macrosEm(food, gramas)}
                    original={original}
                    criterio={criterio}
                  />
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            A quantidade já vem equivalente ao original pelo critério escolhido — ajuste se quiser.
          </p>
        </>
      )}
    </section>
  );
}
