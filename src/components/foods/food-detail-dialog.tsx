"use client";

import { useState } from "react";

import type { Food } from "@/lib/types/database.types";
import { formatNutrientValue, FONTE_DESCRICAO_PADRAO } from "@/lib/nutrition";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface FoodDetailDialogProps {
  food: Food;
  trigger: React.ReactNode;
}

const MACROS: { key: keyof Food; label: string; unit: string }[] = [
  { key: "calorias_kcal", label: "Energia", unit: " kcal" },
  { key: "proteinas_g", label: "Proteínas", unit: "g" },
  { key: "carboidratos_g", label: "Carboidratos", unit: "g" },
  { key: "gorduras_g", label: "Gorduras totais", unit: "g" },
  { key: "fibras_g", label: "Fibra alimentar", unit: "g" },
];

const MICRONUTRIENTES: { key: keyof Food; label: string; unit: string }[] = [
  { key: "umidade_g", label: "Umidade", unit: "g" },
  { key: "cinzas_g", label: "Cinzas", unit: "g" },
  { key: "gordura_saturada_g", label: "Gordura saturada", unit: "g" },
  { key: "gordura_monoinsaturada_g", label: "Gordura monoinsaturada", unit: "g" },
  { key: "gordura_poliinsaturada_g", label: "Gordura poliinsaturada", unit: "g" },
  { key: "colesterol_mg", label: "Colesterol", unit: "mg" },
  { key: "calcio_mg", label: "Cálcio", unit: "mg" },
  { key: "magnesio_mg", label: "Magnésio", unit: "mg" },
  { key: "manganes_mg", label: "Manganês", unit: "mg" },
  { key: "fosforo_mg", label: "Fósforo", unit: "mg" },
  { key: "ferro_mg", label: "Ferro", unit: "mg" },
  { key: "sodio_mg", label: "Sódio", unit: "mg" },
  { key: "potassio_mg", label: "Potássio", unit: "mg" },
  { key: "cobre_mg", label: "Cobre", unit: "mg" },
  { key: "zinco_mg", label: "Zinco", unit: "mg" },
  { key: "retinol_mcg", label: "Retinol", unit: "mcg" },
  { key: "re_mcg", label: "Equivalente de retinol (RE)", unit: "mcg" },
  { key: "rae_mcg", label: "Atividade equiv. de retinol (RAE)", unit: "mcg" },
  { key: "tiamina_mg", label: "Tiamina (B1)", unit: "mg" },
  { key: "riboflavina_mg", label: "Riboflavina (B2)", unit: "mg" },
  { key: "piridoxina_mg", label: "Piridoxina (B6)", unit: "mg" },
  { key: "niacina_mg", label: "Niacina", unit: "mg" },
  { key: "vitamina_c_mg", label: "Vitamina C", unit: "mg" },
];

export function FoodDetailDialog({ food, trigger }: FoodDetailDialogProps) {
  const [open, setOpen] = useState(false);

  const micronutrientesDisponiveis = MICRONUTRIENTES.filter((n) => {
    const valor = food[n.key];
    const especial = food.valores_especiais?.[n.key as string];
    return valor !== null || especial !== undefined;
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>{food.nome}</DialogTitle>
            <Badge variant={food.is_global ? "secondary" : "outline"}>
              {food.is_global ? "TACO" : "Personalizado"}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            {food.categoria}
            {food.marca ? ` · ${food.marca}` : ""} · valores por {food.porcao_referencia_g}g
          </p>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Macronutrientes
            </p>
            <dl className="grid grid-cols-2 gap-3">
              {MACROS.map((n) => (
                <div key={String(n.key)}>
                  <dt className="text-xs text-muted-foreground">{n.label}</dt>
                  <dd className="font-medium text-foreground">
                    {formatNutrientValue(food, n.key, n.unit)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {micronutrientesDisponiveis.length > 0 && (
            <div>
              <Separator className="mb-4" />
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Outros nutrientes
              </p>
              <dl className="grid grid-cols-2 gap-3">
                {micronutrientesDisponiveis.map((n) => (
                  <div key={String(n.key)}>
                    <dt className="text-xs text-muted-foreground">{n.label}</dt>
                    <dd className="font-medium text-foreground">
                      {formatNutrientValue(food, n.key, n.unit)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <Separator />

          <p className="text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Fonte dos dados nutricionais: </span>
            {food.fonte_descricao ?? FONTE_DESCRICAO_PADRAO[food.fonte]}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
