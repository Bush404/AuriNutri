"use client";

import { useState, useTransition } from "react";
import { Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { Food } from "@/lib/types/database.types";
import { deleteFood } from "@/lib/actions/foods";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FoodFormDialog } from "@/components/foods/food-form-dialog";
import { FoodDetailDialog } from "@/components/foods/food-detail-dialog";

export function FoodsTable({ foods }: { foods: Food[] }) {
  const [foodToDelete, setFoodToDelete] = useState<Food | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!foodToDelete) return;
    startTransition(async () => {
      const result = await deleteFood(foodToDelete.id);
      if (!result.success) {
        toast.error("Não foi possível excluir", { description: result.message });
        return;
      }
      toast.success("Alimento excluído.");
      setFoodToDelete(null);
    });
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Alimento</TableHead>
            <TableHead className="hidden sm:table-cell">Categoria</TableHead>
            <TableHead className="hidden md:table-cell">Porção</TableHead>
            <TableHead>Kcal</TableHead>
            <TableHead className="hidden lg:table-cell">Prot.</TableHead>
            <TableHead className="hidden lg:table-cell">Carb.</TableHead>
            <TableHead className="hidden lg:table-cell">Gord.</TableHead>
            <TableHead className="w-[50px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {foods.map((food) => (
            <TableRow key={food.id}>
              <TableCell>
                <FoodDetailDialog
                  food={food}
                  trigger={
                    <button type="button" className="text-left hover:underline">
                      <span className="text-sm font-medium text-foreground">{food.nome}</span>
                      {food.marca && <p className="text-xs text-muted-foreground">{food.marca}</p>}
                    </button>
                  }
                />
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Badge variant="secondary">{food.categoria}</Badge>
              </TableCell>
              <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                {food.porcao_referencia_g}g
              </TableCell>
              <TableCell className="text-sm font-medium">
                {food.calorias_kcal ?? "—"} {food.calorias_kcal !== null && "kcal"}
              </TableCell>
              <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                {food.proteinas_g ?? "—"}
                {food.proteinas_g !== null && "g"}
              </TableCell>
              <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                {food.carboidratos_g ?? "—"}
                {food.carboidratos_g !== null && "g"}
              </TableCell>
              <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                {food.gorduras_g ?? "—"}
                {food.gorduras_g !== null && "g"}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <FoodDetailDialog
                      food={food}
                      trigger={
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                          <Eye className="h-4 w-4" />
                          Ver detalhes
                        </DropdownMenuItem>
                      }
                    />
                    {!food.is_global && (
                      <>
                        <FoodFormDialog
                          food={food}
                          trigger={
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                              <Pencil className="h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                          }
                        />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setFoodToDelete(food)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Excluir
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog open={Boolean(foodToDelete)} onOpenChange={(open) => !open && setFoodToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir alimento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{foodToDelete?.nome}</strong>? Essa ação não pode
              ser desfeita. Planos alimentares que já usam este alimento não serão afetados, pois
              mantêm seu próprio registro nutricional.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isPending}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
