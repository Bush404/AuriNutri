"use client";

import { useState, useTransition } from "react";
import { Loader2, MessageCircle, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { PlanShareToken } from "@/lib/types/database.types";
import { createPlanShareLink, revokePlanShareLink } from "@/lib/actions/plan-share";
import { formatDate } from "@/lib/utils";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { planShareLinkStatus, findActivePlanShareLink } from "@/lib/plan-share-status";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface SharePlanDialogProps {
  planId: string;
  planNome: string;
  patientNome: string;
  patientTelefone: string | null;
  shareLinks: PlanShareToken[];
}

export function SharePlanDialog({ planId, planNome, patientNome, patientTelefone, shareLinks }: SharePlanDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const activeLink = findActivePlanShareLink(shareLinks);

  function handleCreate() {
    startTransition(async () => {
      const result = await createPlanShareLink(planId);
      if (!result.success) {
        toast.error("Não foi possível gerar o link", { description: result.message });
        return;
      }
      toast.success("Link gerado — válido por 90 dias.");
    });
  }

  function handleRevoke(tokenId: string) {
    startTransition(async () => {
      const result = await revokePlanShareLink(tokenId, planId);
      if (!result.success) {
        toast.error("Não foi possível revogar", { description: result.message });
        return;
      }
      toast.success("Link revogado — quem já tinha o link não consegue mais abrir.");
    });
  }

  function getWhatsAppHref() {
    if (!activeLink) return "#";
    const url = activeLink.token
      ? `${window.location.origin}/compartilhado/${activeLink.token}`
      : activeLink.signed_url;
    const mensagem = `Olá, ${patientNome}! Segue o link do seu plano alimentar "${planNome}": ${url}`;
    return buildWhatsAppUrl(patientTelefone, mensagem);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="h-4 w-4" />
          Compartilhar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Compartilhar plano com o paciente</DialogTitle>
          <DialogDescription>
            Gera um link para o PDF do plano, válido por 90 dias. O WhatsApp não permite anexar
            arquivo direto por link — por isso a mensagem leva o link, não o PDF anexado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {shareLinks.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum link gerado ainda para este plano.</p>
          )}
          {shareLinks.map((link) => {
            const status = planShareLinkStatus(link);
            return (
              <div
                key={link.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
              >
                <div className="text-sm">
                  <Badge variant={status.tone}>{status.label}</Badge>
                  <span className="ml-2 text-xs text-muted-foreground">
                    Expira em {formatDate(link.expires_at.slice(0, 10))}
                  </span>
                </div>
                {status.label === "Ativo" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRevoke(link.id)}
                    disabled={isPending}
                    title="Revogar link"
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row">
          <Button type="button" variant="outline" onClick={handleCreate} disabled={isPending} className="flex-1">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
            Gerar novo link
          </Button>

          {activeLink && (
            <Button type="button" asChild className="flex-1">
              <a href={getWhatsAppHref()} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" />
                Enviar por WhatsApp
              </a>
            </Button>
          )}
        </div>

        {activeLink && !patientTelefone && (
          <p className="text-xs text-muted-foreground">
            O paciente não tem telefone cadastrado — o WhatsApp vai abrir sem número, pra você
            escolher o contato manualmente.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
