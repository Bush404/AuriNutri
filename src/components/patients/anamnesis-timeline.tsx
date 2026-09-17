"use client";

import { useState } from "react";
import { ClipboardList, Pencil, Plus } from "lucide-react";

import type { Anamnesis } from "@/lib/types/database.types";
import { formatDate } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { AnamnesisForm, ANAMNESIS_FIELDS } from "@/components/patients/anamnesis-form";

interface AnamnesisTimelineProps {
  patientId: string;
  /** Já vem ordenado do servidor, mais recente primeiro. */
  anamneses: Anamnesis[];
}

export function AnamnesisTimeline({ patientId, anamneses }: AnamnesisTimelineProps) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Anamnese</h2>
          <p className="text-sm text-muted-foreground">
            Histórico de anamneses do paciente, mais recente primeiro. Um novo registro nunca
            sobrescreve os anteriores.
          </p>
        </div>
        {!creating && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            Nova anamnese
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
              description="Clique em “Nova anamnese” para registrar a primeira."
            />
          </CardContent>
        </Card>
      )}

      {anamneses.map((anamnese) =>
        editingId === anamnese.id ? (
          <AnamnesisForm
            key={anamnese.id}
            patientId={patientId}
            anamnesis={anamnese}
            onSaved={() => setEditingId(null)}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <Card key={anamnese.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-3">
                <Badge variant="secondary">{formatDate(anamnese.data_registro)}</Badge>
                <CardTitle className="text-base">Registro de anamnese</CardTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setEditingId(anamnese.id)}>
                <Pencil className="h-4 w-4" />
                Editar
              </Button>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {ANAMNESIS_FIELDS.filter((field) => anamnese[field.name]).map((field) => (
                <div key={field.name}>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{field.label}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{anamnese[field.name]}</p>
                </div>
              ))}
              {ANAMNESIS_FIELDS.every((field) => !anamnese[field.name]) && (
                <p className="text-sm text-muted-foreground md:col-span-2">Nenhum campo preenchido.</p>
              )}
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}
