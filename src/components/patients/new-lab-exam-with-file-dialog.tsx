"use client";

import { useRef, useState } from "react";
import { Loader2, Paperclip, Plus } from "lucide-react";
import { toast } from "sonner";

import { createLabExam, deleteLabExam, uploadLabExamFile } from "@/lib/actions/lab-exams";
import { LAB_EXAM_FILE_ACCEPTED_EXTENSIONS, LAB_EXAM_FILE_MAX_BYTES } from "@/lib/validations/lab-exam";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface NewLabExamWithFileDialogProps {
  patientId: string;
  consentimentoAtivoExames: boolean;
}

/**
 * Cria um exame JÁ com o arquivo anexado, num único passo — é o que
 * mantém a tela "Anexar PDF" independente da tela "Marcadores": todo
 * exame criado por aqui nasce com `arquivo_path` preenchido, então o
 * filtro `arquivo_path is not null` (usado para listar esta tela) sempre
 * o inclui e ele nunca aparece na lista de marcadores (que filtra o
 * oposto). Se o upload falhar depois de criar o registro, o exame criado
 * é desfeito (soft delete) para não deixar um registro "fantasma" sem
 * arquivo que vazaria pra lista de marcadores.
 */
export function NewLabExamWithFileDialog({ patientId, consentimentoAtivoExames }: NewLabExamWithFileDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dataColeta, setDataColeta] = useState(new Date().toISOString().slice(0, 10));
  const [laboratorio, setLaboratorio] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [arquivoNome, setArquivoNome] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function resetTudo() {
    setDataColeta(new Date().toISOString().slice(0, 10));
    setLaboratorio("");
    setObservacoes("");
    setArquivoNome(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const file = inputRef.current?.files?.[0];
    if (!dataColeta) {
      toast.error("Informe a data da coleta.");
      return;
    }
    if (!file) {
      toast.error("Selecione o arquivo do exame.");
      return;
    }
    if (file.size > LAB_EXAM_FILE_MAX_BYTES) {
      toast.error("Arquivo muito grande. O limite é 10MB.");
      return;
    }

    setLoading(true);

    const created = await createLabExam(patientId, {
      data_coleta: dataColeta,
      laboratorio: laboratorio || undefined,
      observacoes: observacoes || undefined,
    });

    if (!created.success || !created.id) {
      setLoading(false);
      toast.error("Não foi possível registrar o exame", { description: created.message });
      return;
    }

    const formData = new FormData();
    formData.set("file", file);
    const uploaded = await uploadLabExamFile(patientId, created.id, formData);

    setLoading(false);

    if (!uploaded.success) {
      // Desfaz o exame criado — sem arquivo, ele não pertence a lugar nenhum.
      await deleteLabExam(patientId, created.id);
      toast.error("Não foi possível anexar o arquivo", { description: uploaded.message });
      return;
    }

    toast.success("Exame e arquivo registrados.");
    resetTudo();
    setOpen(false);
  }

  if (!consentimentoAtivoExames) {
    return (
      <Button size="sm" disabled title="Registre o consentimento de exames para poder anexar arquivos.">
        <Plus className="h-4 w-4" />
        Novo exame
      </Button>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetTudo();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          Novo exame
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anexar exame</DialogTitle>
          <DialogDescription>Registra o exame e já sobe o arquivo, num só passo.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="data_coleta_arquivo">Data da coleta *</Label>
            <Input
              id="data_coleta_arquivo"
              type="date"
              value={dataColeta}
              onChange={(e) => setDataColeta(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="laboratorio_arquivo">Laboratório</Label>
            <Input
              id="laboratorio_arquivo"
              placeholder="Ex.: Fleury"
              value={laboratorio}
              onChange={(e) => setLaboratorio(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes_arquivo">Observações</Label>
            <Textarea
              id="observacoes_arquivo"
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label>Arquivo (PDF/imagem) *</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => inputRef.current?.click()}
            >
              <Paperclip className="h-4 w-4" />
              {arquivoNome ?? "Selecionar arquivo"}
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept={LAB_EXAM_FILE_ACCEPTED_EXTENSIONS}
              className="hidden"
              onChange={(e) => setArquivoNome(e.target.files?.[0]?.name ?? null)}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Registrar exame
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
