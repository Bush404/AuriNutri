"use client";

import { useEffect } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Redo2,
  Rows3,
  Columns3,
  Table as TableIcon,
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  /** HTML inicial. Trocar este valor (ex.: escolher outro modelo) substitui o texto do editor. */
  value: string;
  onChange: (html: string) => void;
  /** Nome acessível da área de texto (não há <label> visível ligado a ela). */
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Editor "tipo Word" da anamnese e dos modelos (Fase 14): títulos, negrito,
 * itálico, sublinhado, listas e tabela. Colar do Word funciona — o editor só
 * aceita os elementos acima, e o servidor limpa o HTML de novo antes de gravar
 * (src/lib/rich-text-sanitize.ts).
 */
export function RichTextEditor({ value, onChange, ariaLabel, disabled, className }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        link: { openOnClick: false, autolink: true },
      }),
      TableKit.configure({ table: { resizable: false } }),
    ],
    content: value,
    editable: !disabled,
    // Next.js renderiza no servidor primeiro: o editor só monta no navegador.
    immediatelyRender: false,
    // A barra de ferramentas mostra o estado atual (negrito ativo etc.).
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        class: "rich-text min-h-[320px] px-4 py-3 focus:outline-none",
        "aria-label": ariaLabel,
        "aria-multiline": "true",
        role: "textbox",
      },
    },
    onUpdate: ({ editor: current }) => onChange(current.getHTML()),
  });

  // Conteúdo trocado de fora (ex.: escolheu um modelo) — sem disparar onChange.
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring",
        disabled && "opacity-60",
        className
      )}
    >
      <Toolbar editor={editor} disabled={disabled} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor, disabled }: { editor: Editor | null; disabled?: boolean }) {
  const off = !editor || disabled;
  const inTable = editor?.isActive("table") ?? false;

  return (
    <div
      role="toolbar"
      aria-label="Formatação do texto"
      className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 px-1.5 py-1"
    >
      <ToolButton
        icon={Heading2}
        label="Título"
        active={editor?.isActive("heading", { level: 2 })}
        disabled={off}
        onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolButton
        icon={Heading3}
        label="Subtítulo"
        active={editor?.isActive("heading", { level: 3 })}
        disabled={off}
        onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
      />
      <Separator />
      <ToolButton
        icon={Bold}
        label="Negrito"
        active={editor?.isActive("bold")}
        disabled={off}
        onClick={() => editor?.chain().focus().toggleBold().run()}
      />
      <ToolButton
        icon={Italic}
        label="Itálico"
        active={editor?.isActive("italic")}
        disabled={off}
        onClick={() => editor?.chain().focus().toggleItalic().run()}
      />
      <ToolButton
        icon={UnderlineIcon}
        label="Sublinhado"
        active={editor?.isActive("underline")}
        disabled={off}
        onClick={() => editor?.chain().focus().toggleUnderline().run()}
      />
      <Separator />
      <ToolButton
        icon={List}
        label="Lista"
        active={editor?.isActive("bulletList")}
        disabled={off}
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
      />
      <ToolButton
        icon={ListOrdered}
        label="Lista numerada"
        active={editor?.isActive("orderedList")}
        disabled={off}
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
      />
      <Separator />
      <ToolButton
        icon={TableIcon}
        label="Inserir tabela"
        disabled={off || inTable}
        onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run()}
      />
      {inTable && (
        <>
          <ToolButton
            icon={Rows3}
            label="Adicionar linha"
            disabled={off}
            onClick={() => editor?.chain().focus().addRowAfter().run()}
          />
          <ToolButton
            icon={Columns3}
            label="Adicionar coluna"
            disabled={off}
            onClick={() => editor?.chain().focus().addColumnAfter().run()}
          />
          <ToolButton
            icon={Trash2}
            label="Excluir tabela"
            disabled={off}
            onClick={() => editor?.chain().focus().deleteTable().run()}
          />
        </>
      )}
      <Separator />
      <ToolButton
        icon={Undo2}
        label="Desfazer"
        disabled={off || !editor?.can().undo()}
        onClick={() => editor?.chain().focus().undo().run()}
      />
      <ToolButton
        icon={Redo2}
        label="Refazer"
        disabled={off || !editor?.can().redo()}
        onClick={() => editor?.chain().focus().redo().run()}
      />
    </div>
  );
}

function ToolButton({
  icon: Icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active ?? undefined}
      title={label}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40",
        active && "bg-primary-100 text-primary-800"
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function Separator() {
  return <span className="mx-1 h-5 w-px bg-border" aria-hidden />;
}
