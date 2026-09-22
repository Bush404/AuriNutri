"use client";

import { useId, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  foodSchema,
  type FoodInput,
  type MicronutrienteKey,
  CATEGORIAS_ALIMENTOS,
  MICRONUTRIENTE_GRUPOS,
  MICRONUTRIENTE_KEYS,
  MICRONUTRIENTE_LABELS,
} from "@/lib/validations/food";
import { createFood, updateFood } from "@/lib/actions/foods";
import type { Food } from "@/lib/types/database.types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface FoodFormDialogProps {
  food?: Food;
  trigger: React.ReactNode;
}

function buildMicronutrientDefaults(food: Food | undefined): Record<MicronutrienteKey, number | undefined> {
  const defaults = {} as Record<MicronutrienteKey, number | undefined>;
  for (const key of MICRONUTRIENTE_KEYS) {
    defaults[key] = food?.[key] ?? undefined;
  }
  return defaults;
}

export function FoodFormDialog({ food, trigger }: FoodFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEditing = Boolean(food);
  const categoriaLabelId = useId();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FoodInput>({
    resolver: zodResolver(foodSchema),
    defaultValues: {
      nome: food?.nome ?? "",
      categoria: food?.categoria ?? "",
      marca: food?.marca ?? "",
      porcao_referencia_g: food?.porcao_referencia_g ?? 100,
      calorias_kcal: food?.calorias_kcal ?? 0,
      proteinas_g: food?.proteinas_g ?? 0,
      carboidratos_g: food?.carboidratos_g ?? 0,
      gorduras_g: food?.gorduras_g ?? 0,
      fibras_g: food?.fibras_g ?? undefined,
      ...buildMicronutrientDefaults(food),
    },
  });

  async function onSubmit(values: FoodInput) {
    setLoading(true);
    const result = isEditing ? await updateFood(food!.id, values) : await createFood(values);
    setLoading(false);

    if (!result.success) {
      toast.error("Não foi possível salvar", { description: result.message });
      return;
    }

    toast.success(result.message ?? "Alimento salvo.");
    if (!isEditing) reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar alimento" : "Novo alimento"}</DialogTitle>
          <DialogDescription>
            Informe os valores nutricionais para a porção de referência indicada.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome do alimento *</Label>
            <Input id="nome" placeholder="Ex: Arroz branco cozido" aria-required="true" {...register("nome")} />
            {errors.nome && <p className="text-xs text-destructive" role="alert">{errors.nome.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label id={categoriaLabelId}>Categoria *</Label>
              <Controller
                control={control}
                name="categoria"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-labelledby={categoriaLabelId} aria-required="true">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS_ALIMENTOS.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.categoria && <p className="text-xs text-destructive" role="alert">{errors.categoria.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="marca">Marca (opcional)</Label>
              <Input id="marca" placeholder="Ex: Tio João" {...register("marca")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="porcao_referencia_g">Porção de referência (g) *</Label>
            <Input
              id="porcao_referencia_g"
              type="number"
              step="0.1"
              placeholder="100"
              aria-required="true"
              {...register("porcao_referencia_g")}
            />
            <p className="text-xs text-muted-foreground">
              Os valores nutricionais abaixo devem corresponder a esta quantidade.
            </p>
            {errors.porcao_referencia_g && (
              <p className="text-xs text-destructive" role="alert">{errors.porcao_referencia_g.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="calorias_kcal">Calorias (kcal) *</Label>
              <Input id="calorias_kcal" type="number" step="0.1" aria-required="true" {...register("calorias_kcal")} />
              {errors.calorias_kcal && <p className="text-xs text-destructive" role="alert">{errors.calorias_kcal.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="proteinas_g">Proteínas (g) *</Label>
              <Input id="proteinas_g" type="number" step="0.1" aria-required="true" {...register("proteinas_g")} />
              {errors.proteinas_g && <p className="text-xs text-destructive" role="alert">{errors.proteinas_g.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="carboidratos_g">Carboidratos (g) *</Label>
              <Input id="carboidratos_g" type="number" step="0.1" aria-required="true" {...register("carboidratos_g")} />
              {errors.carboidratos_g && (
                <p className="text-xs text-destructive" role="alert">{errors.carboidratos_g.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="gorduras_g">Gorduras (g) *</Label>
              <Input id="gorduras_g" type="number" step="0.1" aria-required="true" {...register("gorduras_g")} />
              {errors.gorduras_g && <p className="text-xs text-destructive" role="alert">{errors.gorduras_g.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="fibras_g">Fibras (g)</Label>
              <Input id="fibras_g" type="number" step="0.1" {...register("fibras_g")} />
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs text-muted-foreground">
              Micronutrientes (opcional) — deixe em branco quando não souber o valor; branco é
              diferente de zero.
            </p>
            <Accordion type="multiple" className="rounded-md border border-border px-3">
              {Object.entries(MICRONUTRIENTE_GRUPOS).map(([grupo, chaves]) => (
                <AccordionItem key={grupo} value={grupo}>
                  <AccordionTrigger>{grupo}</AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-2 gap-4">
                      {chaves.map((chave) => {
                        const meta = MICRONUTRIENTE_LABELS[chave];
                        return (
                          <div key={chave} className="space-y-2">
                            <Label htmlFor={chave}>
                              {meta.label} ({meta.unit})
                            </Label>
                            <Input id={chave} type="number" step="0.001" {...register(chave as MicronutrienteKey)} />
                            {errors[chave as MicronutrienteKey] && (
                              <p className="text-xs text-destructive" role="alert">
                                {errors[chave as MicronutrienteKey]?.message}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? "Salvar alterações" : "Cadastrar alimento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
