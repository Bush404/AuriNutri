"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { Recipe } from "@/lib/types/database.types";
import { deleteRecipe } from "@/lib/actions/recipes";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function RecipesTable({ recipes }: { recipes: Recipe[] }) {
  const [, startTransition] = useTransition();

  function handleDelete(recipeId: string) {
    startTransition(async () => {
      const result = await deleteRecipe(recipeId);
      if (!result.success) {
        toast.error("Não foi possível excluir", { description: result.message });
        return;
      }
      toast.success("Receita excluída.");
    });
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Receita</TableHead>
            <TableHead className="hidden sm:table-cell">Tags</TableHead>
            <TableHead className="hidden md:table-cell">Tempo de preparo</TableHead>
            <TableHead>Porções</TableHead>
            <TableHead className="w-[50px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {recipes.map((recipe) => {
            const isDraft = recipe.rendimento_g === null || recipe.numero_porcoes === null;
            return (
              <TableRow key={recipe.id}>
                <TableCell>
                  <Link href={`/receitas/${recipe.id}/editar`} className="hover:underline">
                    <span className="text-sm font-medium text-foreground">{recipe.nome}</span>
                  </Link>
                  {isDraft && (
                    <Badge variant="warning" className="ml-2 text-[10px]">
                      Rascunho
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {recipe.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                    {recipe.tags.length > 3 && (
                      <span className="text-xs text-muted-foreground">+{recipe.tags.length - 3}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                  {recipe.tempo_preparo_min ? `${recipe.tempo_preparo_min} min` : "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{recipe.numero_porcoes ?? "—"}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/receitas/${recipe.id}/editar`}>
                          <Pencil className="h-4 w-4" />
                          Editar
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => handleDelete(recipe.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </>
  );
}
