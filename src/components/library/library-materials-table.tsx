"use client";

import { useTransition } from "react";
import { Eye, FileText, MoreHorizontal, NotebookText, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { LibraryMaterial } from "@/lib/types/database.types";
import { LIBRARY_MATERIAL_TIPO_LABELS } from "@/lib/validations/library-material";
import { deleteLibraryMaterial, getLibraryMaterialFileSignedUrl } from "@/lib/actions/library-materials";
import { LibraryMaterialFormDialog } from "@/components/library/library-material-form-dialog";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LibraryMaterialsTable({ materials }: { materials: LibraryMaterial[] }) {
  const [, startTransition] = useTransition();

  function handleDelete(materialId: string) {
    startTransition(async () => {
      const result = await deleteLibraryMaterial(materialId);
      if (!result.success) {
        toast.error("Não foi possível excluir", { description: result.message });
        return;
      }
      toast.success("Material excluído.");
    });
  }

  function handleAbrirArquivo(arquivoPath: string) {
    startTransition(async () => {
      const url = await getLibraryMaterialFileSignedUrl(arquivoPath);
      if (!url) {
        toast.error("Não foi possível abrir o arquivo.");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Material</TableHead>
          <TableHead className="hidden sm:table-cell">Tipo</TableHead>
          <TableHead className="hidden md:table-cell">Tags</TableHead>
          <TableHead className="hidden sm:table-cell">Origem</TableHead>
          <TableHead className="w-[50px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {materials.map((material) => (
          <TableRow key={material.id}>
            <TableCell>
              <span className="text-sm font-medium text-foreground">{material.titulo}</span>
              {material.descricao && (
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{material.descricao}</p>
              )}
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              <Badge variant="secondary">{LIBRARY_MATERIAL_TIPO_LABELS[material.tipo]}</Badge>
            </TableCell>
            <TableCell className="hidden md:table-cell">
              <div className="flex flex-wrap gap-1">
                {material.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
                {material.tags.length > 3 && (
                  <span className="text-xs text-muted-foreground">+{material.tags.length - 3}</span>
                )}
              </div>
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {material.conteudo !== null ? (
                  <>
                    <NotebookText className="h-3.5 w-3.5" />
                    Escrito
                  </>
                ) : (
                  <>
                    <FileText className="h-3.5 w-3.5" />
                    Arquivo
                  </>
                )}
              </span>
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {material.conteudo !== null && (
                    <DropdownMenuItem asChild>
                      <a href={`/biblioteca/${material.id}/pdf`} target="_blank" rel="noopener noreferrer">
                        <Eye className="h-4 w-4" />
                        Visualizar
                      </a>
                    </DropdownMenuItem>
                  )}
                  {material.arquivo_path && (
                    <DropdownMenuItem onClick={() => handleAbrirArquivo(material.arquivo_path!)}>
                      <FileText className="h-4 w-4" />
                      Abrir arquivo
                    </DropdownMenuItem>
                  )}
                  <LibraryMaterialFormDialog
                    material={material}
                    trigger={
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Pencil className="h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                    }
                  />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => handleDelete(material.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
