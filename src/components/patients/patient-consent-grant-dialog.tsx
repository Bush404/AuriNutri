"use client";

import { useId, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { patientConsentSchema, type PatientConsentInput } from "@/lib/validations/patient-consent";
import { grantPatientConsent } from "@/lib/actions/patient-consents";
import type { TipoConsentimento } from "@/lib/types/database.types";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

interface PatientConsentGrantDialogProps {
  patientId: string;
  tipo: TipoConsentimento;
  tipoLabel: string;
}

export function PatientConsentGrantDialog({ patientId, tipo, tipoLabel }: PatientConsentGrantDialogProps) {
  const [open, setOpen] = useState(false);
  const comoFoiObtidoLabelId = useId();
  const [loading, setLoading] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PatientConsentInput>({
    resolver: zodResolver(patientConsentSchema),
    defaultValues: { tipo },
  });

  async function onSubmit(values: PatientConsentInput) {
    setLoading(true);
    const result = await grantPatientConsent(patientId, { ...values, tipo });
    setLoading(false);

    if (!result.success) {
      toast.error("Não foi possível registrar o consentimento", { description: result.message });
      return;
    }

    toast.success(result.message ?? "Consentimento registrado.");
    reset({ tipo });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <ShieldCheck className="h-4 w-4" />
          Registrar consentimento
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar consentimento — {tipoLabel}</DialogTitle>
          <DialogDescription>
            Documenta que o paciente autorizou o tratamento desse dado sensível. Uma vez salvo, tipo, forma e data
            não podem mais ser editados — só revogados.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label id={comoFoiObtidoLabelId}>Como foi obtido *</Label>
            <Controller
              control={control}
              name="forma"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger aria-labelledby={comoFoiObtidoLabelId}>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="presencial">Presencial</SelectItem>
                    <SelectItem value="documento_assinado">Documento assinado</SelectItem>
                    <SelectItem value="verbal_registrado">Verbal registrado</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.forma && <p className="text-xs text-destructive" role="alert">{errors.forma.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              rows={2}
              placeholder="Ex.: consentimento obtido durante a consulta de avaliação inicial."
              {...register("observacoes")}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Registrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
