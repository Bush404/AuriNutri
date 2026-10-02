"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, Loader2, Search, Star } from "lucide-react";
import { toast } from "sonner";

import { mealPlanSchema, type MealPlanInput } from "@/lib/validations/meal-plan";
import {
  createMealPlan,
  criarPlanoDeModelo,
  listarModelosDePlano,
  previaDoModelo,
  type ModeloDePlano,
  type PreviaDoModelo,
} from "@/lib/actions/meal-plans";
import { cn } from "@/lib/utils";

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

const fmt = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

/**
 * Novo plano (Fase 17, Bloco G): em branco (já com Café da manhã, Almoço e
 * Jantar) ou a partir de um modelo — um plano favoritado de qualquer paciente —,
 * com busca e prévia, como no WebDiet.
 */
export function NewMealPlanDialog({ patientId, trigger }: { patientId: string; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [origem, setOrigem] = useState<"branco" | "modelo">("branco");
  const [modelos, setModelos] = useState<ModeloDePlano[] | null>(null);
  const [modeloId, setModeloId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [previa, setPrevia] = useState<{ id: string; dados: PreviaDoModelo } | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<MealPlanInput>({
    resolver: zodResolver(mealPlanSchema),
    defaultValues: {
      nome: "Plano Alimentar",
      data_inicio: new Date().toISOString().slice(0, 10),
    },
  });

  useEffect(() => {
    if (!open || origem !== "modelo" || modelos !== null) return;
    let ativo = true;
    void listarModelosDePlano().then((m) => ativo && setModelos(m));
    return () => {
      ativo = false;
    };
  }, [open, origem, modelos]);

  function escolherModelo(m: ModeloDePlano) {
    setModeloId(m.id);
    setValue("nome", m.nome);
  }

  function verPrevia(id: string) {
    if (previa?.id === id) {
      setPrevia(null);
      return;
    }
    startTransition(async () => setPrevia({ id, dados: await previaDoModelo(id) }));
  }

  function onSubmit(values: MealPlanInput) {
    if (origem === "modelo" && !modeloId) {
      toast.error("Escolha um modelo.");
      return;
    }
    startTransition(async () => {
      const result =
        origem === "modelo" && modeloId
          ? await criarPlanoDeModelo(patientId, modeloId, values)
          : await createMealPlan(patientId, values);
      // Em caso de sucesso, a Server Action já faz o redirect() para /planos/[id],
      // então só chegamos aqui se houver erro de validação/permissão.
      if (result && !result.success) {
        toast.error("Não foi possível criar o plano", { description: result.message });
      }
    });
  }

  const termo = busca.trim().toLowerCase();
  const filtrados = (modelos ?? []).filter(
    (m) => !termo || m.nome.toLowerCase().includes(termo) || m.paciente.toLowerCase().includes(termo),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo plano alimentar</DialogTitle>
          <DialogDescription>Comece em branco ou a partir de um dos seus planos favoritos.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-1.5" role="radiogroup" aria-label="Começar">
          {(
            [
              ["branco", "Em branco"],
              ["modelo", "De um modelo"],
            ] as const
          ).map(([valor, rotulo]) => (
            <Button
              key={valor}
              type="button"
              size="sm"
              role="radio"
              aria-checked={origem === valor}
              variant={origem === valor ? "default" : "outline"}
              onClick={() => setOrigem(valor)}
            >
              {rotulo}
            </Button>
          ))}
        </div>

        {origem === "branco" ? (
          <p className="text-sm text-muted-foreground">
            O plano já vem com Café da manhã, Almoço e Jantar; você adiciona os alimentos na tela seguinte.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                placeholder="Buscar modelo pelo nome ou paciente"
                aria-label="Buscar modelo"
                className="pl-9"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            {modelos === null ? (
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" aria-label="Carregando modelos" />
            ) : modelos.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                Você ainda não tem modelos. Na lista de planos de qualquer paciente, toque na estrela{" "}
                <Star className="inline h-3.5 w-3.5" aria-hidden="true" /> de um plano para usá-lo como modelo.
              </p>
            ) : (
              <ul className="max-h-72 space-y-1 overflow-y-auto" role="radiogroup" aria-label="Modelos">
                {filtrados.map((m) => (
                  <li key={m.id} className="rounded-md border border-border">
                    <div className={cn("flex items-center gap-2 px-3 py-2", modeloId === m.id && "bg-primary-50")}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={modeloId === m.id}
                        className="min-w-0 flex-1 text-left"
                        onClick={() => escolherModelo(m)}
                      >
                        <span className="block truncate text-sm font-medium text-foreground">{m.nome}</span>
                        <span className="block text-xs text-muted-foreground">
                          {fmt(m.kcal)} kcal · {m.refeicoes} refeição(ões){m.paciente ? ` · de ${m.paciente}` : ""}
                        </span>
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        aria-expanded={previa?.id === m.id}
                        onClick={() => verPrevia(m.id)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Prévia
                      </Button>
                    </div>
                    {previa?.id === m.id && (
                      <div className="space-y-2 border-t border-border px-3 py-2 text-xs">
                        {previa.dados.refeicoes.length === 0 && <p className="text-muted-foreground">Sem refeições.</p>}
                        {previa.dados.refeicoes.map((r, i) => (
                          <div key={i}>
                            <p className="font-medium text-foreground">
                              {r.horario ? `${r.horario.slice(0, 5)} · ` : ""}
                              {r.nome}
                            </p>
                            <ul className="text-muted-foreground">
                              {r.itens.map((it, j) => (
                                <li key={j}>
                                  {it.nome} — {it.quantidade}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
                {filtrados.length === 0 && <li className="text-sm text-muted-foreground">Nenhum modelo encontrado.</li>}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">
              Vêm as refeições, os alimentos e os substitutos do modelo. O planejamento teórico não vem — ele é do outro
              paciente.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome do plano</Label>
            <Input id="nome" placeholder="Ex: Plano de emagrecimento" aria-required="true" {...register("nome")} />
            {errors.nome && (
              <p className="text-xs text-destructive" role="alert">
                {errors.nome.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="data_inicio">Data de início</Label>
            <Input id="data_inicio" type="date" aria-required="true" {...register("data_inicio")} />
            {errors.data_inicio && (
              <p className="text-xs text-destructive" role="alert">
                {errors.data_inicio.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações (opcional)</Label>
            <Textarea id="observacoes" rows={3} {...register("observacoes")} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending || (origem === "modelo" && !modeloId)}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Criar e montar refeições
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
