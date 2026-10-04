"use client";

import { useEffect, useState, useTransition } from "react";
import { BookOpen, Loader2, Plus, Search, Star, Utensils, X } from "lucide-react";
import { toast } from "sonner";

import {
  alternarFavoritoAlimento,
  buscarAlimentosRefeicao,
  type FiltroBusca,
  type ResultadoBusca,
} from "@/lib/actions/meal-food-search";
import { formatarMedida } from "@/lib/household-measures";
import { cn } from "@/lib/utils";

import { FoodFormDialog } from "@/components/foods/food-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Aba = "alimentos" | "receitas" | "favoritos";

const ABAS: { valor: Aba; rotulo: string; icone: typeof Utensils }[] = [
  { valor: "alimentos", rotulo: "Alimentos", icone: Utensils },
  { valor: "receitas", rotulo: "Minhas receitas", icone: BookOpen },
  { valor: "favoritos", rotulo: "Favoritos", icone: Star },
];

/** Fontes de alimento (aba "Alimentos" e busca de substituto). */
const FONTES: { valor: FiltroBusca; rotulo: string }[] = [
  { valor: "alimentos", rotulo: "Todos" },
  { valor: "taco", rotulo: "TACO" },
  { valor: "usda", rotulo: "USDA" },
  { valor: "meus", rotulo: "Meus alimentos" },
];

const fmt = (v: number, casas = 1) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

/** Busca com atraso curto; resultados guardados com a chave da busca (chave diferente = carregando). */
function useBusca(termo: string, filtro: FiltroBusca, ativa: boolean) {
  const [resposta, setResposta] = useState<{ chave: string; lista: ResultadoBusca[] } | null>(null);
  const [, startBusca] = useTransition();
  const chave = `${filtro}|${termo.trim()}`;

  useEffect(() => {
    if (!ativa) return;
    const t = setTimeout(() => {
      startBusca(async () => setResposta({ chave, lista: await buscarAlimentosRefeicao(termo, filtro) }));
    }, 250);
    return () => clearTimeout(t);
  }, [chave, filtro, termo, ativa]);

  return resposta?.chave === chave ? resposta.lista : null;
}

function CampoDeBusca({
  termo,
  setTermo,
  rotulo,
  placeholder,
  compacto,
}: {
  termo: string;
  setTermo: (t: string) => void;
  rotulo: string;
  placeholder: string;
  compacto?: boolean;
}) {
  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        aria-label={rotulo}
        placeholder={placeholder}
        className={cn("pl-9 pr-9", compacto ? "h-9" : "h-11")}
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
      />
      {termo && (
        <button
          type="button"
          aria-label="Limpar busca"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
          onClick={() => setTermo("")}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function FiltroDeFonte({ fonte, setFonte }: { fonte: FiltroBusca; setFonte: (f: FiltroBusca) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Fonte dos alimentos">
      {FONTES.map((f) => (
        <button
          key={f.valor}
          type="button"
          role="radio"
          aria-checked={fonte === f.valor}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            fonte === f.valor
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-foreground hover:border-primary/40",
          )}
          onClick={() => setFonte(f.valor)}
        >
          {f.rotulo}
        </button>
      ))}
    </div>
  );
}

/** Colunas da lista de resultados (cabeçalho e linhas). */
const GRADE_RESULTADOS =
  "grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-x-3 sm:grid-cols-[1.75rem_minmax(0,1fr)_9rem_2.75rem_2.75rem_2.75rem_3.25rem_6.5rem]";

/**
 * Resultados em lista, como antes (Fase 17): estrela, nome com a origem,
 * quantidade em que entra (medida usual ou porção), PTN/LIP/CHO, kcal e "+".
 */
function ListaDeResultados({
  resultados,
  vazio,
  rotuloAcao,
  onEscolher,
}: {
  resultados: ResultadoBusca[] | null;
  vazio: string;
  rotuloAcao: string;
  onEscolher: (r: ResultadoBusca) => Promise<void>;
}) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [favs, setFavs] = useState<Record<string, boolean>>({});

  async function escolher(r: ResultadoBusca) {
    setOcupado(`${r.tipo}-${r.id}`);
    try {
      await onEscolher(r);
    } finally {
      setOcupado(null);
    }
  }

  function favoritar(r: Extract<ResultadoBusca, { tipo: "alimento" }>) {
    const novo = !(favs[r.id] ?? r.favorito);
    setFavs((f) => ({ ...f, [r.id]: novo }));
    void alternarFavoritoAlimento(r.id, novo).then((res) => {
      if (!res.success) {
        setFavs((f) => ({ ...f, [r.id]: !novo }));
        toast.error("Não foi possível favoritar", { description: res.message });
      }
    });
  }

  if (resultados === null) {
    return (
      <p className="flex items-center justify-center py-4 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-label="Buscando" />
      </p>
    );
  }
  if (resultados.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
        {vazio}
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div
        className={cn(
          GRADE_RESULTADOS,
          "hidden bg-muted/60 px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:grid",
        )}
        aria-hidden="true"
      >
        <span />
        <span>Alimento</span>
        <span>Qtd.</span>
        <span className="text-right">PTN</span>
        <span className="text-right">LIP</span>
        <span className="text-right">CHO</span>
        <span className="text-right">kcal</span>
        <span />
      </div>
      <ul className="max-h-72 divide-y divide-border/70 overflow-y-auto" aria-label="Resultados">
        {resultados.map((r) => {
          const fav = r.tipo === "alimento" && (favs[r.id] ?? r.favorito);
          const carregando = ocupado === `${r.tipo}-${r.id}`;
          // Valores na quantidade em que entra: a medida usual, ou a porção de referência.
          const fator = r.tipo === "alimento" && r.medida ? r.medida.gramas / (r.porcaoG || 100) : 1;
          const qtd =
            r.tipo === "alimento"
              ? r.medida
                ? formatarMedida(1, r.medida.nome, r.medida.gramas)
                : `${fmt(r.porcaoG, 0)} g`
              : "1 porção";
          return (
            <li key={`${r.tipo}-${r.id}`} className={cn(GRADE_RESULTADOS, "px-2 py-1.5 text-sm hover:bg-muted/40")}>
              <span className="flex justify-center">
                {r.tipo === "alimento" && (
                  <button
                    type="button"
                    aria-pressed={fav}
                    aria-label={fav ? `Desfavoritar ${r.nome}` : `Favoritar ${r.nome}`}
                    className="rounded p-1 text-muted-foreground hover:text-foreground"
                    onClick={() => favoritar(r)}
                  >
                    <Star className={cn("h-4 w-4", fav && "fill-amber-400 text-amber-500")} />
                  </button>
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground" title={r.nome}>
                  {r.nome}
                </p>
                <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="shrink-0 rounded bg-success-soft px-1.5 py-px font-medium text-primary">{r.origem}</span>
                  {/* No celular, a quantidade e as kcal vêm aqui embaixo do nome. */}
                  <span className="truncate tabular-nums sm:hidden">
                    {r.tipo === "alimento" ? `${fmt(Math.round(r.kcal * fator), 0)} kcal · ${qtd}` : qtd}
                  </span>
                </p>
              </div>
              <span className="hidden truncate text-xs tabular-nums text-muted-foreground sm:block" title={qtd}>
                {qtd}
              </span>
              {r.tipo === "alimento" ? (
                <>
                  <span className="hidden text-right tabular-nums text-muted-foreground sm:block">{fmt(r.proteinas * fator)}</span>
                  <span className="hidden text-right tabular-nums text-muted-foreground sm:block">{fmt(r.lipidios * fator)}</span>
                  <span className="hidden text-right tabular-nums text-muted-foreground sm:block">{fmt(r.carboidratos * fator)}</span>
                  <span className="hidden text-right font-medium tabular-nums sm:block">{fmt(Math.round(r.kcal * fator), 0)}</span>
                </>
              ) : (
                <>
                  <span className="hidden sm:block" />
                  <span className="hidden sm:block" />
                  <span className="hidden sm:block" />
                  <span className="hidden sm:block" />
                </>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 justify-self-end px-2.5"
                title={rotuloAcao}
                aria-label={`Adicionar ${r.nome}`}
                disabled={ocupado !== null}
                onClick={() => void escolher(r)}
              >
                {carregando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                <span className="hidden md:inline">Adicionar</span>
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Busca da janela da refeição (Fase 19): um campo só, com as abas Alimentos /
 * Minhas receitas / Favoritos e, em Alimentos, a fonte (Todos, TACO, USDA,
 * Meus alimentos). Resultados em lista. Em Alimentos, só aparecem quando há o
 * que buscar; receitas e favoritos aparecem já listados.
 */
export function MealEditorSearch({ onAdicionar }: { onAdicionar: (r: ResultadoBusca) => Promise<void> }) {
  const [aba, setAba] = useState<Aba>("alimentos");
  const [fonte, setFonte] = useState<FiltroBusca>("alimentos");
  const [termo, setTermo] = useState("");

  const filtro: FiltroBusca = aba === "alimentos" ? fonte : aba;
  const mostrar = aba !== "alimentos" || termo.trim().length > 0;
  const resultados = useBusca(termo, filtro, mostrar);

  return (
    <section aria-label="Adicionar alimentos" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border">
        <div className="-mb-px flex max-w-full gap-1 overflow-x-auto" role="tablist" aria-label="O que buscar">
          {ABAS.map((a) => (
            <button
              key={a.valor}
              type="button"
              role="tab"
              aria-selected={aba === a.valor}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                aba === a.valor
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setAba(a.valor)}
            >
              <a.icone className="h-4 w-4" aria-hidden="true" />
              {a.rotulo}
            </button>
          ))}
        </div>
        <FoodFormDialog
          trigger={
            <Button type="button" variant="ghost" size="sm" className="mb-1 h-8 text-xs text-muted-foreground">
              <Plus className="h-3.5 w-3.5" />
              Cadastrar alimento
            </Button>
          }
        />
      </div>

      <CampoDeBusca
        termo={termo}
        setTermo={setTermo}
        rotulo="Buscar alimentos"
        placeholder={aba === "receitas" ? "Buscar receita por nome..." : "Buscar alimento por nome..."}
      />

      {aba === "alimentos" && <FiltroDeFonte fonte={fonte} setFonte={setFonte} />}

      {mostrar && (
        <ListaDeResultados
          resultados={resultados}
          rotuloAcao="Adicionar à refeição"
          onEscolher={onAdicionar}
          vazio={
            aba === "favoritos" && !termo
              ? "Nenhum favorito ainda. Toque na estrela de um alimento para favoritar."
              : aba === "receitas" && !termo
                ? "Você ainda não tem receitas prontas."
                : "Nada encontrado."
          }
        />
      )}
    </section>
  );
}

/**
 * Busca de substituto (Fase 19): o mesmo campo, a mesma lista e as mesmas
 * fontes da busca da refeição (TACO, USDA, Meus alimentos) — só alimentos.
 */
export function SubstitutoSearch({
  onEscolher,
}: {
  onEscolher: (r: Extract<ResultadoBusca, { tipo: "alimento" }>) => Promise<void>;
}) {
  const [fonte, setFonte] = useState<FiltroBusca>("alimentos");
  const [termo, setTermo] = useState("");
  const mostrar = termo.trim().length > 0;
  const resultados = useBusca(termo, fonte, mostrar);

  return (
    <div className="space-y-2">
      <CampoDeBusca
        termo={termo}
        setTermo={setTermo}
        rotulo="Buscar substituto"
        placeholder="Buscar outro alimento por nome..."
        compacto
      />
      <FiltroDeFonte fonte={fonte} setFonte={setFonte} />
      {mostrar && (
        <ListaDeResultados
          resultados={resultados}
          rotuloAcao="Adicionar como substituto"
          vazio="Nada encontrado."
          onEscolher={async (r) => {
            if (r.tipo === "alimento") await onEscolher(r);
          }}
        />
      )}
    </div>
  );
}
