"use client";

import { useState } from "react";
import { Camera, Eye, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { PatientPhoto, TipoFotoEvolucao } from "@/lib/types/database.types";
import { deletePatientPhoto, getPatientPhotoSignedUrl } from "@/lib/actions/patient-photos";
import { formatDate } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { NewPatientPhotoDialog } from "@/components/patients/new-patient-photo-dialog";

const TIPO_LABELS: Record<TipoFotoEvolucao, string> = {
  frente: "Frente",
  perfil: "Perfil",
  costas: "Costas",
};

interface PatientPhotosPanelProps {
  patientId: string;
  photos: PatientPhoto[];
  consentimentoAtivoFotos: boolean;
}

export function PatientPhotosPanel({ patientId, photos, consentimentoAtivoFotos }: PatientPhotosPanelProps) {
  const fotosOrdenadas = photos
    .slice()
    .sort((a, b) => new Date(b.data_registro).getTime() - new Date(a.data_registro).getTime());

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Evolução fotográfica</CardTitle>
        {consentimentoAtivoFotos ? (
          <NewPatientPhotoDialog patientId={patientId} />
        ) : (
          <p className="max-w-xs text-right text-xs text-muted-foreground">
            Registre o consentimento de fotos na aba Consentimentos para poder adicionar fotos deste paciente.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-xs text-muted-foreground">
          Dado sensível (LGPD) — cada foto exibida gera um link temporário (15 min) e fica registrada em auditoria
          quem visualizou e quando.
        </p>

        {fotosOrdenadas.length === 0 ? (
          <EmptyState
            icon={Camera}
            title="Nenhuma foto registrada"
            description="Registre a primeira foto de evolução deste paciente."
          />
        ) : (
          <>
            <div className="space-y-2">
              {fotosOrdenadas.map((foto) => (
                <PhotoRow key={foto.id} patientId={patientId} photo={foto} />
              ))}
            </div>

            <PhotoComparison photos={fotosOrdenadas} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PhotoRow({ patientId, photo }: { patientId: string; photo: PatientPhoto }) {
  const [isPending, setPending] = useState(false);

  async function handleDelete() {
    setPending(true);
    const result = await deletePatientPhoto(patientId, photo.id);
    setPending(false);
    if (!result.success) {
      toast.error("Não foi possível excluir a foto", { description: result.message });
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">{formatDate(photo.data_registro)}</span>
        <Badge variant="outline">{TIPO_LABELS[photo.tipo]}</Badge>
      </div>
      <div className="flex items-center gap-1">
        <PhotoViewButton photoId={photo.id} label={`${TIPO_LABELS[photo.tipo]} — ${formatDate(photo.data_registro)}`} />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir esta foto?</AlertDialogTitle>
              <AlertDialogDescription>
                O arquivo é removido do armazenamento de verdade, não só da lista — não há como recuperar depois.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

/** Busca a URL assinada só quando o diálogo abre, e esquece assim que fecha — nunca guarda além do necessário. */
function PhotoViewButton({ photoId, label }: { photoId: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleOpenChange(v: boolean) {
    setOpen(v);
    if (v) {
      setLoading(true);
      const signed = await getPatientPhotoSignedUrl(photoId);
      setLoading(false);
      setUrl(signed);
    } else {
      setUrl(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button variant="ghost" size="icon" onClick={() => handleOpenChange(true)}>
        <Eye className="h-4 w-4" />
      </Button>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>
        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && url && (
          // eslint-disable-next-line @next/next/no-img-element -- URL assinada temporária (15min), não faz sentido pelo pipeline de otimização de imagens do Next.
          <img src={url} alt={label} className="w-full rounded-md" />
        )}
        {!loading && !url && <p className="py-8 text-center text-sm text-destructive">Não foi possível carregar a foto.</p>}
      </DialogContent>
    </Dialog>
  );
}

function PhotoComparison({ photos }: { photos: PatientPhoto[] }) {
  const tiposComDuasFotos = (Object.keys(TIPO_LABELS) as TipoFotoEvolucao[]).filter(
    (tipo) => photos.filter((p) => p.tipo === tipo).length >= 2
  );

  const [tipo, setTipo] = useState<TipoFotoEvolucao | "">(tiposComDuasFotos[0] ?? "");
  const [idA, setIdA] = useState("");
  const [idB, setIdB] = useState("");
  const [urls, setUrls] = useState<{ a: string | null; b: string | null } | null>(null);
  const [loading, setLoading] = useState(false);

  if (tiposComDuasFotos.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Registre pelo menos duas fotos do mesmo ângulo para comparar lado a lado.
      </p>
    );
  }

  const doTipo = photos.filter((p) => p.tipo === tipo);

  async function handleComparar() {
    if (!idA || !idB) {
      toast.error("Selecione as duas datas para comparar.");
      return;
    }
    setLoading(true);
    const [a, b] = await Promise.all([getPatientPhotoSignedUrl(idA), getPatientPhotoSignedUrl(idB)]);
    setLoading(false);
    setUrls({ a, b });
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-4">
      <h3 className="text-sm font-semibold text-foreground">Comparar evolução</h3>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Ângulo</label>
          <Select
            value={tipo}
            onValueChange={(v) => {
              setTipo(v as TipoFotoEvolucao);
              setIdA("");
              setIdB("");
              setUrls(null);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tiposComDuasFotos.map((t) => (
                <SelectItem key={t} value={t}>
                  {TIPO_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Data A</label>
          <Select value={idA} onValueChange={setIdA}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {doTipo.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {formatDate(p.data_registro)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Data B</label>
          <Select value={idB} onValueChange={setIdB}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {doTipo.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {formatDate(p.data_registro)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button type="button" size="sm" onClick={handleComparar} disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Comparar
      </Button>

      {urls && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">{doTipo.find((p) => p.id === idA) && formatDate(doTipo.find((p) => p.id === idA)!.data_registro)}</p>
            {urls.a ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL assinada temporária.
              <img src={urls.a} alt="Foto A" className="w-full rounded-md border border-border" />
            ) : (
              <p className="text-sm text-destructive">Não foi possível carregar.</p>
            )}
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">{doTipo.find((p) => p.id === idB) && formatDate(doTipo.find((p) => p.id === idB)!.data_registro)}</p>
            {urls.b ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL assinada temporária.
              <img src={urls.b} alt="Foto B" className="w-full rounded-md border border-border" />
            ) : (
              <p className="text-sm text-destructive">Não foi possível carregar.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
