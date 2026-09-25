"use client";

import { useState, useTransition } from "react";
import { ClipboardList, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { Anamnesis } from "@/lib/types/database.types";
import { deleteAnamnesis } from "@/lib/actions/clinical";
import { formatDate } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { AnamnesisForm } from "@/components/patients/anamnesis-form";

interface AnamnesisTimelineProps {
  patientId: string;
  /** Já vem ordenado do servidor, mais recente primeiro. */
  anamneses: Anamnesis[];
}

function anamnesisName(anamnese: Anamnesis): string {
  return anamnese.titulo?.trim() || "Registro de anamnese";
}

/**
 * Aba Anamnese: nunca abre um registro sozinha. Mostra "Adicionar nova
 * anamnese" no topo e, abaixo, os registros fechados (nome + data), cada um
 * com "Visualizar/editar" e "Excluir".
 */
export function AnamnesisTimeline({ patientId, anamneses }: AnamnesisTimelineProps) {
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Anamnese</h2>
          <p className="text-sm text-muted-foreground">
            Registros do paciente, mais recente primeiro. Um novo registro nunca sobrescreve os anteriores.
          </p>
        </div>
        {!creating && (
          <Button
            size="sm"
            onClick={() => {
              setOpenId(null);
              setCreating(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Adicionar nova anamnese
          </Button>
        )}
      </div>

      {creating && (
        <AnamnesisForm patientId={patientId} onSaved={() => setCreating(false)} onCancel={() => setCreating(false)} />
      )}

      {anamneses.length === 0 && !creating && (
        <Card>
          <CardContent className="py-10">
            <EmptyState
              icon={ClipboardList}
              title="Nenhuma anamnese registrada"
              description="Clique em “Adicionar nova anamnese” para registrar a primeira."
            />
          </CardContent>
        </Card>
      )}

      {anamneses.length > 0 && (
        <ul className="space-y-2" aria-label="Anamneses registradas">
          {anamneses.map((anamnese) =>
            openId === anamnese.id ? (
              <li key={anamnese.id}>
                <AnamnesisForm
                  patientId={patientId}
                  anamnesis={anamnese}
                  onSaved={() => setOpenId(null)}
                  onCancel={() => setOpenId(null)}
                />
              </li>
            ) : (
              <li key={anamnese.id}>
                <AnamnesisRow
                  patientId={patientId}
                  anamnese={anamnese}
                  onOpen={() => {
                    setCreating(false);
                    setOpenId(anamnese.id);
                  }}
                />
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}

function AnamnesisRow({
  patientId,
  anamnese,
  onOpen,
}: {
  patientId: string;
  anamnese: Anamnesis;
  onOpen: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const name = anamnesisName(anamnese);

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteAnamnesis(patientId, anamnese.id);
      if (!result.success) {
        toast.error("Não foi possível excluir a anamnese", { description: result.message });
        return;
      }
      toast.success(result.message ?? "Anamnese excluída.");
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Badge variant="secondary" className="shrink-0">
            {formatDate(anamnese.data_registro)}
          </Badge>
          <p className="truncate font-medium text-foreground">{name}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={onOpen} disabled={isPending}>
            <Pencil className="h-4 w-4" />
            Visualizar/editar
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={isPending}
                aria-label={`Excluir ${name} de ${formatDate(anamnese.data_registro)}`}
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Excluir
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir anamnese</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir <strong>{name}</strong> de {formatDate(anamnese.data_registro)}? Ela
                  deixa de aparecer no histórico do paciente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={isPending}>
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
