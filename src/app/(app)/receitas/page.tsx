import Link from "next/link";
import { CookingPot, Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import type { Recipe } from "@/lib/types/database.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { RecipeFilters } from "@/components/recipes/recipe-filters";
import { RecipesTable } from "@/components/recipes/recipes-table";

const PAGE_SIZE = 20;

interface ReceitasPageProps {
  searchParams: Promise<{ busca?: string; tag?: string; pagina?: string }>;
}

export default async function ReceitasPage(props: ReceitasPageProps) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const busca = searchParams.busca?.trim();
  const tag = searchParams.tag;
  const page = Math.max(1, Number(searchParams.pagina) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase.from("recipes").select("*", { count: "exact" });

  if (busca) {
    query = query.ilike("nome", `%${busca}%`);
  }
  if (tag) {
    query = query.contains("tags", [tag]);
  }

  query = query.order("created_at", { ascending: false }).range(from, to);

  const [{ data: recipes, count, error }, { data: tagsRows }] = await Promise.all([
    query,
    supabase.from("recipes").select("tags").returns<{ tags: string[] }[]>(),
  ]);

  const tags = Array.from(new Set((tagsRows ?? []).flatMap((r) => r.tags))).sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );

  const recipesList: Recipe[] = recipes ?? [];
  const semResultados = recipesList.length === 0;
  const temFiltrosAtivos = Boolean(busca || tag);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Receitas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Preparações com nutrição calculada a partir dos ingredientes, prontas para usar nos
            planos alimentares.
          </p>
        </div>
        <Button asChild>
          <Link href="/receitas/novo">
            <Plus className="h-4 w-4" />
            Nova receita
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <RecipeFilters tags={tags} />

          {error && <p className="text-sm text-destructive" role="alert">Erro ao carregar receitas: {error.message}</p>}

          {!error && !semResultados && <RecipesTable recipes={recipesList} />}

          {!error && semResultados && temFiltrosAtivos && (
            <EmptyState
              icon={CookingPot}
              title="Nenhuma receita encontrada"
              description="Tente ajustar a busca ou a tag selecionada."
            />
          )}

          {!error && semResultados && !temFiltrosAtivos && (
            <EmptyState
              icon={CookingPot}
              title="Você ainda não cadastrou nenhuma receita"
              description="Monte receitas com ingredientes da TACO ou seus próprios alimentos — a nutrição é calculada automaticamente."
              action={
                <Button asChild size="sm">
                  <Link href="/receitas/novo">Criar receita</Link>
                </Button>
              }
            />
          )}

          {!error && !semResultados && (
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              totalCount={count ?? 0}
              basePath="/receitas"
              searchParams={{ busca, tag }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
