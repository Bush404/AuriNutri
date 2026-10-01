"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import { FORMULAS, KCAL_POR_KG_VENTA, ajusteVenta, type FormulaEnergia } from "@/lib/energy-formulas";
import { kcalAtividade } from "@/lib/energy-calculation";
import type { AtividadeMet } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const fmt = (v: number, casas = 0) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

/** Minúsculas e sem acento, para a busca ("musculacao" acha "Musculação"). */
const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// ---------------------------------------------------------------------------
// Ver referências

const REFERENCIAS_ATIVIDADE: [string, string][] = [
  ["Sedentário", "pouco ou nenhum exercício"],
  ["Leve", "exercício leve, esportes 1 a 3 dias por semana"],
  ["Moderado", "exercício moderado, esportes 3 a 5 dias por semana"],
  ["Intenso", "exercício intenso, esportes 6 a 7 dias por semana"],
  ["Muito intenso", "exercício diário muito intenso, esportes e/ou trabalho físico 2 vezes ao dia"],
];

export function ReferenciasDialog({
  onOpenChange,
  formulaInicial,
  opcoes,
}: {
  onOpenChange: (o: boolean) => void;
  formulaInicial: FormulaEnergia | null;
  opcoes: FormulaEnergia[];
}) {
  const [escolhida, setEscolhida] = useState<FormulaEnergia | null>(formulaInicial ?? opcoes[0] ?? null);
  const info = escolhida ? FORMULAS[escolhida] : null;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Referências</DialogTitle>
          <DialogDescription>Para quem serve cada fórmula e que dados ela usa.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1 text-sm">
          <Select value={escolhida ?? undefined} onValueChange={(x) => setEscolhida(x as FormulaEnergia)}>
            <SelectTrigger aria-label="Fórmula">
              <SelectValue placeholder="Escolha a fórmula" />
            </SelectTrigger>
            <SelectContent>
              {opcoes.map((f) => (
                <SelectItem key={f} value={f}>
                  {FORMULAS[f].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {info && (
            <div className="space-y-2">
              <h3 className="font-semibold text-foreground">O que diz a referência?</h3>
              <p className="text-muted-foreground">Usa: {info.usa}.</p>
              <p className="text-foreground">{info.sobre}</p>
              {info.referencia !== "—" && <p className="text-xs text-muted-foreground">Fonte: {info.referencia}</p>}
            </div>
          )}
          <div className="space-y-1">
            <h3 className="font-semibold text-foreground">Referências de fator atividade</h3>
            <ul className="space-y-1">
              {REFERENCIAS_ATIVIDADE.map(([nivel, desc]) => (
                <li key={nivel}>
                  <span className="font-medium">{nivel}</span> — {desc}
                </li>
              ))}
            </ul>
            <p className="pt-1 text-xs text-muted-foreground">
              Nas fórmulas EER (IOM 2005 e 2023) o nível de atividade entra na própria equação e o fator de atividade não é usado.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Programar MET — lista do Compendium of Physical Activities (2024)

type Atividade = { codigo: string; categoria: string; met: number; nome: string; busca: string };

/** A lista (~80 KB) só é carregada quando a janela abre. */
function useCompendium() {
  const [lista, setLista] = useState<Atividade[] | null>(null);
  const [citacao, setCitacao] = useState("");
  useEffect(() => {
    let ativo = true;
    import("@/lib/compendium/atividades").then((m) => {
      if (!ativo) return;
      setCitacao(m.CITACAO_COMPENDIUM);
      setLista(
        m.ATIVIDADES_COMPENDIUM.map(([codigo, cat, met, nome]) => {
          const categoria = m.CATEGORIAS_COMPENDIUM[cat];
          return { codigo, categoria, met, nome, busca: normalizar(`${nome} ${categoria}`) };
        })
      );
    });
    return () => {
      ativo = false;
    };
  }, []);
  return { lista, citacao };
}

/** Linhas desenhadas por vez; rolar até o fim da lista mostra mais (1.111 de uma vez travaria a digitação). */
const LOTE = 100;

export function MetDialog({
  onOpenChange,
  atividades,
  pesoKg,
  onConfirmar,
}: {
  onOpenChange: (o: boolean) => void;
  atividades: AtividadeMet[];
  pesoKg: number | null;
  onConfirmar: (lista: AtividadeMet[]) => void;
}) {
  const { lista, citacao } = useCompendium();
  const [busca, setBusca] = useState("");
  const [limite, setLimite] = useState(LOTE);
  // Minutos por dia digitados, por código (atividades antigas digitadas à mão ficam pelo nome).
  const chave = (a: { codigo: string; nome: string }) => a.codigo || `manual:${a.nome}`;
  const [escolhidas, setEscolhidas] = useState<Map<string, AtividadeMet & { minutosTexto: string }>>(
    () => new Map(atividades.map((a) => [chave(a), { ...a, minutosTexto: String(a.minutos) }]))
  );

  const termos = normalizar(busca).split(/\s+/).filter(Boolean);
  // Sem busca, todas as atividades (como no WebDiet); com busca, só as que contêm todas as palavras.
  const filtradas = useMemo(() => {
    if (!lista) return [];
    const disponiveis = lista.filter((a) => !escolhidas.has(chave(a)));
    return termos.length === 0 ? disponiveis : disponiveis.filter((a) => termos.every((t) => a.busca.includes(t)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- termos deriva de `busca`; escolhidas muda a lista
  }, [lista, busca, escolhidas]);
  const visiveis = filtradas.slice(0, limite);

  function definirMinutos(a: { codigo: string; nome: string; met: number }, texto: string) {
    setEscolhidas((atual) => {
      const nova = new Map(atual);
      const minutos = Number(texto.replace(",", "."));
      if (!texto.trim()) nova.delete(chave(a));
      else nova.set(chave(a), { codigo: a.codigo, nome: a.nome, met: a.met, minutos: Number.isFinite(minutos) ? minutos : 0, minutosTexto: texto });
      return nova;
    });
  }

  const validas = [...escolhidas.values()].filter((a) => a.minutos > 0 && a.minutos <= 1440 && Number.isInteger(a.minutos));
  const invalidas = escolhidas.size - validas.length;
  const total = validas.reduce((s, a) => s + kcalAtividade(a, pesoKg), 0);

  const linha = (a: { codigo: string; nome: string; met: number; categoria?: string }) => {
    const atual = escolhidas.get(chave(a));
    return (
      <li key={chave(a)} className="flex items-center gap-3 rounded-md bg-muted/60 px-3 py-2">
        <div className="min-w-0 flex-1 text-sm">
          <p className="text-foreground">{a.nome}</p>
          <p className="text-xs text-muted-foreground">
            Coeficiente MET: {fmt(a.met, 1)}
            {a.categoria && ` · ${a.categoria}`}
          </p>
        </div>
        <label className="sr-only" htmlFor={`min-${chave(a)}`}>
          Minutos por dia de {a.nome}
        </label>
        <Input
          id={`min-${chave(a)}`}
          inputMode="numeric"
          placeholder="minutos"
          className="h-9 w-24 text-center"
          value={atual?.minutosTexto ?? ""}
          onChange={(e) => definirMinutos(a, e.target.value)}
        />
      </li>
    );
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Equivalente Metabólico da Tarefa (MET)</DialogTitle>
          <DialogDescription>
            Busque a atividade e digite os minutos por dia. Gasto = MET × peso × horas por dia.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            autoFocus
            aria-label="Buscar atividade"
            placeholder="Busque pelo nome da atividade (ex.: musculação, caminhada, futebol)"
            className="pl-9"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setLimite(LOTE);
            }}
          />
        </div>

        <div
          className="max-h-[50vh] space-y-4 overflow-y-auto pr-1"
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200 && limite < filtradas.length) setLimite((l) => l + LOTE);
          }}
        >
          {escolhidas.size > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Escolhidas</p>
              <ul className="space-y-2">
                {[...escolhidas.values()].map((a) => (
                  <li key={chave(a)} className="flex items-center gap-3 rounded-md border border-primary/40 bg-primary/5 px-3 py-2">
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="text-foreground">{a.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        Coeficiente MET: {fmt(a.met, 1)}
                        {a.minutos > 0 && pesoKg ? ` · +${fmt(Math.round(kcalAtividade(a, pesoKg)))} kcal/dia` : ""}
                      </p>
                    </div>
                    <Input
                      aria-label={`Minutos por dia de ${a.nome}`}
                      inputMode="numeric"
                      placeholder="minutos"
                      className="h-9 w-24 text-center"
                      value={a.minutosTexto}
                      onChange={(e) => definirMinutos(a, e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remover ${a.nome}`}
                      onClick={() => definirMinutos(a, "")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!lista ? (
            <p className="text-sm text-muted-foreground">Carregando a lista de atividades…</p>
          ) : filtradas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma atividade encontrada para &quot;{busca}&quot;.</p>
          ) : (
            <div className="space-y-2">
              {escolhidas.size > 0 && (
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {termos.length ? "Resultados" : "Todas as atividades"}
                </p>
              )}
              <ul className="space-y-2">{visiveis.map((a) => linha(a))}</ul>
              {visiveis.length < filtradas.length && (
                <Button type="button" variant="ghost" className="w-full" onClick={() => setLimite((l) => l + LOTE)}>
                  Mostrar mais ({fmt(filtradas.length - visiveis.length)} restantes)
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="space-y-3 border-t border-border pt-3">
          <p className="text-sm">
            Total: <span className="font-semibold">+{fmt(Math.round(total))} kcal/dia</span>
            {!pesoKg && <span className="text-muted-foreground"> — informe o peso para calcular</span>}
          </p>
          {invalidas > 0 && (
            <p className="text-xs text-destructive" role="alert">
              Use minutos inteiros, de 1 a 1.440. Atividades sem minutos válidos não entram.
            </p>
          )}
          <Button
            type="button"
            className="w-full"
            onClick={() => onConfirmar(validas.map((a) => ({ codigo: a.codigo, nome: a.nome, met: a.met, minutos: a.minutos })))}
          >
            Confirmar
          </Button>
          {citacao && <p className="text-[11px] leading-snug text-muted-foreground">Fonte: {citacao} Tradução do AuriNutri.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Programar peso (VENTA)

const KG_MIN = -30;
const KG_MAX = 30;
const DIAS_MIN = 7;
const DIAS_MAX = 365;

const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function VentaDialog({
  onOpenChange,
  kg: kgInicial,
  dias: diasInicial,
  onConfirmar,
}: {
  onOpenChange: (o: boolean) => void;
  kg: number;
  dias: number;
  onConfirmar: (kg: number, dias: number) => void;
}) {
  const [kg, setKg] = useState(kgInicial);
  const [dias, setDias] = useState(diasInicial);
  const kcalDia = ajusteVenta(kg, dias);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-center">Programar meta de ganho ou perda de peso</DialogTitle>
          <DialogDescription className="text-center">
            Pelo método do <strong>Valor Energético do Tecido Adiposo</strong>, que atribui {fmt(KCAL_POR_KG_VENTA)} kcal a 1 kg de
            peso corporal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Arrastar
            rotulo="Quantos kg o paciente precisa ganhar ou perder?"
            unidade="kg"
            min={KG_MIN}
            max={KG_MAX}
            passo={0.5}
            valor={kg}
            onChange={setKg}
            dica="Para a esquerda, perder; para a direita, ganhar."
          />
          <Arrastar
            rotulo="Qual o tempo estimado para esta meta?"
            unidade="dia(s)"
            min={DIAS_MIN}
            max={DIAS_MAX}
            passo={1}
            valor={dias}
            onChange={setDias}
          />

          <div className="rounded-md bg-muted/60 px-4 py-3 text-center text-sm" role="status" aria-live="polite">
            <p className="text-muted-foreground">Resultado:</p>
            {kg === 0 ? (
              <p>
                Seu paciente já está no peso desejado.
                <br />
                Não há intervenção a ser feita.
              </p>
            ) : (
              <p>
                Para {kg < 0 ? "perder" : "ganhar"} <strong>{fmt(Math.abs(kg), 1)} kg</strong> em <strong>{dias} dias</strong>,{" "}
                {kg < 0 ? "tirar" : "somar"} <strong>{fmt(Math.abs(Math.round(kcalDia)))} kcal por dia</strong>.
              </p>
            )}
          </div>
          <p className="text-center text-xs text-muted-foreground">Dica: programe a meta de peso para a próxima consulta.</p>

          <div className="flex flex-col gap-2">
            <Button type="button" className="w-full" onClick={() => onConfirmar(kg, dias)}>
              Confirmar
            </Button>
            {kgInicial !== 0 && (
              <Button type="button" variant="ghost" className="w-full" onClick={() => onConfirmar(0, dias)}>
                Remover meta de peso
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Barra de arrastar + caixa numérica, as duas sempre iguais (como no WebDiet). */
function Arrastar({
  rotulo,
  unidade,
  min,
  max,
  passo,
  valor,
  onChange,
  dica,
}: {
  rotulo: string;
  unidade: string;
  min: number;
  max: number;
  passo: number;
  valor: number;
  onChange: (v: number) => void;
  dica?: string;
}) {
  // Enquanto a caixa está sendo digitada, mostra o texto digitado; fora disso, o valor da barra.
  const [editando, setEditando] = useState<string | null>(null);
  const texto = editando ?? String(valor).replace(".", ",");
  const id = rotulo.replace(/\W+/g, "-");

  return (
    <div className="space-y-2">
      <Label htmlFor={`${id}-range`} className="block text-center text-sm font-normal">
        {rotulo}
      </Label>
      <div className="flex items-center gap-3">
        <input
          id={`${id}-range`}
          type="range"
          min={min}
          max={max}
          step={passo}
          value={valor}
          onChange={(e) => onChange(Number(e.target.value))}
          className={cn(
            "h-2 flex-1 cursor-pointer appearance-none rounded-full accent-primary",
            "bg-gradient-to-r from-destructive/30 via-muted to-primary/40"
          )}
        />
        <Input
          aria-label={`${rotulo} (${unidade})`}
          inputMode="decimal"
          className="h-9 w-20 text-center"
          value={texto}
          onChange={(e) => {
            setEditando(e.target.value);
            const x = Number(e.target.value.replace(",", "."));
            if (e.target.value.trim() !== "" && Number.isFinite(x)) onChange(limitar(x, min, max));
          }}
          onBlur={() => setEditando(null)}
        />
        <span className="w-12 text-sm text-muted-foreground">{unidade}</span>
      </div>
      {dica && <p className="text-center text-xs text-muted-foreground">{dica}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Adicional de gestante (manual até existir o acompanhamento gestacional)

export function GestanteDialog({
  onOpenChange,
  kcal: kcalInicial,
  onConfirmar,
}: {
  onOpenChange: (o: boolean) => void;
  kcal: number | null;
  onConfirmar: (kcal: number | null) => void;
}) {
  const [texto, setTexto] = useState(kcalInicial ? String(kcalInicial) : "");
  const valor = Number(texto.replace(",", "."));
  const valido = texto.trim() === "" || (Number.isFinite(valor) && valor >= 0 && valor <= 2000);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Adicional de gestante</DialogTitle>
          <DialogDescription className="text-center">
            Calorias diárias a mais para a gestante. Por enquanto o valor é digitado; o cálculo automático entra com o acompanhamento
            gestacional.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            autoFocus
            aria-label="Adicional de gestação em kcal por dia"
            inputMode="decimal"
            placeholder="Valor do adicional em kcal"
            value={texto}
            aria-invalid={!valido || undefined}
            onChange={(e) => setTexto(e.target.value)}
          />
          {!valido && (
            <p className="text-xs text-destructive" role="alert">
              Use um valor de 0 a 2.000 kcal.
            </p>
          )}
          <Button type="button" className="w-full" disabled={!valido} onClick={() => onConfirmar(texto.trim() ? valor : null)}>
            Confirmar
          </Button>
          {kcalInicial ? (
            <Button type="button" variant="ghost" className="w-full" onClick={() => onConfirmar(null)}>
              Remover adicional
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
