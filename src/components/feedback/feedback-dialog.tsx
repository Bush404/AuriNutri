"use client";

import { useId, useState } from "react";
import { usePathname } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { sendFeedback } from "@/lib/actions/feedback";
import { FEEDBACK_TIPOS, FEEDBACK_TIPO_LABELS } from "@/lib/validations/feedback";
import type { FeedbackTipo } from "@/lib/types/database.types";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface FeedbackDialogProps {
  /** Gatilho customizado — usado como item do menu do usuário na topbar. */
  trigger: React.ReactNode;
}

/**
 * Canal de feedback direto, acessível de qualquer tela da área logada.
 * Construído no lugar da comunidade da Fase 10 (adiada — depende de base de
 * usuários ativa): preparação prática para os primeiros usuários reais.
 *
 * Contexto (rota, navegador, tamanho de tela) é capturado automaticamente no
 * momento do envio, sem o profissional precisar digitar nada além da
 * mensagem — é o que torna "sugestão" acionável ("sugestão na tela de plano
 * alimentar" em vez de solta).
 */
export function FeedbackDialog({ trigger }: FeedbackDialogProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [tipo, setTipo] = useState<FeedbackTipo>("sugestao");
  const [mensagem, setMensagem] = useState("");
  const tipoLabelId = useId();

  function resetTudo() {
    setTipo("sugestao");
    setMensagem("");
    setEnviado(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!mensagem.trim()) {
      toast.error("Escreva sua mensagem antes de enviar.");
      return;
    }

    setLoading(true);
    const result = await sendFeedback({
      tipo,
      mensagem,
      rota: pathname,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      viewport: typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : undefined,
    });
    setLoading(false);

    if (!result.success) {
      toast.error("Não foi possível enviar", { description: result.message });
      return;
    }

    setEnviado(true);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetTudo();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        {enviado ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-primary-600" />
            <p className="text-base font-medium text-foreground">Agradecemos pelo Feedback!</p>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Fechar
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Enviar feedback</DialogTitle>
              <DialogDescription>Sugestão, problema ou elogio — sua mensagem vem direto pra mim.</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label id={tipoLabelId}>Tipo</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as FeedbackTipo)}>
                  <SelectTrigger aria-labelledby={tipoLabelId}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FEEDBACK_TIPOS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {FEEDBACK_TIPO_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="feedback_mensagem">Mensagem *</Label>
                <Textarea
                  id="feedback_mensagem"
                  rows={5}
                  placeholder="Conte o que aconteceu ou o que você gostaria de ver..."
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  disabled={loading}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Evite incluir nome, prontuário ou qualquer dado de paciente na mensagem — este canal não foi feito
                para dado de saúde de terceiro.
              </p>

              <DialogFooter>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Enviar
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
