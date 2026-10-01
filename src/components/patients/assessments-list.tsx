"use client";

import { Fragment, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { deleteAssessment, iniciarAvaliacao } from "@/lib/actions/clinical";
import { deleteAnthropometricAttachment, getAnthropometricAttachmentSignedUrl } from "@/lib/actions/anthropometric-attachments";
import { itensDisponiveis, rotuloAvaliacao, type ChaveItem } from "@/lib/evolution";
import type { AnthropometricAssessment, AnthropometricAttachment } from "@/lib/types/database.types";
import { formatDate } from "@/lib/utils";

import { AttachmentDialog } from "@/components/patients/attachment-dialog";
import { EvolutionDialog } from "@/components/patients/evolution-dialog";
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

type Linha =
  | { tipo: "avaliacao"; chave: ChaveItem; data: string; a: AnthropometricAssessment }
  | { tipo: "anexo"; chave: ChaveItem; data: string; x: AnthropometricAttachment };

const acao =
  "text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:underline disabled:opacity-50";

/**
 * Aba "Antropometria Geral" (formato pedido em 30/09/2026, a partir do
 * WebDiet): só a lista das avaliações e relatórios anexados por data, com
 * Evolução | Relatório | Editar | Duplicar | Excluir.
 */
export function AssessmentsList({
  patientId,
  assessments,
  attachments,
}: {
  patientId: string;
  assessments: AnthropometricAssessment[];
  attachments: AnthropometricAttachment[];
}) {
  const [evolucaoDe, setEvolucaoDe] = useState<ChaveItem | null>(null);
  const [editandoAnexo, setEditandoAnexo] = useState<AnthropometricAttachment | null>(null);
  const [excluindo, setExcluindo] = useState<Linha | null>(null);
  const [isPending, startTransition] = useTransition();
  const [duplicando, startDuplicando] = useTransition();

  // Duplicar cria a nova avaliação na hora (com as medidas desta) e abre a página dela.
  function duplicar(assessmentId: string) {
    startDuplicando(async () => {
      const r = await iniciarAvaliacao(patientId, "adulto", assessmentId);
      if (r && !r.success) toast.error("Não foi possível duplicar a avaliação", { description: r.message });
    });
  }

  const itens = itensDisponiveis({ assessments, attachments });
  const linhas: Linha[] = itens.map((i) =>
    i.origem === "avaliacao"
      ? { tipo: "avaliacao", chave: i.chave, data: i.data, a: assessments.find((a) => `a:${a.id}` === i.chave)! }
      : { tipo: "anexo", chave: i.chave, data: i.data, x: attachments.find((x) => `x:${x.id}` === i.chave)! }
  );

  async function abrirArquivo(path: string) {
    // Abre a aba na hora do clique (antes do await) para o navegador não bloquear como pop-up.
    const aba = window.open("", "_blank");
    const url = await getAnthropometricAttachmentSignedUrl(path);
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

  function confirmarExclusao() {
    const alvo = excluindo;
    if (!alvo) return;
    startTransition(async () => {
      const result =
        alvo.tipo === "avaliacao"
          ? await deleteAssessment(patientId, alvo.a.id)
          : await deleteAnthropometricAttachment(patientId, alvo.x.id);
      setExcluindo(null);
      if (!result.success) {
        toast.error("Não foi possível excluir", { description: result.message });
        return;
      }
      toast.success(alvo.tipo === "avaliacao" ? "Avaliação excluída." : "Relatório excluído.");
    });
  }

  return (
    <>
      <ul className="space-y-2">
        {linhas.map((l) => {
          const titulo =
            l.tipo === "avaliacao" ? rotuloAvaliacao(l.a) : `Relatório externo${l.x.titulo ? ` (${l.x.titulo})` : ""}`;
          const acoes: ReactNode[] = [
            <button key="evo" type="button" className={acao} onClick={() => setEvolucaoDe(l.chave)}>
              Evolução
            </button>,
          ];
          if (l.tipo === "avaliacao") {
            acoes.push(
              <a key="rel" className={acao} href={`/pacientes/${patientId}/avaliacoes/${l.a.id}/relatorio`} download>
                Relatório
              </a>,
              <Link key="edit" className={acao} href={`/pacientes/${patientId}/avaliacoes/${l.a.id}`}>
                Editar
              </Link>
            );
            if (l.a.tipo === "adulto") {
              acoes.push(
                <button key="dup" type="button" className={acao} disabled={duplicando} onClick={() => duplicar(l.a.id)}>
                  Duplicar
                </button>
              );
            }
          } else {
            acoes.push(
              <button key="abrir" type="button" className={acao} onClick={() => abrirArquivo(l.x.arquivo_path)}>
                Abrir arquivo
              </button>,
              <button key="edit" type="button" className={acao} onClick={() => setEditandoAnexo(l.x)}>
                Editar
              </button>
            );
          }
          acoes.push(
            <button key="del" type="button" className={acao} disabled={isPending} onClick={() => setExcluindo(l)}>
              Excluir
            </button>
          );

          return (
            <li
              key={l.chave}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-md bg-muted/60 px-4 py-3"
            >
              <p className="text-sm text-foreground">
                {titulo} - Realizado em {formatDate(l.data)}
              </p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1" aria-label={`Ações: ${titulo} de ${formatDate(l.data)}`}>
                {acoes.map((a, i) => (
                  <Fragment key={i}>
                    {i > 0 && (
                      <span className="text-muted-foreground" aria-hidden="true">
                        |
                      </span>
                    )}
                    {a}
                  </Fragment>
                ))}
              </div>
            </li>
          );
        })}
      </ul>

      {evolucaoDe && (
        <EvolutionDialog
          key={evolucaoDe}
          patientId={patientId}
          itens={itens}
          aPartirDe={evolucaoDe}
          open
          onOpenChange={(o) => !o && setEvolucaoDe(null)}
        />
      )}
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
            <AlertDialogTitle>Excluir {excluindo?.tipo === "anexo" ? "relatório" : "avaliação"}?</AlertDialogTitle>
            <AlertDialogDescription>
              {excluindo ? `${excluindo.tipo === "anexo" ? "Relatório" : "Avaliação"} de ${formatDate(excluindo.data)}. ` : ""}
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
