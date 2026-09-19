"use client";

import { useTransition } from "react";
import { ShieldOff } from "lucide-react";
import { toast } from "sonner";

import type { FormaConsentimento, PatientConsent, TipoConsentimento } from "@/lib/types/database.types";
import { revokePatientConsent } from "@/lib/actions/patient-consents";
import { formatDateTime } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { PatientConsentGrantDialog } from "@/components/patients/patient-consent-grant-dialog";

const TIPOS: TipoConsentimento[] = ["exames", "fotos", "dados_clinicos"];

const TIPO_LABELS: Record<TipoConsentimento, string> = {
  exames: "Exames laboratoriais",
  fotos: "Fotos de evolução",
  dados_clinicos: "Dados clínicos",
};

const FORMA_LABELS: Record<FormaConsentimento, string> = {
  presencial: "Presencial",
  documento_assinado: "Documento assinado",
  verbal_registrado: "Verbal registrado",
};

function isAtivo(consent: PatientConsent) {
  return consent.concedido && consent.data_revogacao === null;
}

export function PatientConsentsPanel({ patientId, consents }: { patientId: string; consents: PatientConsent[] }) {
  const historico = consents
    .slice()
    .sort((a, b) => new Date(b.data_consentimento).getTime() - new Date(a.data_consentimento).getTime());

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Status por tipo de dado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {TIPOS.map((tipo) => {
            const doTipo = historico.filter((c) => c.tipo === tipo);
            const ativo = doTipo.find(isAtivo) ?? null;
            const ultimo = doTipo[0] ?? null;
            return (
              <ConsentStatusRow
                key={tipo}
                patientId={patientId}
                tipo={tipo}
                ativo={ativo}
                ultimoRevogado={!ativo && ultimo ? ultimo : null}
              />
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de consentimentos</CardTitle>
        </CardHeader>
        <CardContent>
          {historico.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum consentimento registrado ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Forma</TableHead>
                  <TableHead>Concedido em</TableHead>
                  <TableHead>Revogado em</TableHead>
                  <TableHead>Observações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historico.map((consent) => (
                  <TableRow key={consent.id}>
                    <TableCell className="font-medium">{TIPO_LABELS[consent.tipo]}</TableCell>
                    <TableCell>
                      <Badge variant={isAtivo(consent) ? "secondary" : "outline"}>
                        {isAtivo(consent) ? "Ativo" : "Revogado"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{FORMA_LABELS[consent.forma]}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(consent.data_consentimento)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(consent.data_revogacao)}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground" title={consent.observacoes ?? undefined}>
                      {consent.observacoes ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ConsentStatusRow({
  patientId,
  tipo,
  ativo,
  ultimoRevogado,
}: {
  patientId: string;
  tipo: TipoConsentimento;
  ativo: PatientConsent | null;
  ultimoRevogado: PatientConsent | null;
}) {
  const [isPending, startTransition] = useTransition();

  function handleRevoke() {
    if (!ativo) return;
    startTransition(async () => {
      const result = await revokePatientConsent(patientId, ativo.id);
      if (!result.success) {
        toast.error("Não foi possível revogar", { description: result.message });
        return;
      }
      toast.success(result.message ?? "Consentimento revogado.");
    });
  }

  return (
    <div className="flex flex-col justify-between gap-3 rounded-md border border-border p-3 sm:flex-row sm:items-center">
      <div>
        <p className="text-sm font-medium text-foreground">{TIPO_LABELS[tipo]}</p>
        {ativo ? (
          <p className="text-xs text-muted-foreground">
            Ativo desde {formatDateTime(ativo.data_consentimento)} · {FORMA_LABELS[ativo.forma]}
          </p>
        ) : ultimoRevogado ? (
          <p className="text-xs text-muted-foreground">
            Revogado em {formatDateTime(ultimoRevogado.data_revogacao)} — nenhum novo upload desse tipo é permitido
            até um novo consentimento ser registrado.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhum consentimento registrado ainda.</p>
        )}
      </div>

      {ativo ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" disabled={isPending}>
              <ShieldOff className="h-4 w-4" />
              Revogar
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revogar consentimento de {TIPO_LABELS[tipo].toLowerCase()}?</AlertDialogTitle>
              <AlertDialogDescription>
                A partir de agora, nenhum novo arquivo/dado desse tipo poderá ser enviado para este paciente até um
                novo consentimento ser registrado. Dados já existentes não são apagados por esta ação — este
                registro de consentimento também não é apagado, só marcado como revogado.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleRevoke}>Revogar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <PatientConsentGrantDialog patientId={patientId} tipo={tipo} tipoLabel={TIPO_LABELS[tipo]} />
      )}
    </div>
  );
}
