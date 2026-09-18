"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { recipeIdentificationSchema, type RecipeIdentificationInput } from "@/lib/validations/recipe";
import { createRecipeDraft, updateRecipeIdentification, uploadRecipeImage } from "@/lib/actions/recipes";
import type { Recipe } from "@/lib/types/database.types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/shared/image-upload";

const IMAGE_ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
const IMAGE_ACCEPTED_EXTENSIONS = ".png,.jpg,.jpeg,.webp";
const IMAGE_MAX_BYTES = 4 * 1024 * 1024;

interface RecipeStepIdentificationProps {
  recipeId: string | null;
  recipe: Recipe | null;
  imageSignedUrl: string | null;
  onSaved: () => void;
}

export function RecipeStepIdentification({ recipeId, recipe, imageSignedUrl, onSaved }: RecipeStepIdentificationProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RecipeIdentificationInput>({
    resolver: zodResolver(recipeIdentificationSchema),
    defaultValues: {
      nome: recipe?.nome ?? "",
      descricao: recipe?.descricao ?? "",
      tagsTexto: recipe?.tags.join(", ") ?? "",
      tempo_preparo_min: recipe?.tempo_preparo_min ?? undefined,
      imagem_url: recipe?.imagem_url ?? null,
    },
  });

  async function onSubmit(values: RecipeIdentificationInput) {
    setLoading(true);

    if (recipeId) {
      const result = await updateRecipeIdentification(recipeId, values);
      setLoading(false);
      if (!result.success) {
        toast.error("Não foi possível salvar", { description: result.message });
        return;
      }
      toast.success(result.message ?? "Identificação salva.");
      onSaved();
      return;
    }

    const result = await createRecipeDraft(values);
    setLoading(false);
    if (!result.success || !result.id) {
      toast.error("Não foi possível criar a receita", { description: result.message });
      return;
    }
    router.replace(`/receitas/${result.id}/editar?etapa=2`);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nome">Nome da receita *</Label>
        <Input id="nome" placeholder="Ex: Frango grelhado com legumes" {...register("nome")} />
        {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="descricao">Descrição (opcional)</Label>
        <Textarea id="descricao" rows={2} {...register("descricao")} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="tagsTexto">Tags (separadas por vírgula)</Label>
          <Input id="tagsTexto" placeholder="low carb, vegano, sem lactose" {...register("tagsTexto")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tempo_preparo_min">Tempo de preparo (min)</Label>
          <Input id="tempo_preparo_min" type="number" step="1" {...register("tempo_preparo_min")} />
          {errors.tempo_preparo_min && (
            <p className="text-xs text-destructive">{errors.tempo_preparo_min.message}</p>
          )}
        </div>
      </div>

      <ImageUpload
        label="Foto da receita (opcional)"
        helperText="PNG, JPG ou WEBP — máximo 4MB."
        initialPreviewUrl={imageSignedUrl}
        acceptedTypes={IMAGE_ACCEPTED_TYPES}
        acceptedExtensions={IMAGE_ACCEPTED_EXTENSIONS}
        maxBytes={IMAGE_MAX_BYTES}
        onUpload={(file) => {
          const formData = new FormData();
          formData.set("file", file);
          return uploadRecipeImage(formData);
        }}
        onUploaded={(path) => setValue("imagem_url", path, { shouldDirty: true })}
      />
      {watch("imagem_url") && !recipeId && (
        <p className="text-xs text-muted-foreground">
          A imagem só fica salva na receita depois de clicar em &quot;Avançar&quot;.
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Avançar
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
