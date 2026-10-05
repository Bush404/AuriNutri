"use client";

import { useState, useTransition, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, FileDown, LineChart, Loader2, MoreVertical, Paperclip, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteAssessment, iniciarAvaliacao } from "@/lib/actions/clinical";
import { deleteAnthropometricAttachment, getAnthropometricAttachmentSignedUrl } from "@/lib/actions/anthropometric-attachments";
import { temMedida } from "@/lib/anthropometry-overview";
import type { ChaveItem, LinhaAntropometria } from "@/lib/evolution";
import type { AnthropometricAttachment } from "@/lib/types/database.types";
import { cn, formatDate } from "@/lib/utils";

import { AttachmentDialog } from "@/components/patients/attachment-dialog";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const num = (v: number | null, casas = 1) =>
  v === null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

const subtitulo = (l: LinhaAntropometria) =>
  l.origem === "anexo" ? `Relatório externo${l.rotulo !== "Relatório externo" ? ` · ${l.rotulo}` : ""}` : l.rotulo;

/** Clique veio de um link, botão ou menu dentro da linha? Então a linha não abre. */
const cliqueInterno = (e: MouseEvent) => Boolean((e.target as HTMLElement).closest("a,button,[role=menu],[role=menuitem]"));

/**
 * "Avaliações realizadas": todas as avaliações e relatórios anexados, mais
 * recente primeiro. Clicar na linha abre a avaliação (ou o arquivo do
 * relatório); as ações que antes ficavam soltas (Evolução | Relatório |
 * Editar | Duplicar | Excluir) estão no menu ⋮ de cada linha.
 */
export function AnthropometryHistory({
  patientId,
  linhas,
  atual,
  attachments,
  onEvolucao,
}: {
  patientId: string;
  linhas: LinhaAntropometria[];
  /** Chave da avaliação usada no resumo (recebe a etiqueta "Atual"). */
  atual: ChaveItem | null;
  attachments: AnthropometricAttachment[];
  onEvolucao: (chave: ChaveItem) => void;
}) {
  const router = useRouter();
  const [editandoAnexo, setEditandoAnexo] = useState<AnthropometricAttachment | null>(null);
  const [excluindo, setExcluindo] = useState<LinhaAntropometria | null>(null);
  const [isPending, startTransition] = useTransition();
  const [duplicando, startDuplicando] = useTransition();

  const hrefAvaliacao = (l: LinhaAntropometria) => `/pacientes/${patientId}/avaliacoes/${l.id}`;

  // Duplicar cria a nova avaliação na hora (com as medidas desta) e abre a página dela.
  function duplicar(assessmentId: string) {
    startDuplicando(async () => {
      const r = await iniciarAvaliacao(patientId, "adulto", assessmentId);
      if (r && !r.success) toast.error("Não foi possível duplicar a avaliação", { description: r.message });
    });
  }

  async function abrirArquivo(id: string) {
    const anexo = attachments.find((x) => x.id === id);
    if (!anexo) return;
    // Abre a aba na hora do clique (antes do await) para o navegador não bloquear como pop-up.
    const aba = window.open("", "_blank");
    const url = await getAnthropometricAttachmentSignedUrl(anexo.arquivo_path);
    if (!url) {
      aba?.close();
      toast.error("Não foi possível gerar o link do arquivo.");
      return;
    }
    if (aba) {
      aba.opener = null;
      aba.location.href = url;
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  function abrir(l: LinhaAntropometria) {
    if (l.origem === "avaliacao") router.push(hrefAvaliacao(l));
    else void abrirArquivo(l.id);
  }

  function confirmarExclusao() {
    const alvo = excluindo;
    if (!alvo) return;
    startTransition(async () => {
      const result =
        alvo.origem === "avaliacao"
          ? await deleteAssessment(patientId, alvo.id)
          : await deleteAnthropometricAttachment(patientId, alvo.id);
      setExcluindo(null);
      if (!result.success) {
        toast.error("Não foi possível excluir", { description: result.message });
        return;
      }
      toast.success(alvo.origem === "avaliacao" ? "Avaliação excluída." : "Relatório excluído.");
    });
  }

  function menu(l: LinhaAntropometria) {
    const ocupado = isPending || duplicando;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 px-0 text-muted-foreground"
            aria-label={`Ações: ${subtitulo(l)} de ${formatDate(l.data)}`}
            title="Ações"
          >
            {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {l.origem === "avaliacao" ? (
            <>
              <DropdownMenuItem asChild>
                <Link href={hrefAvaliacao(l)}>
                  <Pencil className="h-4 w-4" />
                  Editar
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onEvolucao(l.chave)}>
                <LineChart className="h-4 w-4" />
                Ver evolução
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={`${hrefAvaliacao(l)}/relatorio`} download>
                  <FileDown className="h-4 w-4" />
                  Relatório (PDF)
                </a>
              </DropdownMenuItem>
              {l.tipo === "adulto" && (
                <DropdownMenuItem onSelect={() => duplicar(l.id)} disabled={ocupado}>
                  <Copy className="h-4 w-4" />
                  Duplicar
                </DropdownMenuItem>
              )}
            </>
          ) : (
            <>
              <DropdownMenuItem onSelect={() => void abrirArquivo(l.id)}>
                <Paperclip className="h-4 w-4" />
                Abrir arquivo
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onEvolucao(l.chave)}>
                <LineChart className="h-4 w-4" />
                Ver evolução
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setEditandoAnexo(attachments.find((x) => x.id === l.id) ?? null)}>
                <Pencil className="h-4 w-4" />
                Editar
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setExcluindo(l)}
            disabled={ocupado}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  function etiqueta(l: LinhaAntropometria) {
    if (l.chave === atual) return <Badge variant="success">Atual</Badge>;
    if (l.origem === "anexo") return <Badge variant="neutral">Externo</Badge>;
    if (l.tipo === "crianca") return <Badge variant="info">Infantil</Badge>;
    if (!temMedida(l)) return <Badge variant="neutral">Sem medidas</Badge>;
    return null;
  }

  function data(l: LinhaAntropometria) {
    const conteudo = (
      <>
        <span className={cn("block font-medium", temMedida(l) ? "text-foreground" : "text-muted-foreground")}>
          {formatDate(l.data)}
        </span>
        {/* Só o relatório externo tem um título próprio para mostrar. */}
        {l.origem === "anexo" && l.rotulo !== "Relatório externo" && (
          <span className="block text-xs font-normal text-muted-foreground">{l.rotulo}</span>
        )}
      </>
    );
    return l.origem === "avaliacao" ? (
      <Link href={hrefAvaliacao(l)} className="rounded-sm text-left hover:underline focus-visible:underline focus-visible:outline-none">
        {conteudo}
      </Link>
    ) : (
      <button
        type="button"
        onClick={() => void abrirArquivo(l.id)}
        className="rounded-sm text-left hover:underline focus-visible:underline focus-visible:outline-none"
      >
        {conteudo}
      </button>
    );
  }

  return (
    <>
      {/* Computador e tablet: tabela, rolando por dentro. */}
      <div className="hidden max-h-[24rem] overflow-y-auto sm:block">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-[1] bg-card text-xs text-muted-foreground">
            <tr className="[&>th:first-child]:rounded-l-lg [&>th:last-child]:rounded-r-lg [&>th]:bg-muted/70">
              <th scope="col" className="py-2 pl-3 pr-2 text-left font-medium">Data</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Peso (kg)</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">IMC (kg/m²)</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">% Gordura</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">MLG (kg)</th>
              <th scope="col" className="w-0 px-2 py-2">
                <span className="sr-only">Situação</span>
              </th>
              <th scope="col" className="w-0 py-2 pl-1 pr-2">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr
                key={l.chave}
                onClick={(e) => !cliqueInterno(e) && abrir(l)}
                className={cn(
                  "cursor-pointer border-b border-border/70 transition-colors last:border-0 hover:bg-muted/50",
                  l.chave === atual && "bg-success-soft/30",
                  !temMedida(l) && "text-muted-foreground [&_td]:text-muted-foreground",
                )}
              >
                <td className="py-3 pl-3 pr-2">
                  {data(l)}
                </td>
                <td className="px-2 py-3 text-right tabular-nums">{num(l.pesoKg)}</td>
                <td className="px-2 py-3 text-right tabular-nums">{num(l.imc)}</td>
                <td className="px-2 py-3 text-right tabular-nums">{num(l.percentualGordura)}</td>
                <td className="px-2 py-3 text-right tabular-nums">{num(l.massaLivreKg)}</td>
                <td className="px-2 py-3">
                  {etiqueta(l)}
                </td>
                <td className="py-3 pl-1 pr-2 text-right">
                  {menu(l)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Celular: um cartão por avaliação. */}
      <ul className="space-y-2 sm:hidden">
        {linhas.map((l) => (
          <li
            key={l.chave}
            className={cn("rounded-lg border px-3 py-3", l.chave === atual && "border-success/30 bg-success-soft/30")}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 text-sm">
                {data(l)}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {etiqueta(l)}
                {menu(l)}
              </div>
            </div>
            <dl className="mt-2 grid grid-cols-4 gap-2 text-xs">
              {(
                [
                  ["Peso", l.pesoKg],
                  ["IMC", l.imc],
                  ["% Gord.", l.percentualGordura],
                  ["MLG", l.massaLivreKg],
                ] as const
              ).map(([rotulo, v]) => (
                <div key={rotulo}>
                  <dt className="text-muted-foreground">{rotulo}</dt>
                  <dd className="font-medium tabular-nums text-foreground">{num(v)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>

      {editandoAnexo && (
        <AttachmentDialog
          key={editandoAnexo.id}
          patientId={patientId}
          attachment={editandoAnexo}
          open
          onOpenChange={(o) => !o && setEditandoAnexo(null)}
        />
      )}
      <AlertDialog open={Boolean(excluindo)} onOpenChange={(o) => !o && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {excluindo?.origem === "anexo" ? "relatório" : "avaliação"}?</AlertDialogTitle>
            <AlertDialogDescription>
              {excluindo ? `${excluindo.origem === "anexo" ? "Relatório" : "Avaliação"} de ${formatDate(excluindo.data)}. ` : ""}
              Ela some da lista e da evolução.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExclusao}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
