"use client";

import { useState, useTransition, type KeyboardEvent, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Apple,
  ChevronRight,
  Coffee,
  Copy,
  Dumbbell,
  Loader2,
  Moon,
  Soup,
  Star,
  Trash2,
  Utensils,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";

import type { Meal } from "@/lib/types/database.types";
import { calculateMealTotals } from "@/lib/nutrition";
import { COR_MACRO } from "@/lib/macro-colors";
import { deleteMeal, duplicateMeal, updateMeal } from "@/lib/actions/meals";
import { saveMealAsTemplate } from "@/lib/actions/meal-templates";
import { mealTemplateNameSchema, type MealTemplateNameInput } from "@/lib/validations/meal-plan";
import { useAutoSave } from "@/lib/hooks/use-auto-save";
import { cn } from "@/lib/utils";
import type { MealItem, MealItemSubstitution } from "@/lib/types/database.types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MealEditorDialog } from "@/components/meal-plans/meal-editor-dialog";

export type MealItemWithSubstitutions = MealItem & { meal_item_substitutions: MealItemSubstitution[] };

export interface MealWithItemsAndSubstitutions extends Meal {
  items: MealItemWithSubstitutions[];
}

const fmt = (v: number, casas = 1) =>
  v.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });

/**
 * Refeição como uma linha compacta, igual ao WebDiet (Fase 17): horário,
 * nome (os dois editáveis na própria linha, salvando sozinhos), proteínas,
 * lipídios, carboidratos e kcal, e os botões abrir, duplicar, favoritar (salvar como refeição favorita) e excluir. Fechada ao
 * abrir o plano; "abrir" mostra os alimentos logo abaixo.
 */
export function MealCard({
  planId,
  meal,
  alca,
}: {
  planId: string;
  meal: MealWithItemsAndSubstitutions;
  /** Alça de arrastar, desenhada no começo da linha. */
  alca?: ReactNode;
}) {
  const [isPending, startTransition] = useTransition();
  const [templateOpen, setTemplateOpen] = useState(false);
  const totals = calculateMealTotals(meal.items);
  const [editando, setEditando] = useState(false);

  // Nome e horário se editam na própria linha (Fase 19) e salvam sozinhos.
  // O horário só vai para o salvamento quando está completo (ou ao sair do
  // campo), para não gravar "sem horário" no meio da digitação.
  const [nome, setNome] = useState(meal.nome);
  const [horario, setHorario] = useState(meal.horario ? meal.horario.slice(0, 5) : "");
  const [horarioParaSalvar, setHorarioParaSalvar] = useState(horario);
  // Nome apagado (no meio da digitação) não vai para o salvamento: fica o último gravado.
  const { estado: estadoSalvamento, erro: erroSalvamento } = useAutoSave(
    { nome: nome.trim() || meal.nome, horario: horarioParaSalvar },
    (v) => updateMeal(planId, meal.id, v),
    800,
  );

  const templateForm = useForm<MealTemplateNameInput>({
    resolver: zodResolver(mealTemplateNameSchema),
    defaultValues: { nome: meal.nome },
  });

  function handleDeleteMeal() {
    startTransition(async () => {
      const result = await deleteMeal(planId, meal.id);
      if (!result.success) {
        toast.error("Não foi possível excluir a refeição", {
          description: result.message,
        });
      }
    });
  }

  function handleDuplicate() {
    startTransition(async () => {
      const result = await duplicateMeal(planId, meal.id);
      if (!result.success) {
        toast.error("Não foi possível duplicar a refeição", {
          description: result.message,
        });
        return;
      }
      toast.success("Refeição duplicada.");
    });
  }

  /** Enter confirma (sai do campo); Esc desfaz o que foi digitado. */
  function teclasDoCampo(e: KeyboardEvent<HTMLInputElement>, desfazer: () => void) {
    if (e.key === "Enter") e.currentTarget.blur();
    if (e.key === "Escape") {
      desfazer();
      e.currentTarget.blur();
    }
  }

  function onTemplateSubmit(values: MealTemplateNameInput) {
    startTransition(async () => {
      const result = await saveMealAsTemplate(meal.id, values);
      if (!result.success) {
        toast.error("Não foi possível favoritar a refeição", {
          description: result.message,
        });
        return;
      }
      toast.success(result.message ?? "Refeição favoritada.");
      setTemplateOpen(false);
    });
  }

  return (
    <div
      className={cn(
        "rounded-xl border bg-card transition-colors",
        "border-border hover:border-primary/30",
      )}
    >
      {/* A linha toda abre a janela da refeição com o mouse; pelo teclado, o botão da seta. */}
      <div
        className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-3 px-3 py-3 sm:px-4"
        onClick={() => setEditando(true)}
      >
        <div className="flex min-w-0 flex-1 basis-64 items-center gap-3">
          {alca && <div onClick={(e) => e.stopPropagation()}>{alca}</div>}
          <input
            type="time"
            value={horario}
            aria-label={`Horário de ${nome || meal.nome}`}
            title="Clique para mudar o horário"
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              setHorario(e.target.value);
              if (e.target.value) setHorarioParaSalvar(e.target.value);
            }}
            onBlur={() => setHorarioParaSalvar(horario)}
            onKeyDown={(e) =>
              teclasDoCampo(e, () => {
                setHorario(horarioParaSalvar);
              })
            }
            className={cn(
              "h-9 w-[4.75rem] shrink-0 cursor-text rounded-lg border border-transparent bg-success-soft px-2 text-center text-sm font-semibold tabular-nums text-primary transition-colors hover:border-primary/30 focus:border-primary focus:bg-card focus:outline-none focus:ring-2 focus:ring-ring/30 [&::-webkit-calendar-picker-indicator]:hidden",
              !horario && "text-muted-foreground",
            )}
          />
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
            <IconeRefeicao nome={nome} />
          </span>
          <div className="min-w-0 flex-1">
            <input
              type="text"
              value={nome}
              aria-label="Nome da refeição"
              title="Clique para mudar o nome"
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setNome(e.target.value)}
              onBlur={() => {
                // Nome em branco não salva: volta para o último nome gravado.
                if (!nome.trim()) setNome(meal.nome);
              }}
              onKeyDown={(e) => teclasDoCampo(e, () => setNome(meal.nome))}
              className="-ml-1.5 w-full max-w-xs cursor-text truncate rounded-md border border-transparent bg-transparent px-1.5 py-0.5 font-semibold text-foreground transition-colors hover:border-border focus:border-primary focus:bg-card focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              {meal.items.length === 0
                ? "Nenhum alimento"
                : `${meal.items.length} ${meal.items.length === 1 ? "alimento" : "alimentos"}`}
              {(estadoSalvamento === "pendente" || estadoSalvamento === "salvando") && (
                <span className="inline-flex items-center gap-1 text-xs">
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                  Salvando…
                </span>
              )}
              {estadoSalvamento === "erro" && (
                <span className="text-xs text-destructive" role="alert">
                  Não salvo: {erroSalvamento}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <MacroChip cor={COR_MACRO.proteinas} rotulo="Proteínas" valor={totals.proteinas} />
          <MacroChip cor={COR_MACRO.lipidios} rotulo="Gorduras" valor={totals.gorduras} />
          <MacroChip cor={COR_MACRO.carboidratos} rotulo="Carboidratos" valor={totals.carboidratos} />
        </div>

        <div className="ml-auto flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <span className="mr-1 rounded-full bg-success-soft px-3 py-1.5 text-sm font-semibold tabular-nums text-primary">
            {fmt(Math.round(totals.calorias), 0)} kcal
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full"
            aria-haspopup="dialog"
            aria-label={`Abrir ${nome || meal.nome}`}
            title="Abrir e editar os alimentos"
            onClick={() => setEditando(true)}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
          <span aria-hidden className="mx-1 hidden h-6 w-px bg-border sm:block" />

          <IconeBotao rotulo="Duplicar refeição" onClick={handleDuplicate} disabled={isPending}>
            <Copy className="h-4 w-4" />
          </IconeBotao>

          <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
            <DialogTrigger asChild>
              <IconeBotao rotulo="Favoritar refeição" disabled={meal.items.length === 0}>
                <Star className="h-4 w-4" />
              </IconeBotao>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Favoritar refeição</DialogTitle>
              </DialogHeader>
              <form onSubmit={templateForm.handleSubmit(onTemplateSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`template_nome_${meal.id}`}>Nome da refeição favorita</Label>
                  <Input id={`template_nome_${meal.id}`} aria-required="true" {...templateForm.register("nome")} />
                  {templateForm.formState.errors.nome && (
                    <p className="text-xs text-destructive" role="alert">
                      {templateForm.formState.errors.nome.message}
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Salva os {meal.items.length} alimento(s) e quantidades desta refeição para usar em outros planos, em
                  &quot;Refeições favoritas&quot;.
                </p>
                <DialogFooter>
                  <Button type="submit" disabled={isPending}>
                    {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Favoritar
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <IconeBotao rotulo="Excluir refeição" perigo>
                <Trash2 className="h-4 w-4" />
              </IconeBotao>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir refeição</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir <strong>{meal.nome}</strong> e todos os alimentos adicionados a ela?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteMeal} disabled={isPending}>
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <MealEditorDialog
        open={editando}
        onOpenChange={setEditando}
        planId={planId}
        meal={meal}
        nome={nome.trim() || meal.nome}
        horario={horario}
        onSalvo={(novoNome, novoHorario) => {
          // A janela já gravou: a linha só passa a mostrar o mesmo.
          setNome(novoNome);
          setHorario(novoHorario);
          setHorarioParaSalvar(novoHorario);
        }}
      />
    </div>
  );
}

/** Macro da refeição: fundo bem claro na cor do macro, bolinha, valor e nome embaixo. */
function MacroChip({ cor, rotulo, valor }: { cor: string; rotulo: string; valor: number }) {
  return (
    <span
      className="flex min-w-[7.5rem] items-center gap-2.5 rounded-lg px-3 py-1.5"
      style={{ backgroundColor: `${cor}12` }}
    >
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: cor }} aria-hidden="true" />
      <span className="leading-tight">
        <span className="block text-sm font-semibold tabular-nums text-foreground">{fmt(valor)} g</span>
        <span className="block text-xs text-muted-foreground">{rotulo}</span>
      </span>
    </span>
  );
}

/** Ícone pelo nome da refeição, só para ajudar a bater o olho; nomes livres caem no talher. */
function IconeRefeicao({ nome }: { nome: string }) {
  const n = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const Icone = /cafe|desjejum/.test(n)
    ? Coffee
    : /almoco/.test(n)
      ? UtensilsCrossed
      : /lanche|colacao/.test(n)
        ? Apple
        : /jantar/.test(n)
          ? Soup
          : /ceia/.test(n)
            ? Moon
            : /treino/.test(n)
              ? Dumbbell
              : Utensils;
  return <Icone className="h-5 w-5" aria-hidden="true" />;
}

function IconeBotao({
  rotulo,
  perigo = false,
  className,
  ...props
}: { rotulo: string; perigo?: boolean } & React.ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={rotulo}
      title={rotulo}
      className={cn("h-9 w-9 text-muted-foreground hover:text-foreground", perigo && "hover:bg-destructive/10 hover:text-destructive", className)}
      {...props}
    />
  );
}
