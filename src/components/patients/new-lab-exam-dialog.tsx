"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { labExamSchema, type LabExamInput } from "@/lib/validations/lab-exam";
import { createLabExam } from "@/lib/actions/lab-exams";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function NewLabExamDialog({ patientId }: { patientId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LabExamInput>({
    resolver: zodResolver(labExamSchema),
    defaultValues: { data_coleta: new Date().toISOString().slice(0, 10) },
  });

  async function onSubmit(values: LabExamInput) {
    setLoading(true);
    const result = await createLabExam(patientId, values);
    setLoading(false);

    if (!result.success) {
      toast.error("Não foi possível registrar o exame", { description: result.message });
      return;
    }

    toast.success("Exame registrado.");
    reset({ data_coleta: new Date().toISOString().slice(0, 10) });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          Novo exame
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo exame laboratorial</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="data_coleta">Data da coleta *</Label>
            <Input id="data_coleta" type="date" aria-required="true" {...register("data_coleta")} />
            {errors.data_coleta && <p className="text-xs text-destructive" role="alert">{errors.data_coleta.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="laboratorio">Laboratório</Label>
            <Input id="laboratorio" placeholder="Ex.: Fleury" {...register("laboratorio")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea id="observacoes" rows={2} {...register("observacoes")} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Registrar exame
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
