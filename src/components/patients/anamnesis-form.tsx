"use client";

import { useId, useState, useTransition } from "react";
import { BookmarkPlus, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { createAnamnesis, updateAnamnesis } from "@/lib/actions/clinical";
import { createAnamnesisTemplate } from "@/lib/actions/anamnesis-templates";
import { anamnesisHtml } from "@/lib/anamnesis";
import { isRichTextEmpty } from "@/lib/rich-text";
import type { Anamnesis, AnamnesisTemplate } from "@/lib/types/database.types";
import { useUnsavedChangesWarning } from "@/lib/hooks/use-unsaved-changes-warning";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RichTextEditor } from "@/components/shared/rich-text-editor";

const EM_BRANCO = "__em_branco__";

interface AnamnesisFormProps {
  patientId: string;
  /** Presente = editar este registro específico. Ausente = criar um novo. */
  anamnesis?: Anamnesis | null;
  /** "Meus modelos de anamnese" — só usados ao criar. */
  templates: AnamnesisTemplate[];
  onSaved?: () => void;
  onCancel?: () => void;
}

/**
 * Anamnese em texto livre (Fase 14): nome opcional + página em branco estilo
 * Word. Ao criar, dá para começar de um dos modelos do profissional; o texto
 * do modelo é copiado, e mudar o modelo depois não altera esta anamnese.
 */
export function AnamnesisForm({ patientId, anamnesis, templates, onSaved, onCancel }: AnamnesisFormProps) {
  const isEditing = Boolean(anamnesis);
  const isLegacy = Boolean(anamnesis && anamnesis.conteudo === null);
  const modeloLabelId = useId();
  const [initial] = useState(() => ({ titulo: anamnesis?.titulo ?? "", conteudo: anamnesis ? anamnesisHtml(anamnesis) : "" }));
  const [titulo, setTitulo] = useState(initial.titulo);
  const [conteudo, setConteudo] = useState(initial.conteudo);
  const [modelo, setModelo] = useState(EM_BRANCO);
  const [error, setError] = useState<string | null>(null);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isDirty = titulo !== initial.titulo || conteudo !== initial.conteudo;
  useUnsavedChangesWarning(isDirty && !isPending);

  function escolherModelo(value: string) {
    setModelo(value);
    const template = templates.find((t) => t.id === value);
    setConteudo(template ? template.conteudo : "");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isRichTextEmpty(conteudo)) {
      setError("Escreva a anamnese antes de salvar.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const values = { titulo, conteudo };
      const result = isEditing
        ? await updateAnamnesis(anamnesis!.id, patientId, values)
        : await createAnamnesis(patientId, values);

      if (!result.success) {
        toast.error("Não foi possível salvar a anamnese", { description: result.message });
        return;
      }
      toast.success(result.message ?? "Anamnese salva.");
      onSaved?.();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Anamnese" : "Nova anamnese"}</CardTitle>
        <CardDescription>
          {isEditing
            ? "Corrige o conteúdo deste registro. A data do registro não muda."
            : "Cria um novo registro no histórico do paciente — não sobrescreve os anteriores."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="anamnese_titulo">Nome (opcional)</Label>
              <Input
                id="anamnese_titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex.: Anamnese inicial, Retorno de 3 meses"
                disabled={isPending}
              />
            </div>

            {!isEditing && (
              <div className="space-y-2">
                <Label id={modeloLabelId}>Começar de</Label>
                <Select value={modelo} onValueChange={escolherModelo} disabled={isPending}>
                  <SelectTrigger aria-labelledby={modeloLabelId}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={EM_BRANCO}>Página em branco</SelectItem>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        Modelo: {template.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {templates.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Você ainda não tem modelos. Escreva uma anamnese e use “Salvar como modelo”.
                  </p>
                )}
              </div>
            )}
          </div>

          {isLegacy && (
            <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              Registro no formato antigo, com um campo por tema. O texto abaixo foi montado a partir desses campos e
              passa a ser guardado neste formato quando você salvar. Os campos originais continuam guardados.
            </p>
          )}

          <div className="space-y-2">
            <RichTextEditor
              value={conteudo}
              onChange={(html) => {
                setConteudo(html);
                if (error) setError(null);
              }}
              ariaLabel="Texto da anamnese"
              disabled={isPending}
            />
            {error && (
              <p className="text-xs text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSaveTemplateOpen(true)}
              disabled={isPending || isRichTextEmpty(conteudo)}
            >
              <BookmarkPlus className="h-4 w-4" />
              Salvar como modelo
            </Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              {onCancel && (
                <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
                  Cancelar
                </Button>
              )}
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isEditing ? "Salvar alterações" : "Registrar anamnese"}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>

      {/* key: remonta a cada abertura, para o nome sugerido vir do título atual. */}
      <SaveAsTemplateDialog
        key={saveTemplateOpen ? "aberto" : "fechado"}
        open={saveTemplateOpen}
        onOpenChange={setSaveTemplateOpen}
        conteudo={conteudo}
        defaultNome={titulo}
      />
    </Card>
  );
}

function SaveAsTemplateDialog({
  open,
  onOpenChange,
  conteudo,
  defaultNome,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conteudo: string;
  defaultNome: string;
}) {
  const [nome, setNome] = useState(defaultNome);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    if (!nome.trim()) {
      setError("Dê um nome ao modelo");
      return;
    }
    startTransition(async () => {
      const result = await createAnamnesisTemplate({ nome, conteudo });
      if (!result.success) {
        setError(result.message ?? "Não foi possível salvar o modelo.");
        return;
      }
      toast.success("Modelo salvo. Ele aparece em “Começar de” nas próximas anamneses.");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Salvar como modelo</DialogTitle>
          <DialogDescription>
            O texto atual vira um modelo seu. Revise antes: se houver dados deste paciente no texto, apague-os — o modelo
            é usado para outros pacientes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="modelo_nome">Nome do modelo</Label>
          <Input
            id="modelo_nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Anamnese adulto"
            disabled={isPending}
            aria-required
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSave();
              }
            }}
          />
          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar modelo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
