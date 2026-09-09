"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal, Pencil, Trash2, Eye } from "lucide-react";

import type { Patient } from "@/lib/types/database.types";
import { calculateAge, formatDate, getInitials } from "@/lib/utils";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { DeletePatientDialog } from "@/components/patients/delete-patient-dialog";

export function PatientTable({ patients }: { patients: Patient[] }) {
  const [patientToDelete, setPatientToDelete] = useState<Patient | null>(null);

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Paciente</TableHead>
            <TableHead className="hidden sm:table-cell">Contato</TableHead>
            <TableHead className="hidden md:table-cell">Idade</TableHead>
            <TableHead className="hidden md:table-cell">Cadastrado em</TableHead>
            <TableHead className="w-[60px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {patients.map((patient) => {
            const age = calculateAge(patient.data_nascimento);
            return (
              <TableRow key={patient.id}>
                <TableCell>
                  <Link href={`/pacientes/${patient.id}`} className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback>{getInitials(patient.nome)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-foreground">{patient.nome}</p>
                      {patient.objetivo && (
                        <Badge variant="secondary" className="mt-0.5">
                          {patient.objetivo}
                        </Badge>
                      )}
                    </div>
                  </Link>
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                  {patient.email || patient.telefone || "—"}
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                  {age !== null ? `${age} anos` : "—"}
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                  {formatDate(patient.created_at.slice(0, 10))}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/pacientes/${patient.id}`}>
                          <Eye className="h-4 w-4" />
                          Ver perfil
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/pacientes/${patient.id}/editar`}>
                          <Pencil className="h-4 w-4" />
                          Editar
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setPatientToDelete(patient)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {patientToDelete && (
        <DeletePatientDialog
          patientId={patientToDelete.id}
          patientName={patientToDelete.nome}
          open={Boolean(patientToDelete)}
          onOpenChange={(open) => !open && setPatientToDelete(null)}
        />
      )}
    </>
  );
}
