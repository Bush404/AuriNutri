"use client";

import { useId, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import {
  BRAZIL_UFS,
  profileSchema,
  type ProfileInput,
  PROFILE_FILE_ACCEPTED_TYPES,
  PROFILE_FILE_ACCEPTED_EXTENSIONS,
  PROFILE_FILE_MAX_BYTES,
} from "@/lib/validations/profile";
import { updateProfile, uploadProfileFile } from "@/lib/actions/profile";
import type { Profile } from "@/lib/types/database.types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ImageUpload } from "@/components/shared/image-upload";

interface ProfileFormProps {
  profile: Profile;
  logoSignedUrl: string | null;
  assinaturaSignedUrl: string | null;
}

export function ProfileForm({ profile, logoSignedUrl, assinaturaSignedUrl }: ProfileFormProps) {
  const [loading, setLoading] = useState(false);
  const crnUfLabelId = useId();

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      nome: profile.nome,
      crn: profile.crn ?? "",
      crn_uf: (profile.crn_uf as ProfileInput["crn_uf"]) ?? undefined,
      especialidade: profile.especialidade ?? "",
      telefone: profile.telefone ?? "",
      endereco: profile.endereco ?? "",
      bio: profile.bio ?? "",
      cor_marca: profile.cor_marca ?? "",
      logo_url: profile.logo_url ?? null,
      assinatura_url: profile.assinatura_url ?? null,
    },
  });

  async function onSubmit(values: ProfileInput) {
    setLoading(true);
    const result = await updateProfile(values);
    setLoading(false);

    if (!result.success) {
      toast.error("Não foi possível salvar", { description: result.message });
      return;
    }
    toast.success(result.message ?? "Perfil atualizado.");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Dados profissionais</CardTitle>
          <CardDescription>Essas informações aparecem nos documentos gerados para seus pacientes.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="nome">Nome completo *</Label>
            <Input id="nome" placeholder="Seu nome" aria-required="true" {...register("nome")} />
            {errors.nome && <p className="text-xs text-destructive" role="alert">{errors.nome.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="crn">Número do CRN</Label>
            <Input id="crn" placeholder="12345" {...register("crn")} />
            {errors.crn && <p className="text-xs text-destructive" role="alert">{errors.crn.message}</p>}
          </div>

          <div className="space-y-2">
            <Label id={crnUfLabelId}>UF do CRN</Label>
            <Controller
              control={control}
              name="crn_uf"
              render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger aria-labelledby={crnUfLabelId}>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {BRAZIL_UFS.map((uf) => (
                      <SelectItem key={uf} value={uf}>
                        {uf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.crn_uf && <p className="text-xs text-destructive" role="alert">{errors.crn_uf.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="especialidade">Especialidade</Label>
            <Input id="especialidade" placeholder="Ex: nutrição esportiva" {...register("especialidade")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone</Label>
            <Input id="telefone" placeholder="(00) 00000-0000" {...register("telefone")} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="endereco">Endereço do consultório</Label>
            <Input id="endereco" placeholder="Endereço completo" {...register("endereco")} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" rows={4} placeholder="Uma breve apresentação profissional" {...register("bio")} />
            {errors.bio && <p className="text-xs text-destructive" role="alert">{errors.bio.message}</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Identidade visual</CardTitle>
          <CardDescription>Usada nos PDFs de plano alimentar entregues aos pacientes.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cor_marca">Cor de marca</Label>
            <div className="flex items-center gap-3">
              <Controller
                control={control}
                name="cor_marca"
                render={({ field }) => (
                  <input
                    type="color"
                    className="h-10 w-14 cursor-pointer rounded-md border border-input p-1"
                    value={field.value || "#2563eb"}
                    onChange={(e) => field.onChange(e.target.value)}
                  />
                )}
              />
              <Input id="cor_marca" placeholder="#2563eb" className="max-w-[140px]" {...register("cor_marca")} />
            </div>
            {errors.cor_marca && <p className="text-xs text-destructive" role="alert">{errors.cor_marca.message}</p>}
          </div>

          <div className="hidden sm:block" />

          <ImageUpload
            label="Logo"
            helperText="PNG, JPG, WEBP ou SVG — máximo 2MB."
            initialPreviewUrl={logoSignedUrl}
            acceptedTypes={PROFILE_FILE_ACCEPTED_TYPES}
            acceptedExtensions={PROFILE_FILE_ACCEPTED_EXTENSIONS}
            maxBytes={PROFILE_FILE_MAX_BYTES}
            onUpload={(file) => {
              const formData = new FormData();
              formData.set("file", file);
              return uploadProfileFile("logo", formData);
            }}
            onUploaded={(path) => {
              setValue("logo_url", path, { shouldDirty: true });
              toast.success("Arquivo enviado. Não esqueça de salvar o perfil.");
            }}
          />

          <ImageUpload
            label="Assinatura"
            helperText="PNG, JPG, WEBP ou SVG — máximo 2MB."
            initialPreviewUrl={assinaturaSignedUrl}
            acceptedTypes={PROFILE_FILE_ACCEPTED_TYPES}
            acceptedExtensions={PROFILE_FILE_ACCEPTED_EXTENSIONS}
            maxBytes={PROFILE_FILE_MAX_BYTES}
            onUpload={(file) => {
              const formData = new FormData();
              formData.set("file", file);
              return uploadProfileFile("assinatura", formData);
            }}
            onUploaded={(path) => {
              setValue("assinatura_url", path, { shouldDirty: true });
              toast.success("Arquivo enviado. Não esqueça de salvar o perfil.");
            }}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar perfil
        </Button>
      </div>
    </form>
  );
}
