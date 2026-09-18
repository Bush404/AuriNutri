import { RecipeWizard } from "@/components/recipes/recipe-wizard";

export default function NovaReceitaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Nova receita</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Preencha as 4 etapas — você pode voltar a qualquer uma delas antes de concluir.
        </p>
      </div>

      <RecipeWizard recipeId={null} recipe={null} ingredients={[]} imageSignedUrl={null} initialStep={1} />
    </div>
  );
}
