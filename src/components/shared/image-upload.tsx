"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImageOff, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface UploadResult {
  success: boolean;
  message?: string;
  path?: string;
}

interface ImageUploadProps {
  label: string;
  helperText?: string;
  initialPreviewUrl: string | null;
  acceptedTypes: readonly string[];
  acceptedExtensions: string;
  maxBytes: number;
  /** Faz o upload de verdade (Server Action) e retorna o path salvo no storage. */
  onUpload: (file: File) => Promise<UploadResult>;
  /** Chamado com o path retornado por onUpload — quem usa decide o que fazer com ele (setValue, toast, etc.). */
  onUploaded: (path: string) => void;
}

/** Campo de upload de imagem com preview — reusado no perfil (logo/assinatura) e em receitas. */
export function ImageUpload({
  label,
  helperText,
  initialPreviewUrl,
  acceptedTypes,
  acceptedExtensions,
  maxBytes,
  onUpload,
  onUploaded,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(initialPreviewUrl);
  const [uploading, setUploading] = useState(false);

  function validate(file: File): string | null {
    if (!acceptedTypes.includes(file.type)) {
      return "Formato de arquivo inválido.";
    }
    if (file.size > maxBytes) {
      return `Arquivo muito grande. O limite é ${Math.round(maxBytes / (1024 * 1024))}MB.`;
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

    const result = await onUpload(file);
    setUploading(false);
    event.target.value = "";

    if (!result.success || !result.path) {
      setPreview(previousPreview);
      toast.error("Não foi possível enviar o arquivo", { description: result.message });
      return;
    }

    onUploaded(result.path);
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
          <p className="text-xs text-muted-foreground">{helperText}</p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={acceptedExtensions}
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
