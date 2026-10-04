"use client";

import { useEffect, useState } from "react";
import { ArrowLeftRight, ChevronDown, Info, Loader2, Plus, Repeat, Sparkles, Trash2 } from "lucide-react";

import type { FoodMeasure } from "@/lib/types/database.types";
import type { ResultadoBusca } from "@/lib/actions/meal-food-search";
import { FONTE_LABELS, type MacroTotals } from "@/lib/nutrition";
import { formatarMedida, medidaUsual } from "@/lib/household-measures";
import { arredondarQuantidade, CRITERIOS, gramasEquivalentes, type CriterioEquivalencia } from "@/lib/substitutions";
import {
  gramasDaLinha,
  macrosDaLinha,
  novaChave,
  quantidadeInvalida,
  textoDeNumero,
  trocarUnidade,
  type FonteSnapshot,
  type ItemRascunho,
  type LinhaRascunho,
  type QuantidadeRascunho,
  type SnapshotRascunho,
} from "@/lib/meal-draft";
import { sugerirSubstitutosRascunho } from "@/lib/actions/meal-editor";
import type { SugestaoSubstituto } from "@/lib/substitution-suggestions";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FoodThumb } from "@/components/shared/food-thumb";
import { SubstitutoSearch } from "@/components/meal-plans/meal-editor-search";
import { MedidasDialog } from "@/components/meal-plans/medidas-dialog";

const fmt = (v: number, casas = 1) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

/** Gramas sem casa decimal à toa ("150 g", "37,5 g"). */
const fmtG = (g: number) => g.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/** Colunas da lista de alimentos no computador (o cabeçalho da lista usa a mesma grade). */
export const GRADE_ALIMENTOS =
  "lg:grid lg:grid-cols-[minmax(0,1fr)_12.5rem_4.25rem_3.25rem_3.25rem_3.25rem_12rem] lg:items-center lg:gap-3";

export type CarregarPrevia = (
  fonte: Extract<FonteSnapshot, { de: "alimento" | "receita" }>,
) => Promise<{ snapshot: SnapshotRascunho; medidas: FoodMeasure[] } | null>;

interface ApoioDeMedidas {
  planId: string;
  medidasDe: (foodId: string | null) => FoodMeasure[];
  onMedidaCriada: (foodId: string, m: FoodMeasure) => void;
  onMedidaExcluida: (foodId: string, medidaId: string) => void;
}

const UNIDADE_G = "g";
const UNIDADE_ATUAL = "atual";
const GERENCIAR = "__gerenciar";

/** Quantidade de uma linha: número + unidade (gramas, medida caseira) ou porções de receita. */
function QuantidadeControle<T extends LinhaRascunho>({
  linha,
  onChange,
  apoio,
}: {
  linha: T;
  onChange: (l: T) => void;
  apoio: ApoioDeMedidas;
}) {
  const [gerenciando, setGerenciando] = useState(false);
  const { snapshot, quantidade: q } = linha;
  const nome = snapshot.nome_alimento;
  const medidas = apoio.medidasDe(snapshot.food_id);
  const invalida = quantidadeInvalida(q);
  // Medida copiada na linha que também está na lista: o seletor mostra a da lista.
  const daLista =
    q.tipo === "medida" && !q.medida_id
      ? medidas.find((m) => m.nome === q.nome && Number(m.gramas) === Number(q.gramas))
      : undefined;
  const valorSelect =
    q.tipo === "g" ? UNIDADE_G : q.tipo === "medida" ? (q.medida_id ?? daLista?.id ?? UNIDADE_ATUAL) : UNIDADE_G;
  const unidadeRotulo = q.tipo === "porcoes" ? "porções" : q.tipo === "medida" ? "medidas" : "g";

  const setTexto = (texto: string) => onChange({ ...linha, quantidade: { ...q, texto } as QuantidadeRascunho });

  function escolher(valor: string) {
    if (valor === GERENCIAR) return setGerenciando(true);
    if (valor === valorSelect || valor === UNIDADE_ATUAL) return;
    if (valor === UNIDADE_G) return onChange(trocarUnidade(linha, { tipo: "g" }));
    const m = medidas.find((x) => x.id === valor);
    if (m) onChange(trocarUnidade(linha, { tipo: "medida", medida_id: m.id, nome: m.nome, gramas: Number(m.gramas) }));
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <Input
        value={q.texto}
        inputMode="decimal"
        onChange={(e) => setTexto(e.target.value)}
        aria-label={`Quantidade de ${nome} (${unidadeRotulo})`}
        aria-invalid={invalida || undefined}
        className={cn("h-9 w-16 text-center tabular-nums", invalida && "border-destructive focus-visible:ring-destructive")}
      />
      {q.tipo === "porcoes" ? (
        <span className="text-xs text-muted-foreground">porção(ões)</span>
      ) : (
        <>
          <select
            value={valorSelect}
            aria-label={`Unidade de ${nome}`}
            className="h-9 min-w-0 max-w-[8.5rem] flex-1 rounded-md border border-input bg-card px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onChange={(e) => escolher(e.target.value)}
          >
            <option value={UNIDADE_G}>g</option>
            {valorSelect === UNIDADE_ATUAL && q.tipo === "medida" && (
              <option value={UNIDADE_ATUAL}>
                {q.nome} ({fmtG(q.gramas)} g)
              </option>
            )}
            {medidas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome} ({fmtG(Number(m.gramas))} g)
              </option>
            ))}
            {snapshot.food_id && <option value={GERENCIAR}>+ Criar ou excluir medida…</option>}
          </select>
          {q.tipo === "medida" && (
            <span className="w-full text-[11px] tabular-nums text-muted-foreground">= {fmtG(gramasDaLinha(linha))} g</span>
          )}
          {snapshot.food_id && (
            <MedidasDialog
              open={gerenciando}
              onOpenChange={setGerenciando}
              planId={apoio.planId}
              foodId={snapshot.food_id}
              nomeAlimento={nome}
              medidas={medidas}
              onCriada={(m) => {
                apoio.onMedidaCriada(snapshot.food_id!, m);
                onChange(trocarUnidade(linha, { tipo: "medida", medida_id: m.id, nome: m.nome, gramas: Number(m.gramas) }));
              }}
              onExcluida={(id) => apoio.onMedidaExcluida(snapshot.food_id!, id)}
            />
          )}
        </>
      )}
    </div>
  );
}

function Origem({ snapshot }: { snapshot: SnapshotRascunho }) {
  return (
    <span className="rounded bg-success-soft px-1.5 py-px text-[11px] font-medium text-primary">
      {FONTE_LABELS[snapshot.fonte_alimento]}
    </span>
  );
}

/** kcal + P/C/G de uma linha; no celular, com o nome de cada macro. */
function Macros({ m, original, forte }: { m: MacroTotals; original?: MacroTotals; forte?: boolean }) {
  const celulas = [
    { rotulo: "kcal", valor: m.calorias, base: original?.calorias, casas: 0 },
    { rotulo: "P", valor: m.proteinas, base: original?.proteinas, casas: 1 },
    { rotulo: "C", valor: m.carboidratos, base: original?.carboidratos, casas: 1 },
    { rotulo: "G", valor: m.gorduras, base: original?.gorduras, casas: 1 },
  ];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums lg:contents">
      {celulas.map((c, i) => {
        const dif = c.base === undefined ? 0 : c.valor - c.base;
        return (
          <span
            key={c.rotulo}
            className={cn(
              "lg:text-right",
              i === 0 ? cn("text-foreground", forte && "font-semibold") : "text-muted-foreground",
            )}
          >
            <span className="mr-1 text-xs text-muted-foreground lg:hidden">{c.rotulo}</span>
            {fmt(c.valor, c.casas)}
            {i === 0 ? " kcal" : " g"}
            {c.base !== undefined && Math.abs(dif) >= (c.casas ? 0.05 : 0.5) && (
              <span className="block text-[10px] font-normal text-muted-foreground">
                {dif > 0 ? "+" : "−"}
                {fmt(Math.abs(dif), c.casas)}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

/** Um alimento da refeição, com os substitutos abrindo logo abaixo. */
export function MealEditorItem({
  item,
  apoio,
  carregarPrevia,
  onChange,
  onRemover,
  onUsar,
}: {
  item: ItemRascunho;
  apoio: ApoioDeMedidas;
  carregarPrevia: CarregarPrevia;
  onChange: (item: ItemRascunho) => void;
  onRemover: () => void;
  onUsar: (subChave: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const nome = item.snapshot.nome_alimento;
  const macros = macrosDaLinha(item);
  const n = item.substitutos.length;
  const idPainel = `subs-${item.chave}`;

  return (
    <li className="rounded-xl border border-border bg-card">
      <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 p-3", GRADE_ALIMENTOS)}>
        <div className="flex min-w-0 basis-full items-center gap-3 lg:basis-auto">
          <FoodThumb tipo={item.snapshot.recipe_id ? "receita" : "alimento"} />
          <div className="min-w-0">
            <p className="break-words text-sm font-semibold leading-snug text-foreground">{nome}</p>
            <Origem snapshot={item.snapshot} />
          </div>
        </div>
        <QuantidadeControle linha={item} onChange={onChange} apoio={apoio} />
        <Macros m={macros} forte />
        <div className="ml-auto flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn("h-8 gap-1.5 rounded-full px-3 text-xs", n > 0 && "border-primary/30 bg-success-soft/60 text-primary")}
            aria-expanded={aberto}
            aria-controls={idPainel}
            aria-label={`Substitutos de ${nome}`}
            onClick={() => setAberto((a) => !a)}
          >
            <Repeat className="h-3.5 w-3.5" aria-hidden="true" />
            Substitutos{n > 0 ? ` (${n})` : ""}
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", aberto && "rotate-180")} aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Remover ${nome}`}
            title="Remover da refeição"
            onClick={onRemover}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {aberto && (
        <Substitutos
          id={idPainel}
          item={item}
          original={macros}
          apoio={apoio}
          carregarPrevia={carregarPrevia}
          onChange={onChange}
          onUsar={onUsar}
        />
      )}
    </li>
  );
}

function Substitutos({
  id,
  item,
  original,
  apoio,
  carregarPrevia,
  onChange,
  onUsar,
}: {
  id: string;
  item: ItemRascunho;
  original: MacroTotals;
  apoio: ApoioDeMedidas;
  carregarPrevia: CarregarPrevia;
  onChange: (item: ItemRascunho) => void;
  onUsar: (subChave: string) => void;
}) {
  const [criterio, setCriterio] = useState<CriterioEquivalencia>("kcal");
  const [adicionando, setAdicionando] = useState(item.substitutos.length === 0);
  const [carregando, setCarregando] = useState(false);
  const ehReceita = !!item.snapshot.recipe_id;
  const nome = item.snapshot.nome_alimento;

  const setSub = (chave: string, nova: LinhaRascunho) =>
    onChange({ ...item, substitutos: item.substitutos.map((s) => (s.chave === chave ? nova : s)) });

  async function adicionar(foodId: string, quantidade: (medidas: FoodMeasure[], snapshot: SnapshotRascunho) => QuantidadeRascunho) {
    setCarregando(true);
    try {
      const p = await carregarPrevia({ de: "alimento", food_id: foodId });
      if (!p) return;
      onChange({
        ...item,
        substitutos: [
          ...item.substitutos,
          { chave: novaChave(), id: null, fonte: { de: "alimento", food_id: foodId }, snapshot: p.snapshot, quantidade: quantidade(p.medidas, p.snapshot) },
        ],
      });
    } finally {
      setCarregando(false);
    }
  }

  function daSugestao(s: SugestaoSubstituto) {
    void adicionar(s.foodId, () =>
      s.medida && s.medidaQuantidade
        ? { tipo: "medida", texto: textoDeNumero(s.medidaQuantidade), medida_id: s.medida.id, nome: s.medida.nome, gramas: s.medida.gramas }
        : { tipo: "g", texto: textoDeNumero(s.gramas) },
    );
  }

  /** Busca livre: entra já na quantidade equivalente (em medida caseira, se houver) — ajuste na linha. */
  async function daBusca(r: Extract<ResultadoBusca, { tipo: "alimento" }>) {
    const valores = {
      porcao_referencia_g: r.porcaoG,
      calorias_kcal: r.kcal,
      proteinas_g: r.proteinas,
      carboidratos_g: r.carboidratos,
      gorduras_g: r.lipidios,
    };
    await adicionar(r.id, (medidas) => {
      const g = gramasEquivalentes(original, valores, criterio) ?? (r.porcaoG || 100);
      const m = medidaUsual(medidas);
      const arr = arredondarQuantidade(g, m ? { gramas: Number(m.gramas) } : null);
      return m && arr.medidaQuantidade
        ? { tipo: "medida", texto: textoDeNumero(arr.medidaQuantidade), medida_id: m.id, nome: m.nome, gramas: Number(m.gramas) }
        : { tipo: "g", texto: textoDeNumero(arr.gramas) };
    });
  }

  return (
    <div id={id} role="region" aria-label={`Substitutos de ${nome}`} className="mx-3 mb-3 space-y-2 rounded-lg bg-success-soft/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
          <Repeat className="h-4 w-4" aria-hidden="true" />
          Substitutos equivalentes
          <Info
            className="h-3.5 w-3.5 text-muted-foreground"
            aria-label="Opções que o paciente pode usar no lugar deste alimento"
          />
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Equivaler por</span>
          <div className="flex gap-1" role="radiogroup" aria-label="Equivaler por">
            {CRITERIOS.map((c) => (
              <button
                key={c.valor}
                type="button"
                role="radio"
                aria-checked={criterio === c.valor}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                  criterio === c.valor
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:border-primary/40",
                )}
                onClick={() => setCriterio(c.valor)}
              >
                {c.rotulo}
              </button>
            ))}
          </div>
          {!ehReceita && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-primary"
              aria-expanded={adicionando}
              onClick={() => setAdicionando((a) => !a)}
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar substituto
            </Button>
          )}
        </div>
      </div>

      {item.substitutos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {ehReceita ? "Receitas não têm substitutos." : "Nenhum substituto ainda. Escolha uma sugestão ou busque abaixo."}
        </p>
      ) : (
        <ul className="divide-y divide-border/70 rounded-lg bg-card">
          {item.substitutos.map((sub) => (
            <li key={sub.chave} className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2", GRADE_ALIMENTOS)}>
              <div className="flex min-w-0 basis-full items-center gap-2.5 lg:basis-auto">
                <FoodThumb className="h-8 w-8" />
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium leading-snug text-foreground">{sub.snapshot.nome_alimento}</p>
                  <Origem snapshot={sub.snapshot} />
                </div>
              </div>
              <QuantidadeControle linha={sub} onChange={(nova) => setSub(sub.chave, nova)} apoio={apoio} />
              <Macros m={macrosDaLinha(sub)} original={original} />
              <div className="ml-auto flex items-center justify-end gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 px-2.5 text-xs"
                  title="Este substituto vira o alimento da refeição (e o alimento vira substituto)"
                  aria-label={`Usar este: ${sub.snapshot.nome_alimento} vira o alimento do plano`}
                  onClick={() => onUsar(sub.chave)}
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                  Usar este
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`Remover substituto ${sub.snapshot.nome_alimento}`}
                  onClick={() => onChange({ ...item, substitutos: item.substitutos.filter((s) => s.chave !== sub.chave) })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {adicionando && !ehReceita && (
        <div className="space-y-3 rounded-lg border border-dashed border-primary/30 bg-card p-3">
          <Sugestoes item={item} original={original} criterio={criterio} desabilitado={carregando} onEscolher={daSugestao} />
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">Buscar outro alimento</p>
            <SubstitutoSearch onEscolher={daBusca} />
            <p className="text-xs text-muted-foreground">
              Entra já na quantidade equivalente pelo critério escolhido — ajuste na linha se quiser.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/** "Sugestões rápidas" do mesmo grupo (Fase 17, Bloco E), para o item como está no rascunho. */
function Sugestoes({
  item,
  original,
  criterio,
  desabilitado,
  onEscolher,
}: {
  item: ItemRascunho;
  original: MacroTotals;
  criterio: CriterioEquivalencia;
  desabilitado: boolean;
  onEscolher: (s: SugestaoSubstituto) => void;
}) {
  const foodId = item.snapshot.food_id;
  const gramas = gramasDaLinha(item);
  const usados = [foodId, ...item.substitutos.map((s) => s.snapshot.food_id)].filter((x): x is string => !!x).join(",");
  const chave = `${foodId}|${criterio}|${gramas}|${usados}`;
  const [resposta, setResposta] = useState<{ chave: string; lista: SugestaoSubstituto[] } | null>(null);
  const lista = resposta?.chave === chave ? resposta.lista : null;

  useEffect(() => {
    if (!foodId || !(gramas > 0)) return;
    let ativo = true;
    const t = setTimeout(() => {
      void sugerirSubstitutosRascunho(
        { food_id: foodId, nome_alimento: item.snapshot.nome_alimento, quantidade_g: gramas, macros: original },
        usados.split(","),
        criterio,
      ).then((l) => ativo && setResposta({ chave, lista: l }));
    }, 300);
    return () => {
      ativo = false;
      clearTimeout(t);
    };
    // `original` muda junto com `gramas`, que está na chave.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  if (!foodId) return null;
  return (
    <section aria-label="Sugestões rápidas" className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        <Sparkles className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        Sugestões rápidas
      </p>
      {lista === null ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Buscando sugestões" />
      ) : lista.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma sugestão do mesmo grupo para este alimento.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {lista.map((s) => (
            <Button
              key={s.foodId}
              type="button"
              variant="outline"
              size="sm"
              className="h-auto max-w-full whitespace-normal py-1 text-left text-xs"
              disabled={desabilitado}
              onClick={() => onEscolher(s)}
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
  );
}
