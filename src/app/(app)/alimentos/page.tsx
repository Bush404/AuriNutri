import { ChefHat, Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import type { Food } from "@/lib/types/database.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { FoodFilters } from "@/components/foods/food-filters";
import { FoodsTable } from "@/components/foods/foods-table";
import { FoodFormDialog } from "@/components/foods/food-form-dialog";

const PAGE_SIZE = 20;

interface AlimentosPageProps {
  searchParams: { busca?: string; categoria?: string; ordenar?: string; pagina?: string };
}

// "Meus Alimentos" mostra exclusivamente os alimentos cadastrados pelo
// próprio nutricionista. Os alimentos da base TACO não aparecem aqui — eles
// ficam disponíveis apenas na busca do construtor de plano alimentar.
export default async function AlimentosPage({ searchParams }: AlimentosPageProps) {
  const supabase = createClient();
  const busca = searchParams.busca?.trim();
  const categoria = searchParams.categoria;
  const ordenar = searchParams.ordenar ?? "nome";
  const page = Math.max(1, Number(searchParams.pagina) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase.from("foods").select("*", { count: "exact" }).eq("is_global", false);

  if (busca) {
    query = query.ilike("nome", `%${busca}%`);
  }
  if (categoria) {
    query = query.eq("categoria", categoria);
  }

  const colunaOrdenacao =
    ordenar === "calorias" ? "calorias_kcal" : ordenar === "proteinas" ? "proteinas_g" : "nome";
  query = query
    .order(colunaOrdenacao, {
      ascending: colunaOrdenacao === "nome",
      nullsFirst: false,
    })
    .range(from, to);

  const [{ data: foods, count }, { data: categoriasRows }] = await Promise.all([
    query,
    supabase
      .from("foods")
      .select("categoria")
      .eq("is_global", false)
      .returns<{ categoria: string }[]>(),
  ]);

  const categorias = Array.from(new Set((categoriasRows ?? []).map((c) => c.categoria))).sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );

  const foodsList: Food[] = foods ?? [];

  const semResultados = foodsList.length === 0;
  const temFiltrosAtivos = Boolean(busca || categoria);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Meus Alimentos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Alimentos que você cadastrou manualmente. A base TACO fica disponível diretamente na
            busca ao montar um plano alimentar.
          </p>
        </div>
        <FoodFormDialog
          trigger={
            <Button>
              <Plus className="h-4 w-4" />
              Novo alimento
            </Button>
          }
        />
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <FoodFilters categorias={categorias} />

          {!semResultados ? (
            <FoodsTable foods={foodsList} />
          ) : temFiltrosAtivos ? (
            <EmptyState
              icon={ChefHat}
              title="Nenhum alimento encontrado"
              description="Tente ajustar a busca ou a categoria selecionada."
            />
          ) : (
            <EmptyState
              icon={ChefHat}
              title="Você ainda não cadastrou nenhum alimento"
              description="Cadastre alimentos próprios (receitas, produtos específicos, marcas) para usá-los nos planos alimentares. A base TACO já está disponível separadamente na busca do plano."
              action={<FoodFormDialog trigger={<Button size="sm">Cadastrar alimento</Button>} />}
            />
          )}

          {!semResultados && (
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              totalCount={count ?? 0}
              basePath="/alimentos"
              searchParams={{ busca, categoria, ordenar: searchParams.ordenar }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
