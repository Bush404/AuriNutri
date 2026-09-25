"use client";

import { useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { ClipboardList, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { Anamnesis } from "@/lib/types/database.types";
import { deleteAnamnesis } from "@/lib/actions/clinical";
import { updateSearchParams } from "@/lib/url-state";
import { formatDate } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { AnamnesisForm } from "@/components/patients/anamnesis-form";

interface AnamnesisTimelineProps {
  patientId: string;
  /** Já vem ordenado do servidor, mais recente primeiro. */
  anamneses: Anamnesis[];
}

/** Valor de `?anamnese=` para o formulário de uma anamnese nova. */
const NOVA = "nova";

function anamnesisName(anamnese: Anamnesis): string {
  return anamnese.titulo?.trim() || "Registro de anamnese";
}

/**
 * Aba Anamnese: nunca abre um registro sozinha. Mostra "Adicionar nova
 * anamnese" no topo e, abaixo, os registros fechados (nome + data). Clicar
 * no card abre o registro; as ações ficam no menu de três pontinhos.
 *
 * O registro aberto fica na URL (?anamnese=<id> ou ?anamnese=nova): o
 * "voltar" do navegador fecha o registro e continua nesta aba.
 */
export function AnamnesisTimeline({ patientId, anamneses }: AnamnesisTimelineProps) {
  const aberta = useSearchParams().get("anamnese");
  const creating = aberta === NOVA;
  const openId = aberta && aberta !== NOVA ? aberta : null;
  // Se fomos nós que abrimos (pushState), fechar = voltar no histórico, para
  // o "voltar" do navegador não precisar de dois cliques depois.
  const abertaPorAqui = useRef(false);

  function abrir(valor: string) {
    abertaPorAqui.current = true;
    updateSearchParams({ aba: "anamnese", anamnese: valor }, "push");
  }

  function fechar() {
    if (abertaPorAqui.current) {
      abertaPorAqui.current = false;
      window.history.back();
    } else {
      updateSearchParams({ anamnese: null });
    }
  }

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
          <Button size="sm" onClick={() => abrir(NOVA)}>
            <Plus className="h-4 w-4" />
            Adicionar nova anamnese
          </Button>
        )}
      </div>

      {creating && <AnamnesisForm patientId={patientId} onSaved={fechar} onCancel={fechar} />}

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
          {anamneses.map((anamnese) => (
            <li key={anamnese.id}>
              {openId === anamnese.id ? (
                <AnamnesisForm patientId={patientId} anamnesis={anamnese} onSaved={fechar} onCancel={fechar} />
              ) : (
                <AnamnesisRow patientId={patientId} anamnese={anamnese} onOpen={() => abrir(anamnese.id)} />
              )}
            </li>
          ))}
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const name = anamnesisName(anamnese);
  const data = formatDate(anamnese.data_registro);

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteAnamnesis(patientId, anamnese.id);
      if (!result.success) {
        toast.error("Não foi possível excluir a anamnese", { description: result.message });
        return;
      }
      setConfirmOpen(false);
      toast.success(result.message ?? "Anamnese excluída.");
    });
  }

  return (
    <Card className="cursor-pointer transition-shadow hover:shadow-card" onClick={onOpen}>
      <CardContent className="flex items-center justify-between gap-3 p-4">
        {/* O card todo abre o registro com o mouse; este botão é o caminho pelo teclado/leitor de tela. */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="flex min-w-0 items-center gap-3 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Abrir ${name} de ${data}`}
        >
          <Badge variant="secondary" className="shrink-0">
            {data}
          </Badge>
          <span className="truncate font-medium text-foreground">{name}</span>
        </button>

        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" disabled={isPending} aria-label={`Ações de ${name} de ${data}`}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onOpen}>
                <Pencil className="h-4 w-4" />
                Visualizar/editar
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirmOpen(true)}>
                <Trash2 className="h-4 w-4" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir anamnese</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir <strong>{name}</strong> de {data}? Ela deixa de aparecer no histórico
                  do paciente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    handleDelete();
                  }}
                  disabled={isPending}
                >
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
