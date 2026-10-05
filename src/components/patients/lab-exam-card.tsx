"use client";

import { useState, useTransition } from "react";
import { BarChart3, Check, FileText, FlaskConical, Info, Loader2, MoreHorizontal, Plus, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import type { LabExam, LabMarker } from "@/lib/types/database.types";
import type { LabMarkerInput } from "@/lib/validations/lab-exam";
import { salvarMarcadores } from "@/lib/actions/lab-markers";
import { foraDaFaixa, textoDaFaixa } from "@/lib/lab-marker-range";
import { cn, formatDate } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { LabMarkerForm } from "@/components/patients/lab-marker-form";
import { MarkerRangeBar } from "@/components/patients/marker-range-bar";

export interface LabExamWithMarkers extends LabExam {
  lab_markers: LabMarker[];
}

/** Um marcador na lista da janela: já gravado ou novo (rascunho, só grava em "Salvar alterações"). */
type ItemDaLista =
  | { tipo: "salvo"; chave: string; m: Pick<LabMarker, "nome_marcador" | "valor" | "unidade" | "referencia_min" | "referencia_max"> }
  | { tipo: "novo"; chave: string; m: LabMarkerInput };

const num = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 4 });

/**
 * Janela "Marcadores" de uma coleta (Fase 19, layout de referência de
 * 05/10/2026): à esquerda os marcadores da coleta, à direita "Adicionar
 * marcador". É um rascunho (decisão do usuário): adicionar e tirar só mudam a
 * lista; "Salvar alterações" grava tudo de uma vez (salvarMarcadores →
 * salvar_marcadores, uma transação) e "Cancelar" descarta.
 */
export function ExamMarkersDialog({
  patientId,
  exam,
  open,
  onOpenChange,
}: {
  patientId: string;
  exam: LabExamWithMarkers;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [novos, setNovos] = useState<{ chave: string; m: LabMarkerInput }[]>([]);
  const [removidos, setRemovidos] = useState<string[]>([]);
  const [digitando, setDigitando] = useState(false);
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  const [salvando, startSalvando] = useTransition();

  const itens: ItemDaLista[] = [
    ...exam.lab_markers.filter((m) => !removidos.includes(m.id)).map((m) => ({ tipo: "salvo" as const, chave: m.id, m })),
    ...novos.map((n) => ({ tipo: "novo" as const, chave: n.chave, m: n.m })),
  ];
  const alteracoes = novos.length + removidos.length;
  const pendente = alteracoes > 0 || digitando;

  function fechar() {
    setNovos([]);
    setRemovidos([]);
    setDigitando(false);
    setConfirmarSaida(false);
    onOpenChange(false);
  }

  /** X, Esc, clique fora ou "Cancelar": com algo não salvo, pergunta antes de descartar. */
  function pedirParaFechar() {
    if (pendente) setConfirmarSaida(true);
    else fechar();
  }

  function remover(item: ItemDaLista) {
    if (item.tipo === "novo") setNovos((atual) => atual.filter((n) => n.chave !== item.chave));
    else setRemovidos((atual) => [...atual, item.chave]);
  }

  function salvar() {
    if (digitando) {
      toast.error('Há um marcador digitado e não adicionado. Clique em "Adicionar marcador" ou apague os campos.');
      return;
    }
    startSalvando(async () => {
      const result = await salvarMarcadores(
        patientId,
        exam.id,
        novos.map((n) => n.m),
        removidos,
      );
      if (!result.success) {
        toast.error("Não foi possível salvar os marcadores", { description: result.message });
        return;
      }
      toast.success(result.message ?? "Marcadores salvos.");
      fechar();
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : pedirParaFechar())}>
        <DialogContent className="flex max-h-[94vh] w-[96vw] max-w-6xl flex-col gap-0 overflow-hidden p-0">
          <div className="flex flex-wrap items-start gap-4 border-b px-5 py-4 pr-14 sm:px-6">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-success-soft text-primary">
              <FlaskConical className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-xl font-bold tracking-tight">
                Marcadores — coleta em {formatDate(exam.data_coleta)}
              </DialogTitle>
              <DialogDescription>
                {exam.laboratorio ? `${exam.laboratorio} · ` : ""}O sistema mostra o valor e a faixa de referência — a
                interpretação clínica é sempre do profissional.
              </DialogDescription>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border bg-muted/40 px-3 py-1.5 text-xs text-foreground">
              <BarChart3 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              {itens.length} {itens.length === 1 ? "marcador" : "marcadores"}
            </span>
          </div>

          <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 sm:p-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <section aria-labelledby="marcadores-coleta" className="space-y-3 rounded-xl border bg-muted/20 p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success-soft text-primary">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h3 id="marcadores-coleta" className="text-base font-semibold text-foreground">
                    Marcadores desta coleta
                  </h3>
                  <p className="text-xs text-muted-foreground">Os marcadores lançados nesta coleta e seus resultados.</p>
                </div>
              </div>
              {itens.length === 0 ? (
                <p className="rounded-lg border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground">
                  Nenhum marcador ainda. Use &quot;Adicionar marcador&quot; ao lado.
                </p>
              ) : (
                <ul className="space-y-2">
                  {itens.map((item) => (
                    <li key={item.chave}>
                      <CartaoMarcador item={item} onRemover={() => remover(item)} />
                    </li>
                  ))}
                </ul>
              )}
              {removidos.length > 0 && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  onClick={() => setRemovidos([])}
                >
                  <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Desfazer {removidos.length === 1 ? "a remoção" : `as ${removidos.length} remoções`}
                </button>
              )}
            </section>

            <section aria-labelledby="adicionar-marcador" className="space-y-4 rounded-xl border bg-card p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success-soft text-primary">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h3 id="adicionar-marcador" className="text-base font-semibold text-foreground">
                    Adicionar marcador
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Busque um marcador e informe o resultado e a faixa de referência.
                  </p>
                </div>
              </div>
              <LabMarkerForm
                patientId={patientId}
                onAdicionar={(m) => setNovos((atual) => [...atual, { chave: crypto.randomUUID(), m }])}
                onConteudoChange={setDigitando}
              />
            </section>
          </div>

          <div className="flex flex-col gap-3 border-t px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="flex items-start gap-2 text-xs text-muted-foreground" role="status" aria-live="polite">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {alteracoes === 0
                ? "Nada pendente. Os marcadores só são gravados ao clicar em Salvar alterações."
                : `${alteracoes} ${alteracoes === 1 ? "alteração ainda não salva" : "alterações ainda não salvas"} — clique em Salvar alterações para gravar.`}
            </p>
            <div className="flex shrink-0 gap-2 self-end sm:self-auto">
              <Button type="button" variant="outline" onClick={pedirParaFechar} disabled={salvando}>
                Cancelar
              </Button>
              <Button type="button" onClick={salvar} disabled={salvando || alteracoes === 0}>
                {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Salvar alterações
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmarSaida} onOpenChange={setConfirmarSaida}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar as alterações?</AlertDialogTitle>
            <AlertDialogDescription>
              {alteracoes > 0
                ? "Os marcadores adicionados ou tirados ainda não foram salvos e serão perdidos."
                : "Há um marcador digitado e não adicionado — ele será perdido."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction onClick={fechar}>Descartar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function CartaoMarcador({ item, onRemover }: { item: ItemDaLista; onRemover: () => void }) {
  const { m } = item;
  const min = m.referencia_min ?? null;
  const max = m.referencia_max ?? null;
  const fora = foraDaFaixa(m.valor, min, max);
  const faixa = textoDaFaixa(min, max, m.unidade);

  return (
    <div className={cn("rounded-xl border bg-card p-3 shadow-sm", item.tipo === "novo" && "border-primary/30")}>
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-success-soft text-primary">
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{m.nome_marcador}</p>
        {item.tipo === "novo" && <Badge variant="default">Novo</Badge>}
        {fora && <Badge variant="warning">fora da faixa de referência</Badge>}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" aria-label={`Ações: ${m.nome_marcador}`} title="Ações">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={onRemover}>
              <Trash2 className="h-4 w-4" />
              {item.tipo === "novo" ? "Tirar da lista" : "Remover marcador"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 sm:grid-cols-[auto_auto_minmax(0,1fr)]">
        <div className="pr-4 sm:border-r">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Resultado</p>
          <p className="text-2xl font-bold tabular-nums leading-tight text-foreground">{num(m.valor)}</p>
          <p className="text-xs text-muted-foreground">{m.unidade}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Faixa de referência</p>
          <p className="text-sm font-medium text-foreground">{faixa ?? "sem faixa informada"}</p>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <MarkerRangeBar valor={m.valor} min={min} max={max} />
        </div>
      </div>
    </div>
  );
}
