"use client";

import { createContext, useContext } from "react";

import type { FoodMeasure } from "@/lib/types/database.types";

/**
 * Medidas caseiras dos alimentos do plano, por alimento (Fase 17, Bloco D) —
 * buscadas uma vez na página do plano e lidas por cada item, sem passar de
 * mão em mão por MealList → MealCard → linha.
 */
const MedidasContext = createContext<Record<string, FoodMeasure[]>>({});

export function MedidasProvider({
  medidas,
  children,
}: {
  medidas: Record<string, FoodMeasure[]>;
  children: React.ReactNode;
}) {
  return <MedidasContext.Provider value={medidas}>{children}</MedidasContext.Provider>;
}

export function useMedidasDoAlimento(foodId: string | null): FoodMeasure[] {
  const medidas = useContext(MedidasContext);
  return foodId ? (medidas[foodId] ?? []) : [];
}
