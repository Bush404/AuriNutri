"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, FileText, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { AnamnesisTemplate } from "@/lib/types/database.types";
import {
  createAnamnesisTemplate,
  deleteAnamnesisTemplate,
  updateAnamnesisTemplate,
} from "@/lib/actions/anamnesis-templates";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { RichTextEditor } from "@/components/shared/rich-text-editor";

type View = { kind: "lista" } | { kind: "editar"; template: AnamnesisTemplate | null };

/**
 * "Meus modelos de anamnese" (Fase 14): lista, cria, edita e exclui. Editar um
 * modelo não muda anamneses que já foram criadas a partir dele (são cópias).
 */
export function AnamnesisTemplatesDialog({ templates }: { templates: AnamnesisTemplate[] }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>({ kind: "lista" });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setView({ kind: "lista" });
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <FileText className="h-4 w-4" />
          Meus modelos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        {view.kind === "lista" ? (
          <TemplateList templates={templates} onEdit={(template) => setView({ kind: "editar", template })} />
        ) : (
          <TemplateEditor
            key={view.template?.id ?? "novo"}
            template={view.template}
            onDone={() => setView({ kind: "lista" })}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TemplateList({
  templates,
  onEdit,
}: {
  templates: AnamnesisTemplate[];
  onEdit: (template: AnamnesisTemplate | null) => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Meus modelos de anamnese</DialogTitle>
        <DialogDescription>
          Ao criar uma anamnese, escolha um modelo em “Começar de”. O texto é copiado: mudar o modelo depois não altera
          anamneses já registradas.
        </DialogDescription>
      </DialogHeader>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => onEdit(null)}>
          <Plus className="h-4 w-4" />
          Novo modelo
        </Button>
      </div>

      {templates.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nenhum modelo ainda"
          description="Crie um aqui ou, ao escrever uma anamnese, use “Salvar como modelo”."
        />
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border" aria-label="Modelos de anamnese">
          {templates.map((template) => (
            <TemplateRow key={template.id} template={template} onEdit={() => onEdit(template)} />
          ))}
        </ul>
      )}
    </>
  );
}

function TemplateRow({ template, onEdit }: { template: AnamnesisTemplate; onEdit: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    startTransition(async () => {
      const result = await deleteAnamnesisTemplate(template.id);
      if (!result.success) {
        toast.error("Não foi possível excluir o modelo", { description: result.message });
        return;
      }
      toast.success("Modelo excluído.");
    });
  }

  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2">
      <span className="truncate text-sm font-medium text-foreground">{template.nome}</span>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="ghost" onClick={onEdit} disabled={isPending}>
          <Pencil className="h-4 w-4" />
          Editar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={handleDelete}
          disabled={isPending}
          aria-label={confirming ? `Confirmar exclusão de ${template.nome}` : `Excluir ${template.nome}`}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          {confirming ? "Confirmar exclusão" : "Excluir"}
        </Button>
      </div>
    </li>
  );
}

function TemplateEditor({ template, onDone }: { template: AnamnesisTemplate | null; onDone: () => void }) {
  const [nome, setNome] = useState(template?.nome ?? "");
  const [conteudo, setConteudo] = useState(template?.conteudo ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    if (!nome.trim()) {
      setError("Dê um nome ao modelo");
      return;
    }
    startTransition(async () => {
      const input = { nome, conteudo };
      const result = template ? await updateAnamnesisTemplate(template.id, input) : await createAnamnesisTemplate(input);
      if (!result.success) {
        setError(result.message ?? "Não foi possível salvar o modelo.");
        return;
      }
      toast.success(result.message ?? "Modelo salvo.");
      onDone();
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{template ? "Editar modelo" : "Novo modelo"}</DialogTitle>
        <DialogDescription>Escreva a estrutura que você usa nas consultas. Não coloque dados de pacientes aqui.</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="modelo_editor_nome">Nome do modelo *</Label>
          <Input
            id="modelo_editor_nome"
            value={nome}
            onChange={(e) => {
              setNome(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Ex.: Anamnese adulto"
            disabled={isPending}
            aria-required
          />
          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
        <RichTextEditor value={conteudo} onChange={setConteudo} ariaLabel="Texto do modelo" disabled={isPending} />
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="ghost" onClick={onDone} disabled={isPending}>
          <ArrowLeft className="h-4 w-4" />
          Voltar aos modelos
        </Button>
        <Button type="button" onClick={handleSave} disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {template ? "Salvar alterações" : "Criar modelo"}
        </Button>
      </div>
    </>
  );
}
