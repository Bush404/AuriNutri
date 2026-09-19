"use client";

import { useRef, useState, useTransition } from "react";
import { FileText, Loader2, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { LabExam, LabMarker } from "@/lib/types/database.types";
import { deleteLabExam, getLabExamFileSignedUrl, uploadLabExamFile } from "@/lib/actions/lab-exams";
import { deleteLabMarker } from "@/lib/actions/lab-markers";
import { LAB_EXAM_FILE_ACCEPTED_EXTENSIONS, LAB_EXAM_FILE_MAX_BYTES } from "@/lib/validations/lab-exam";
import { formatDate } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { LabMarkerForm } from "@/components/patients/lab-marker-form";

export interface LabExamWithMarkers extends LabExam {
  lab_markers: LabMarker[];
}

interface LabExamRowProps {
  patientId: string;
  exam: LabExamWithMarkers;
  /** Qual bloco mostrar — as duas telas (Arquivos/Marcadores) são separadas, nunca aparecem juntas. */
  foco: "arquivo" | "marcadores";
  /** REGRA ESTRUTURAL do Bloco A: sem consentimento ativo, a opção de anexar arquivo não aparece — não é um aviso, é ausência. */
  /** Só relevante quando foco="arquivo". */
  consentimentoAtivoExames?: boolean;
}

/** Um exame (data + laboratório), mostrando só o bloco de arquivo OU só o de marcadores — nunca os dois juntos. */
export function LabExamRow({ patientId, exam, foco, consentimentoAtivoExames }: LabExamRowProps) {
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDeleteExam() {
    startTransition(async () => {
      const result = await deleteLabExam(patientId, exam.id);
      if (!result.success) {
        toast.error("Não foi possível excluir o exame", { description: result.message });
      }
    });
  }

  function handleDeleteMarker(markerId: string) {
    startTransition(async () => {
      const result = await deleteLabMarker(patientId, markerId);
      if (!result.success) {
        toast.error("Não foi possível remover o marcador", { description: result.message });
      }
    });
  }

  async function handleVerArquivo() {
    if (!exam.arquivo_path) return;
    const url = await getLabExamFileSignedUrl(exam.arquivo_path);
    if (!url) {
      toast.error("Não foi possível gerar o link do arquivo.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > LAB_EXAM_FILE_MAX_BYTES) {
      toast.error("Arquivo muito grande. O limite é 10MB.");
      e.target.value = "";
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.set("file", file);
    const result = await uploadLabExamFile(patientId, exam.id, formData);
    setUploading(false);
    e.target.value = "";

    if (!result.success) {
      toast.error("Não foi possível enviar o arquivo", { description: result.message });
      return;
    }
    toast.success("Arquivo anexado.");
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <p className="font-medium text-foreground">
            Coleta em {formatDate(exam.data_coleta)}
            {exam.laboratorio && <span className="text-muted-foreground"> · {exam.laboratorio}</span>}
          </p>
          {exam.observacoes && <p className="mt-1 text-sm text-muted-foreground">{exam.observacoes}</p>}
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir exame?</AlertDialogTitle>
              <AlertDialogDescription>
                {foco === "arquivo"
                  ? "Isso remove o registro deste exame, inclusive os marcadores lançados nele (se houver). O arquivo anexado não é apagado do armazenamento por esta ação."
                  : "Isso remove o registro deste exame, inclusive o arquivo anexado (se houver) deixa de ser listado aqui — o arquivo em si não é apagado do armazenamento por esta ação."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteExam}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardHeader>

      <CardContent>
        {foco === "arquivo" ? (
          exam.arquivo_path ? (
            <Button type="button" size="sm" variant="outline" onClick={handleVerArquivo}>
              <FileText className="h-4 w-4" />
              Ver arquivo
            </Button>
          ) : consentimentoAtivoExames ? (
            <>
              <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                Anexar PDF/imagem
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept={LAB_EXAM_FILE_ACCEPTED_EXTENSIONS}
                className="hidden"
                onChange={handleFileChange}
              />
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Registre o consentimento de exames na aba Consentimentos para poder anexar o arquivo deste exame.
            </p>
          )
        ) : (
          <div className="space-y-4">
            {exam.lab_markers.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Marcador</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead>Referência</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exam.lab_markers.map((marker) => (
                    <TableRow key={marker.id}>
                      <TableCell className="font-medium">{marker.nome_marcador}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span>
                            {marker.valor} {marker.unidade}
                          </span>
                          {marker.fora_da_faixa && (
                            <Badge variant="outline" className="text-[10px]">
                              fora da faixa de referência
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {marker.referencia_min !== null || marker.referencia_max !== null
                          ? `${marker.referencia_min ?? "—"} a ${marker.referencia_max ?? "—"} ${marker.unidade}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteMarker(marker.id)}
                          disabled={isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <LabMarkerForm patientId={patientId} examId={exam.id} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
