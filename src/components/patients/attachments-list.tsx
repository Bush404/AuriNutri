"use client";

import { useState, useTransition } from "react";
import { ExternalLink, FileText, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteAnthropometricAttachment, getAnthropometricAttachmentSignedUrl } from "@/lib/actions/anthropometric-attachments";
import type { AnthropometricAttachment } from "@/lib/types/database.types";
import { formatDate } from "@/lib/utils";

import { AttachmentDialog } from "@/components/patients/attachment-dialog";
import { Button } from "@/components/ui/button";

function resumo(a: AnthropometricAttachment) {
  const partes = [
    a.peso_kg !== null && `${a.peso_kg} kg`,
    a.percentual_gordura !== null && `${a.percentual_gordura}% gordura`,
    a.massa_livre_gordura_kg !== null && `${a.massa_livre_gordura_kg} kg livre de gordura`,
    a.massa_muscular_kg !== null && `${a.massa_muscular_kg} kg músculo`,
  ].filter(Boolean);
  return partes.join(" · ");
}

export function AttachmentsList({ patientId, attachments }: { patientId: string; attachments: AnthropometricAttachment[] }) {
  const [editando, setEditando] = useState<AnthropometricAttachment | null>(null);
  const [isPending, startTransition] = useTransition();

  async function abrir(path: string) {
    // Abre a aba já na hora do clique (antes do await) para o navegador não bloquear como pop-up.
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

  function excluir(id: string) {
    startTransition(async () => {
      const result = await deleteAnthropometricAttachment(patientId, id);
      if (!result.success) {
        toast.error("Não foi possível excluir o relatório", { description: result.message });
        return;
      }
      toast.success("Relatório excluído.");
    });
  }

  return (
    <>
      <ul className="divide-y divide-border">
        {attachments.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
            <FileText className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                {formatDate(a.data_avaliacao)} — {a.titulo || a.arquivo_nome || "Relatório externo"}
              </p>
              {(resumo(a) || a.observacoes) && (
                <p className="text-xs text-muted-foreground">
                  {[resumo(a), a.observacoes].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => abrir(a.arquivo_path)}>
                <ExternalLink className="h-4 w-4" />
                Abrir
              </Button>
              <Button variant="ghost" size="icon" aria-label="Editar dados do relatório" onClick={() => setEditando(a)}>
                <Pencil className="h-4 w-4 text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Excluir relatório" disabled={isPending} onClick={() => excluir(a.id)}>
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {editando && (
        <AttachmentDialog
          key={editando.id}
          patientId={patientId}
          attachment={editando}
          open
          onOpenChange={(o) => !o && setEditando(null)}
        />
      )}
    </>
  );
}
