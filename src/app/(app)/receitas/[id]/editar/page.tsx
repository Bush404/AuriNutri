import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getRecipeImageSignedUrl } from "@/lib/actions/recipes";
import type { Recipe, RecipeIngredient } from "@/lib/types/database.types";
import { RecipeWizard } from "@/components/recipes/recipe-wizard";

interface EditarReceitaPageProps {
  params: { id: string };
  searchParams: { etapa?: string };
}

export default async function EditarReceitaPage({ params, searchParams }: EditarReceitaPageProps) {
  const supabase = createClient();

  const [{ data: recipe }, { data: ingredients }] = await Promise.all([
    supabase.from("recipes").select("*").eq("id", params.id).maybeSingle<Recipe>(),
    supabase
      .from("recipe_ingredients")
      .select("*")
      .eq("recipe_id", params.id)
      .order("ordem")
      .returns<RecipeIngredient[]>(),
  ]);

  if (!recipe) {
    notFound();
  }

  const imageSignedUrl = await getRecipeImageSignedUrl(recipe.imagem_url);
  const initialStep = Math.min(4, Math.max(1, Number(searchParams.etapa) || 1));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{recipe.nome}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Você pode voltar a qualquer etapa para revisar ou ajustar a receita.
        </p>
      </div>

      <RecipeWizard
        recipeId={recipe.id}
        recipe={recipe}
        ingredients={ingredients ?? []}
        imageSignedUrl={imageSignedUrl}
        initialStep={initialStep}
      />
    </div>
  );
}
