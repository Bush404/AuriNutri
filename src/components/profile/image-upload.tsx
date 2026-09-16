"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImageOff, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { uploadProfileFile } from "@/lib/actions/profile";
import {
  PROFILE_FILE_ACCEPTED_EXTENSIONS,
  PROFILE_FILE_ACCEPTED_TYPES,
  PROFILE_FILE_MAX_BYTES,
} from "@/lib/validations/profile";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface ImageUploadProps {
  kind: "logo" | "assinatura";
  label: string;
  helperText?: string;
  initialPreviewUrl: string | null;
  onUploaded: (path: string) => void;
}

export function ImageUpload({ kind, label, helperText, initialPreviewUrl, onUploaded }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(initialPreviewUrl);
  const [uploading, setUploading] = useState(false);

  function validate(file: File): string | null {
    if (!PROFILE_FILE_ACCEPTED_TYPES.includes(file.type as (typeof PROFILE_FILE_ACCEPTED_TYPES)[number])) {
      return "Formato inválido. Use PNG, JPG, WEBP ou SVG.";
    }
    if (file.size > PROFILE_FILE_MAX_BYTES) {
      return "Arquivo muito grande. O limite é 2MB.";
    }
    return null;
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const validationError = validate(file);
    if (validationError) {
      toast.error("Não foi possível enviar o arquivo", { description: validationError });
      event.target.value = "";
      return;
    }

    const previousPreview = preview;
    setPreview(URL.createObjectURL(file));
    setUploading(true);

    const formData = new FormData();
    formData.set("file", file);

    const result = await uploadProfileFile(kind, formData);
    setUploading(false);
    event.target.value = "";

    if (!result.success || !result.path) {
      setPreview(previousPreview);
      toast.error("Não foi possível enviar o arquivo", { description: result.message });
      return;
    }

    onUploaded(result.path);
    toast.success("Arquivo enviado. Não esqueça de salvar o perfil.");
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed border-input bg-muted">
          {preview ? (
            <Image src={preview} alt={label} width={80} height={80} className="h-full w-full object-contain" unoptimized />
          ) : (
            <ImageOff className="h-6 w-6 text-muted-foreground" />
          )}
        </div>

        <div className="space-y-1">
          <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {preview ? "Trocar imagem" : "Enviar imagem"}
          </Button>
          <p className="text-xs text-muted-foreground">{helperText ?? "PNG, JPG, WEBP ou SVG — máximo 2MB."}</p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={PROFILE_FILE_ACCEPTED_EXTENSIONS}
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
