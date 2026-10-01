"use client";

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createAnthropometricAttachment, updateAnthropometricAttachment } from "@/lib/actions/anthropometric-attachments";
import { ANEXO_ACCEPTED_EXTENSIONS, ANEXO_MAX_BYTES } from "@/lib/validations/anthropometric-attachment";
import type { AnthropometricAttachment } from "@/lib/types/database.types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const NUMEROS = [
  ["peso_kg", "Peso (kg)"],
  ["percentual_gordura", "% de gordura"],
  ["massa_livre_gordura_kg", "Massa livre de gordura (kg)"],
  ["massa_muscular_kg", "Massa muscular (kg)"],
] as const;

type Numero = (typeof NUMEROS)[number][0];

function inicial(a?: AnthropometricAttachment) {
  return {
    data_avaliacao: a?.data_avaliacao ?? new Date().toISOString().slice(0, 10),
    titulo: a?.titulo ?? "",
    observacoes: a?.observacoes ?? "",
    ...(Object.fromEntries(NUMEROS.map(([c]) => [c, a?.[c] != null ? String(a[c]) : ""])) as Record<Numero, string>),
  };
}

/** Anexar relatório externo (sem `attachment`) ou corrigir os dados de um já anexado. Controlado por `open`. */
export function AttachmentDialog({
  patientId,
  attachment,
  open,
  onOpenChange,
}: {
  patientId: string;
  attachment?: AnthropometricAttachment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [valores, setValores] = useState(() => inicial(attachment));
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const editando = Boolean(attachment);

  function mudar(open: boolean) {
    if (open) setValores(inicial(attachment));
    onOpenChange(open);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input = { ...valores, titulo: valores.titulo || undefined, observacoes: valores.observacoes || undefined };

    let result;
    if (editando) {
      setLoading(true);
      result = await updateAnthropometricAttachment(patientId, attachment!.id, input);
    } else {
      const file = inputRef.current?.files?.[0];
      if (!file) {
        toast.error("Selecione o arquivo do relatório.");
        return;
      }
      if (file.size > ANEXO_MAX_BYTES) {
        toast.error("Arquivo muito grande. O limite é 10MB.");
        return;
      }
      setLoading(true);
      const formData = new FormData();
      formData.set("file", file);
      result = await createAnthropometricAttachment(patientId, input, formData);
    }
    setLoading(false);

    if (!result.success) {
      toast.error(editando ? "Não foi possível atualizar o relatório" : "Não foi possível anexar o relatório", {
        description: result.message,
      });
      return;
    }
    toast.success(result.message ?? "Relatório salvo.");
    onOpenChange(false);
  }

  const set = (campo: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValores((v) => ({ ...v, [campo]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={mudar}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar relatório anexado" : "Anexar relatório externo"}</DialogTitle>
          <DialogDescription>
            Bioimpedância, DEXA ou laudo de outro profissional. Os números são opcionais — preenchidos, entram na evolução.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editando && (
            <div className="space-y-2">
              <Label htmlFor="anexo_arquivo">Arquivo (PDF, JPG, PNG ou WEBP, até 10MB) *</Label>
              <Input id="anexo_arquivo" ref={inputRef} type="file" accept={ANEXO_ACCEPTED_EXTENSIONS} disabled={loading} />
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="anexo_data">Data do relatório *</Label>
              <Input id="anexo_data" type="date" value={valores.data_avaliacao} onChange={set("data_avaliacao")} disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="anexo_titulo">Título</Label>
              <Input
                id="anexo_titulo"
                placeholder="Ex.: Bioimpedância InBody"
                maxLength={120}
                value={valores.titulo}
                onChange={set("titulo")}
                disabled={loading}
              />
            </div>
            {NUMEROS.map(([campo, label]) => (
              <div key={campo} className="space-y-2">
                <Label htmlFor={`anexo_${campo}`}>{label}</Label>
                <Input
                  id={`anexo_${campo}`}
                  inputMode="decimal"
                  value={valores[campo]}
                  onChange={set(campo)}
                  disabled={loading}
                />
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="anexo_obs">Observação</Label>
            <Textarea id="anexo_obs" rows={2} value={valores.observacoes} onChange={set("observacoes")} disabled={loading} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {editando ? "Salvar alterações" : "Anexar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
