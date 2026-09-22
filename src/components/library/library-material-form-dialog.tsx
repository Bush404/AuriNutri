"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Paperclip, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  libraryMaterialMetaSchema,
  libraryMaterialTextoSchema,
  LIBRARY_MATERIAL_TIPOS,
  LIBRARY_MATERIAL_TIPO_LABELS,
  LIBRARY_MATERIAL_FILE_ACCEPTED_EXTENSIONS,
  LIBRARY_MATERIAL_FILE_MAX_BYTES,
} from "@/lib/validations/library-material";
import {
  createLibraryMaterialTexto,
  createLibraryMaterialComArquivo,
  updateLibraryMaterialTexto,
  updateLibraryMaterialMeta,
} from "@/lib/actions/library-materials";
import type { LibraryMaterial, LibraryMaterialTipo } from "@/lib/types/database.types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

type Kind = "texto" | "arquivo";

interface FormState {
  titulo: string;
  descricao: string;
  tipo: LibraryMaterialTipo;
  tagsTexto: string;
  secao_titulo: string;
  secao_subtitulo: string;
  conteudo: string;
}

const EMPTY_FORM: FormState = {
  titulo: "",
  descricao: "",
  tipo: "orientacao",
  tagsTexto: "",
  secao_titulo: "",
  secao_subtitulo: "",
  conteudo: "",
};

function buildFormFromMaterial(material: LibraryMaterial): FormState {
  return {
    titulo: material.titulo,
    descricao: material.descricao ?? "",
    tipo: material.tipo,
    tagsTexto: material.tags.join(", "),
    secao_titulo: material.secao_titulo ?? "",
    secao_subtitulo: material.secao_subtitulo ?? "",
    conteudo: material.conteudo ?? "",
  };
}

interface LibraryMaterialFormDialogProps {
  /** Presente = editar este material. Ausente = criar um novo. */
  material?: LibraryMaterial;
  /** Gatilho customizado (ex.: item de dropdown numa linha da tabela). Padrão: botão "Novo material". */
  trigger?: React.ReactNode;
}

export function LibraryMaterialFormDialog({ material, trigger }: LibraryMaterialFormDialogProps) {
  const isEditing = Boolean(material);
  // Em edição, o "tipo de criação" já está fixado pelo material existente.
  const editingKind: Kind | null = material ? (material.conteudo !== null ? "texto" : "arquivo") : null;

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [kind, setKind] = useState<Kind>(editingKind ?? "arquivo");
  const [form, setForm] = useState<FormState>(material ? buildFormFromMaterial(material) : EMPTY_FORM);
  const [arquivoNome, setArquivoNome] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const comoCriarLabelId = useId();
  const tipoLabelId = useId();
  const arquivoLabelId = useId();
  const arquivoButtonTextId = useId();

  useEffect(() => {
    if (!open) return;
    setForm(material ? buildFormFromMaterial(material) : EMPTY_FORM);
    setKind(editingKind ?? "arquivo");
    setArquivoNome(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (isEditing && material) {
      setLoading(true);
      const result =
        editingKind === "texto"
          ? await updateLibraryMaterialTexto(material.id, form)
          : await updateLibraryMaterialMeta(material.id, form);
      setLoading(false);

      if (!result.success) {
        toast.error("Não foi possível salvar", { description: result.message });
        return;
      }
      toast.success(result.message ?? "Material atualizado.");
      setOpen(false);
      return;
    }

    if (kind === "texto") {
      const parsed = libraryMaterialTextoSchema.safeParse(form);
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Verifique os dados informados.");
        return;
      }

      setLoading(true);
      const result = await createLibraryMaterialTexto(form);
      setLoading(false);

      if (!result.success) {
        toast.error("Não foi possível criar o material", { description: result.message });
        return;
      }
      toast.success(result.message ?? "Material criado.");
      setOpen(false);
      return;
    }

    const parsedMeta = libraryMaterialMetaSchema.safeParse(form);
    if (!parsedMeta.success) {
      toast.error(parsedMeta.error.issues[0]?.message ?? "Verifique os dados informados.");
      return;
    }
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Selecione o arquivo do material.");
      return;
    }
    if (file.size > LIBRARY_MATERIAL_FILE_MAX_BYTES) {
      toast.error("Arquivo muito grande. O limite é 10MB.");
      return;
    }

    const formData = new FormData();
    formData.set("titulo", form.titulo);
    formData.set("descricao", form.descricao);
    formData.set("tipo", form.tipo);
    formData.set("tagsTexto", form.tagsTexto);
    formData.set("file", file);

    setLoading(true);
    const result = await createLibraryMaterialComArquivo(formData);
    setLoading(false);

    if (!result.success) {
      toast.error("Não foi possível criar o material", { description: result.message });
      return;
    }
    toast.success(result.message ?? "Material criado.");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="h-4 w-4" />
            Novo material
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar material" : "Novo material da biblioteca"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Materiais reutilizáveis de orientação e educação — não é o lugar de receitas ou alimentos."
              : "Escreva o material direto no sistema ou envie um arquivo (PDF/imagem) — reutilizável para enviar a vários pacientes."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isEditing && (
            <div className="space-y-2">
              <Label id={comoCriarLabelId}>Como criar *</Label>
              <Tabs value={kind} onValueChange={(v) => setKind(v as Kind)}>
                <TabsList className="grid w-full grid-cols-2" aria-labelledby={comoCriarLabelId}>
                  <TabsTrigger value="arquivo">Enviar arquivo</TabsTrigger>
                  <TabsTrigger value="texto">Escrever</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="titulo">Nome *</Label>
            <Input
              id="titulo"
              placeholder="Ex: Orientação para dia de prova de atletismo"
              value={form.titulo}
              onChange={(e) => setField("titulo", e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label id={tipoLabelId}>Tipo *</Label>
              <Select value={form.tipo} onValueChange={(v) => setField("tipo", v as LibraryMaterialTipo)}>
                <SelectTrigger aria-labelledby={tipoLabelId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIBRARY_MATERIAL_TIPOS.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>
                      {LIBRARY_MATERIAL_TIPO_LABELS[tipo]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tagsTexto">Tags *</Label>
              <Input
                id="tagsTexto"
                placeholder="pré-treino, gestante"
                value={form.tagsTexto}
                onChange={(e) => setField("tagsTexto", e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição (opcional)</Label>
            <Textarea
              id="descricao"
              rows={2}
              value={form.descricao}
              onChange={(e) => setField("descricao", e.target.value)}
              disabled={loading}
            />
          </div>

          {(isEditing ? editingKind : kind) === "texto" && (
            <div className="space-y-4 rounded-md border border-border p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="secao_titulo">Título (opcional)</Label>
                  <Input
                    id="secao_titulo"
                    placeholder="Ex: Antes do treino"
                    value={form.secao_titulo}
                    onChange={(e) => setField("secao_titulo", e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secao_subtitulo">Subtítulo (opcional)</Label>
                  <Input
                    id="secao_subtitulo"
                    placeholder="Ex: O que fazer na hora anterior"
                    value={form.secao_subtitulo}
                    onChange={(e) => setField("secao_subtitulo", e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="conteudo">Texto livre *</Label>
                <Textarea
                  id="conteudo"
                  rows={10}
                  placeholder="Escreva o material aqui. Use **texto** para deixar algo em negrito."
                  value={form.conteudo}
                  onChange={(e) => setField("conteudo", e.target.value)}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  Única formatação disponível: <code>**texto**</code> vira negrito. O PDF enviado ao paciente já sai
                  com o título/subtítulo acima e o negrito aplicados.
                </p>
              </div>
            </div>
          )}

          {!isEditing && kind === "arquivo" && (
            <div className="space-y-2">
              <Label id={arquivoLabelId}>Arquivo (PDF/imagem) *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => fileInputRef.current?.click()}
                aria-labelledby={`${arquivoLabelId} ${arquivoButtonTextId}`}
              >
                <Paperclip className="h-4 w-4" />
                <span id={arquivoButtonTextId}>{arquivoNome ?? "Selecionar arquivo"}</span>
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept={LIBRARY_MATERIAL_FILE_ACCEPTED_EXTENSIONS}
                className="hidden"
                onChange={(e) => setArquivoNome(e.target.files?.[0]?.name ?? null)}
              />
            </div>
          )}

          {isEditing && editingKind === "arquivo" && (
            <p className="text-xs text-muted-foreground">
              O arquivo enviado não pode ser trocado por aqui — exclua este material e crie um novo se precisar
              substituir o arquivo.
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? "Salvar alterações" : "Salvar material"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
