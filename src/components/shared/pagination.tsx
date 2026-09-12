import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

interface PaginationProps {
  page: number;
  pageSize: number;
  totalCount: number;
  basePath: string;
  searchParams: Record<string, string | undefined>;
}

export function Pagination({ page, pageSize, totalCount, basePath, searchParams }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalPages <= 1) return null;

  function hrefForPage(target: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value) params.set(key, value);
    }
    params.set("pagina", String(target));
    return `${basePath}?${params.toString()}`;
  }

  const inicio = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const fim = Math.min(page * pageSize, totalCount);
  const temAnterior = page > 1;
  const temProxima = page < totalPages;

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-border pt-4 sm:flex-row">
      <p className="text-sm text-muted-foreground">
        Mostrando {inicio}–{fim} de {totalCount}
      </p>
      <div className="flex items-center gap-2">
        {temAnterior ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={hrefForPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
        )}
        <span className="px-2 text-sm text-muted-foreground">
          Página {page} de {totalPages}
        </span>
        {temProxima ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={hrefForPage(page + 1)}>
              Próxima
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Próxima
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
