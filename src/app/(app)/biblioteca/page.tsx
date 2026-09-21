import { BookOpen } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import type { LibraryMaterial } from "@/lib/types/database.types";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { LibraryMaterialFilters } from "@/components/library/library-material-filters";
import { LibraryMaterialsTable } from "@/components/library/library-materials-table";
import { LibraryMaterialFormDialog } from "@/components/library/library-material-form-dialog";

const PAGE_SIZE = 20;

interface BibliotecaPageProps {
  searchParams: { busca?: string; tipo?: string; tag?: string; pagina?: string };
}

export default async function BibliotecaPage({ searchParams }: BibliotecaPageProps) {
  const supabase = createClient();
  const busca = searchParams.busca?.trim();
  const tipo = searchParams.tipo;
  const tag = searchParams.tag;
  const page = Math.max(1, Number(searchParams.pagina) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase.from("library_materials").select("*", { count: "exact" });

  if (busca) {
    query = query.ilike("titulo", `%${busca}%`);
  }
  if (tipo) {
    query = query.eq("tipo", tipo);
  }
  if (tag) {
    query = query.contains("tags", [tag]);
  }

  query = query.order("created_at", { ascending: false }).range(from, to);

  const [{ data: materials, count, error }, { data: tagsRows }] = await Promise.all([
    query,
    supabase.from("library_materials").select("tags").returns<{ tags: string[] }[]>(),
  ]);

  const tags = Array.from(new Set((tagsRows ?? []).flatMap((m) => m.tags))).sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );

  const materialsList: LibraryMaterial[] = materials ?? [];
  const semResultados = materialsList.length === 0;
  const temFiltrosAtivos = Boolean(busca || tipo || tag);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Biblioteca</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sua biblioteca pessoal de materiais de orientação e educação — escritos ou enviados,
            prontos para reenviar a qualquer paciente pela Central de Envio.
          </p>
        </div>
        <LibraryMaterialFormDialog />
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <LibraryMaterialFilters tags={tags} />

          {error && <p className="text-sm text-destructive">Erro ao carregar a biblioteca: {error.message}</p>}

          {!error && !semResultados && <LibraryMaterialsTable materials={materialsList} />}

          {!error && semResultados && temFiltrosAtivos && (
            <EmptyState
              icon={BookOpen}
              title="Nenhum material encontrado"
              description="Tente ajustar a busca, o tipo ou a tag selecionada."
            />
          )}

          {!error && semResultados && !temFiltrosAtivos && (
            <EmptyState
              icon={BookOpen}
              title="Sua biblioteca ainda está vazia"
              description="Escreva um material de orientação direto no sistema ou envie um PDF/imagem — depois é só enviar para quantos pacientes precisar pela Central de Envio."
              action={<LibraryMaterialFormDialog />}
            />
          )}

          {!error && !semResultados && (
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              totalCount={count ?? 0}
              basePath="/biblioteca"
              searchParams={{ busca, tipo, tag }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
