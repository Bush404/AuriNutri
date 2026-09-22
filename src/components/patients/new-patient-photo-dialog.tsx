"use client";

import { useId, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { patientPhotoSchema, type PatientPhotoInput, PATIENT_PHOTO_ACCEPTED_EXTENSIONS } from "@/lib/validations/patient-photo";
import { uploadPatientPhoto } from "@/lib/actions/patient-photos";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * REGRA ESTRUTURAL (Bloco C): sem consentimento ativo do tipo 'fotos', este
 * componente não renderiza NADA (não um botão desabilitado, não um aviso
 * clicável) — quem quer que o chame deve checar `consentimentoAtivoFotos`
 * antes e mostrar só uma mensagem de texto no lugar. Ver PatientPhotosPanel.
 */
export function NewPatientPhotoDialog({ patientId }: { patientId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [arquivoNome, setArquivoNome] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const anguloLabelId = useId();
  const fotoLabelId = useId();
  const fotoButtonTextId = useId();

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PatientPhotoInput>({
    resolver: zodResolver(patientPhotoSchema),
    defaultValues: { data_registro: new Date().toISOString().slice(0, 10) },
  });

  function resetTudo() {
    reset({ data_registro: new Date().toISOString().slice(0, 10) });
    setArquivoNome(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function onSubmit(values: PatientPhotoInput) {
    const file = inputRef.current?.files?.[0];
    if (!file) {
      toast.error("Selecione a foto.");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.set("file", file);
    const result = await uploadPatientPhoto(patientId, values, formData);
    setLoading(false);

    if (!result.success) {
      toast.error("Não foi possível registrar a foto", { description: result.message });
      return;
    }

    toast.success(result.message ?? "Foto registrada.");
    resetTudo();
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetTudo();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          Nova foto
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova foto de evolução</DialogTitle>
          <DialogDescription>Dado sensível (LGPD) — visível só para você, com URL de curta duração.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data_registro_foto">Data *</Label>
              <Input id="data_registro_foto" type="date" aria-required="true" {...register("data_registro")} />
              {errors.data_registro && <p className="text-xs text-destructive" role="alert">{errors.data_registro.message}</p>}
            </div>
            <div className="space-y-2">
              <Label id={anguloLabelId}>Ângulo *</Label>
              <Controller
                control={control}
                name="tipo"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-labelledby={anguloLabelId} aria-required="true">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="frente">Frente</SelectItem>
                      <SelectItem value="perfil">Perfil</SelectItem>
                      <SelectItem value="costas">Costas</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.tipo && <p className="text-xs text-destructive" role="alert">{errors.tipo.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label id={fotoLabelId}>Foto *</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => inputRef.current?.click()}
              aria-labelledby={`${fotoLabelId} ${fotoButtonTextId}`}
              aria-required="true"
            >
              <Camera className="h-4 w-4" />
              <span id={fotoButtonTextId}>{arquivoNome ?? "Selecionar foto"}</span>
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept={PATIENT_PHOTO_ACCEPTED_EXTENSIONS}
              className="hidden"
              onChange={(e) => setArquivoNome(e.target.files?.[0]?.name ?? null)}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Registrar foto
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
