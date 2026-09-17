"use client";

import { useState, useTransition } from "react";
import { BookmarkCheck, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { MealTemplateWithCount } from "@/lib/actions/meal-templates";
import { createMealFromTemplate } from "@/lib/actions/meals";
import { deleteMealTemplate } from "@/lib/actions/meal-templates";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface NewMealFromTemplateDialogProps {
  planId: string;
  nextOrdem: number;
  templates: MealTemplateWithCount[];
}

export function NewMealFromTemplateDialog({ planId, nextOrdem, templates }: NewMealFromTemplateDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [isPending, startTransition] = useTransition();

  const selected = templates.find((t) => t.id === selectedId) ?? null;

  function handleSelect(template: MealTemplateWithCount) {
    setSelectedId(template.id);
    setNome(template.nome);
  }

  function handleDeleteTemplate(templateId: string, e: React.MouseEvent) {
    e.stopPropagation();
    startTransition(async () => {
      const result = await deleteMealTemplate(templateId);
      if (!result.success) {
        toast.error("Não foi possível excluir o template", { description: result.message });
        return;
      }
      if (selectedId === templateId) {
        setSelectedId(null);
        setNome("");
      }
      toast.success("Template excluído.");
    });
  }

  function handleSubmit() {
    if (!selected) return;
    if (!nome.trim()) {
      toast.error("Informe o nome da refeição.");
      return;
    }
    startTransition(async () => {
      const result = await createMealFromTemplate(planId, selected.id, { nome: nome.trim() }, nextOrdem);
      if (!result.success) {
        toast.error("Não foi possível criar a refeição", { description: result.message });
        return;
      }
      toast.success(result.message ?? "Refeição criada.");
      setOpen(false);
      setSelectedId(null);
      setNome("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={templates.length === 0}>
          <BookmarkCheck className="h-4 w-4" />
          Usar template
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova refeição a partir de um template</DialogTitle>
          <DialogDescription>
            Os valores nutricionais são recalculados a partir dos alimentos atuais no momento em que o
            template é usado.
          </DialogDescription>
        </DialogHeader>

        {templates.length === 0 ? (
          <EmptyState
            icon={BookmarkCheck}
            title="Nenhum template salvo"
            description='Salve uma refeição já montada como template (botão "Salvar como template" em qualquer refeição) para reutilizá-la aqui.'
          />
        ) : (
          <div className="space-y-1">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => handleSelect(template)}
                disabled={isPending}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                  selectedId === template.id
                    ? "border-primary-400 bg-primary-50"
                    : "border-border hover:bg-muted"
                )}
              >
                <span>
                  <span className="font-medium text-foreground">{template.nome}</span>{" "}
                  <span className="text-xs text-muted-foreground">
                    ({template.item_count} alimento{template.item_count === 1 ? "" : "s"})
                  </span>
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => handleDeleteTemplate(template.id, e)}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive"
                  aria-label={`Excluir template ${template.nome}`}
                >
                  <Trash2 className="h-4 w-4" />
                </span>
              </button>
            ))}
          </div>
        )}

        {selected && (
          <div className="space-y-2 border-t border-border pt-4">
            <Label htmlFor="nome_refeicao_template">Nome da refeição</Label>
            <Input id="nome_refeicao_template" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
        )}

        <DialogFooter>
          <Button type="button" onClick={handleSubmit} disabled={!selected || isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Criar refeição
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
