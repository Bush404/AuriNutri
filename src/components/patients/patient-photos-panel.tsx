"use client";

import { useId, useState } from "react";
import { ArrowLeftRight, ArrowUpDown, Camera, Columns2, Eye, ImageIcon, Info, Loader2, Lock, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { PatientPhoto, TipoFotoEvolucao } from "@/lib/types/database.types";
import { deletePatientPhoto, getPatientPhotoSignedUrl } from "@/lib/actions/patient-photos";
import {
  ordenarFotos,
  sugestaoComparacao,
  TIPO_FOTO_LABELS,
  tiposComFoto,
  tiposDosFiltros,
  type OrdemFotos,
} from "@/lib/patient-photos";
import { cn, formatDate } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

const AVISO_LGPD =
  "Dado sensível (LGPD) — cada foto exibida gera um link temporário (15 min) e fica registrada em auditoria quem visualizou e quando.";

/** Selo do ângulo: frente em verde; lados em azul; costas em laranja; perfil (antigo) neutro. */
const TOM_TIPO: Record<TipoFotoEvolucao, "success" | "info" | "warning" | "neutral"> = {
  frente: "success",
  direita: "info",
  esquerda: "info",
  costas: "warning",
  perfil: "neutral",
};

const rotuloFoto = (p: PatientPhoto) => `${TIPO_FOTO_LABELS[p.tipo]} — ${formatDate(p.data_registro)}`;

interface PatientPhotosPanelProps {
  patientId: string;
  photos: PatientPhoto[];
  consentimentoAtivoFotos: boolean;
}

/**
 * Aba "Evolução Fotográfica" (Fase 19, layout de referência de 05/10/2026).
 * Privacidade primeiro: nenhuma foto é carregada sozinha — as miniaturas
 * são neutras, e só "Visualizar" ou "Comparar" geram o link temporário
 * (15 min) e o registro de auditoria, como antes.
 */
export function PatientPhotosPanel({ patientId, photos, consentimentoAtivoFotos }: PatientPhotosPanelProps) {
  const [filtro, setFiltro] = useState<TipoFotoEvolucao | "todos">("todos");
  const [ordem, setOrdem] = useState<OrdemFotos>("recentes");

  const filtros = tiposDosFiltros(photos);
  const visiveis = ordenarFotos(filtro === "todos" ? photos : photos.filter((p) => p.tipo === filtro), ordem);

  const novaFoto = consentimentoAtivoFotos ? (
    <NewPatientPhotoDialog patientId={patientId} />
  ) : (
    <p className="max-w-xs text-xs text-muted-foreground sm:text-right">
      Registre o consentimento de fotos na aba Consentimentos para poder adicionar fotos deste paciente.
    </p>
  );

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Evolução fotográfica</h2>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {photos.length > 0 && <PhotoComparisonDialog photos={photos} />}
              {/* Sem fotos, o botão fica só no aviso de tela vazia (não aparece duas vezes). */}
              {(photos.length > 0 || !consentimentoAtivoFotos) && novaFoto}
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-success/15 bg-success-soft/40 px-3 py-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-success-soft text-primary">
              <Lock className="h-4 w-4" aria-hidden="true" />
            </span>
            <p className="min-w-0 flex-1 text-xs text-muted-foreground sm:text-sm">
              <span aria-hidden="true">Fotos protegidas • links temporários de 15 min • acessos auditados</span>
              <span className="sr-only">{AVISO_LGPD}</span>
            </p>
            <span
              className="shrink-0 cursor-help text-muted-foreground"
              title={AVISO_LGPD}
              aria-hidden="true"
            >
              <Info className="h-4 w-4" />
            </span>
          </div>

          {photos.length === 0 ? (
            <EmptyState
              icon={Camera}
              title="Nenhuma foto registrada ainda."
              description="As fotos ficam protegidas e só abrem quando você pede."
              action={consentimentoAtivoFotos ? <NewPatientPhotoDialog patientId={patientId} /> : undefined}
            />
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por ângulo">
                  {(["todos", ...filtros] as const).map((t) => {
                    const ativo = filtro === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={ativo}
                        onClick={() => setFiltro(t)}
                        className={cn(
                          "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          ativo
                            ? "border-primary bg-success-soft text-primary"
                            : "border-border bg-card text-foreground hover:bg-muted/60",
                        )}
                      >
                        {t === "todos" ? "Todos" : TIPO_FOTO_LABELS[t]}
                      </button>
                    );
                  })}
                </div>
                <Select value={ordem} onValueChange={(v) => setOrdem(v as OrdemFotos)}>
                  <SelectTrigger className="h-9 w-full gap-2 text-xs sm:w-44" aria-label="Ordenar fotos">
                    <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectItem value="recentes">Mais recentes</SelectItem>
                    <SelectItem value="antigas">Mais antigas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {visiveis.length === 0 ? (
                <p className="rounded-lg bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
                  Nenhuma foto {filtro !== "todos" && `"${TIPO_FOTO_LABELS[filtro]}"`} registrada.
                </p>
              ) : (
                <ul className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(16.5rem,1fr))]">
                  {visiveis.map((foto) => (
                    <li key={foto.id}>
                      <PhotoCard patientId={patientId} photo={foto} />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </CardContent>
      </Card>

    </div>
  );
}

/** Miniatura NEUTRA: nunca a foto do paciente (carregá-la geraria link e auditoria sem ninguém pedir para ver). */
function MiniaturaProtegida({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-muted via-muted/60 to-border text-muted-foreground/70",
        className,
      )}
    >
      <ImageIcon className="h-6 w-6" />
    </span>
  );
}

function PhotoCard({ patientId, photo }: { patientId: string; photo: PatientPhoto }) {
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
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm">
      <MiniaturaProtegida className="h-20 w-20" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-sm font-semibold tabular-nums text-foreground">{formatDate(photo.data_registro)}</p>
        <Badge variant={TOM_TIPO[photo.tipo]}>{TIPO_FOTO_LABELS[photo.tipo]}</Badge>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <PhotoViewButton photoId={photo.id} label={rotuloFoto(photo)} />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-destructive"
              disabled={isPending}
              aria-label={`Excluir foto: ${rotuloFoto(photo)}`}
              title="Excluir"
            >
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
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9 text-muted-foreground hover:text-primary"
        onClick={() => handleOpenChange(true)}
        aria-label={`Ver foto: ${label}`}
        title="Visualizar"
      >
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
        {!loading && !url && <p className="py-8 text-center text-sm text-destructive" role="alert">Não foi possível carregar a foto.</p>}
      </DialogContent>
    </Dialog>
  );
}

/**
 * "Comparar fotos" (ajuste de 05/10/2026): tudo numa janela. Abrir a janela
 * é o pedido para ver — o ângulo vem com a penúltima (A) e a mais recente (B)
 * já escolhidas e as duas fotos carregam na hora. Cada foto carregada gera o
 * link temporário (15 min) e o registro de auditoria no servidor, como no
 * "Visualizar"; trocar uma data busca só a foto nova; ↔ troca os lados sem
 * buscar de novo. Ao fechar, os links são esquecidos.
 */
function PhotoComparisonDialog({ photos }: { photos: PatientPhoto[] }) {
  const angulos = tiposComFoto(photos);
  const inicial = angulos.find((t) => sugestaoComparacao(photos, t)) ?? angulos[0];

  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<TipoFotoEvolucao>(inicial);
  const [idA, setIdA] = useState("");
  const [idB, setIdB] = useState("");
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  const [carregando, setCarregando] = useState<Record<string, boolean>>({});
  const [falhou, setFalhou] = useState<Record<string, boolean>>({});
  const idAngulo = useId();
  const idDataA = useId();
  const idDataB = useId();

  const doTipo = ordenarFotos(
    photos.filter((p) => p.tipo === tipo),
    "recentes",
  );
  const fotoA = doTipo.find((p) => p.id === idA) ?? null;
  const fotoB = doTipo.find((p) => p.id === idB) ?? null;
  const poucasFotos = doTipo.length < 2;

  /** Busca só as fotos que ainda não têm link nesta abertura da janela. */
  async function carregar(ids: string[], jaTem: Record<string, string | null>) {
    const faltam = ids.filter((id) => id && !(id in jaTem));
    if (faltam.length === 0) return;
    setCarregando((c) => ({ ...c, ...Object.fromEntries(faltam.map((id) => [id, true])) }));
    const links = await Promise.all(faltam.map((id) => getPatientPhotoSignedUrl(id)));
    setUrls((u) => ({ ...u, ...Object.fromEntries(faltam.map((id, i) => [id, links[i]])) }));
    setCarregando((c) => ({ ...c, ...Object.fromEntries(faltam.map((id) => [id, false])) }));
  }

  function escolherAngulo(t: TipoFotoEvolucao, jaTem: Record<string, string | null>) {
    setTipo(t);
    const s = sugestaoComparacao(photos, t);
    setIdA(s?.a ?? "");
    setIdB(s?.b ?? "");
    if (s) void carregar([s.a, s.b], jaTem);
  }

  function handleOpenChange(v: boolean) {
    setOpen(v);
    // Fechou: esquece os links (nada fica guardado além do necessário).
    setUrls({});
    setCarregando({});
    setFalhou({});
    if (v) escolherAngulo(angulos.includes(tipo) ? tipo : inicial, {});
  }

  function escolherData(lado: "a" | "b", id: string) {
    if (lado === "a") setIdA(id);
    else setIdB(id);
    void carregar([id], urls);
  }

  const seletorData = (id: string, rotulo: string, valor: string, outro: string, lado: "a" | "b") => (
    <div className="min-w-0 space-y-1.5">
      <Label id={id} className="text-sm text-muted-foreground">
        {rotulo}
      </Label>
      <Select value={valor} onValueChange={(v) => escolherData(lado, v)} disabled={poucasFotos}>
        <SelectTrigger aria-labelledby={id}>
          <SelectValue placeholder="Selecione" />
        </SelectTrigger>
        <SelectContent>
          {doTipo.map((p) => (
            // A mesma foto não pode estar dos dois lados.
            <SelectItem key={p.id} value={p.id} disabled={p.id === outro}>
              {formatDate(p.data_registro)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const painel = (lado: string, foto: PatientPhoto | null) => (
    <PainelFoto
      lado={lado}
      foto={foto}
      url={foto ? urls[foto.id] : undefined}
      carregando={foto ? Boolean(carregando[foto.id]) : false}
      falhou={foto ? Boolean(falhou[foto.id]) : false}
      onFalha={() => foto && setFalhou((f) => ({ ...f, [foto.id]: true }))}
      onTentarDeNovo={() => {
        if (!foto) return;
        const resto = Object.fromEntries(Object.entries(urls).filter(([id]) => id !== foto.id));
        setFalhou((f) => ({ ...f, [foto.id]: false }));
        setUrls(resto);
        void carregar([foto.id], resto);
      }}
    />
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button type="button" variant="outline" onClick={() => handleOpenChange(true)}>
        <Columns2 className="h-4 w-4" />
        Comparar fotos
      </Button>
      <DialogContent className="max-h-[94vh] w-[96vw] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Comparar evolução</DialogTitle>
          <DialogDescription>Selecione o ângulo e duas datas para comparar as fotos lado a lado.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_minmax(0,1fr)] md:items-end">
          <div className="min-w-0 space-y-1.5">
            <Label id={idAngulo} className="text-sm text-muted-foreground">
              Ângulo
            </Label>
            <Select value={tipo} onValueChange={(v) => escolherAngulo(v as TipoFotoEvolucao, urls)}>
              <SelectTrigger aria-labelledby={idAngulo}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {angulos.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TIPO_FOTO_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {seletorData(idDataA, "Data A", idA, idB, "a")}
          <div className="flex justify-center">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full"
              onClick={() => {
                setIdA(idB);
                setIdB(idA);
              }}
              disabled={!idA && !idB}
              aria-label="Trocar Data A e Data B"
              title="Trocar Data A e Data B"
            >
              <ArrowLeftRight className="h-4 w-4 max-md:rotate-90" />
            </Button>
          </div>
          {seletorData(idDataB, "Data B", idB, idA, "b")}
        </div>

        {poucasFotos ? (
          <p role="status" className="rounded-lg bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
            Adicione pelo menos duas fotos deste ângulo para comparar a evolução.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {painel("Data A", fotoA)}
            {painel("Data B", fotoB)}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Um lado da comparação: a data fica EM CIMA da foto, fora dela (o selo por
 * cima cobria parte do corpo). Se a imagem não carrega (link de 15 min vencido
 * com a janela aberta), avisa e oferece buscar de novo, sem quebrar a tela.
 */
function PainelFoto({
  lado,
  foto,
  url,
  carregando,
  falhou,
  onFalha,
  onTentarDeNovo,
}: {
  lado: string;
  foto: PatientPhoto | null;
  url: string | null | undefined;
  carregando: boolean;
  falhou: boolean;
  onFalha: () => void;
  onTentarDeNovo: () => void;
}) {
  const mostrando = Boolean(url) && !falhou && !carregando;
  const erro = !carregando && (url === null || falhou);

  return (
    <figure className="min-w-0 space-y-2">
      <figcaption className="flex items-baseline gap-2 text-sm">
        <span className="font-semibold text-foreground">{lado}</span>
        {foto && <span className="tabular-nums text-muted-foreground">{formatDate(foto.data_registro)}</span>}
      </figcaption>
      <div
        className={cn(
          "flex h-[min(62vh,40rem)] items-center justify-center overflow-hidden rounded-xl border",
          mostrando ? "bg-muted/30" : "border-dashed bg-gradient-to-br from-muted/70 via-card to-muted/50",
        )}
      >
        {mostrando ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL assinada temporária.
          <img src={url!} alt={foto ? rotuloFoto(foto) : lado} className="h-full w-full object-contain" onError={onFalha} />
        ) : carregando ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Carregando foto" />
        ) : (
          <div
            className={cn(
              "flex max-w-[16rem] flex-col items-center gap-2 px-4 text-center text-sm",
              erro ? "text-destructive" : "text-muted-foreground",
            )}
            role={erro ? "alert" : undefined}
          >
            <ImageIcon className="h-7 w-7" aria-hidden="true" />
            {!foto
              ? "Selecione uma data para visualizar a foto"
              : url === null
                ? "Não foi possível carregar a foto."
                : "O link desta foto expirou."}
            {erro && (
              <Button type="button" variant="outline" size="sm" onClick={onTentarDeNovo}>
                Carregar de novo
              </Button>
            )}
          </div>
        )}
      </div>
    </figure>
  );
}
