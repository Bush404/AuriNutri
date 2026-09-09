import { BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function FontesDeDadosPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Fontes de Dados</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Transparência sobre a origem dos dados nutricionais utilizados na AuriNutri.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50">
            <BookOpen className="h-5 w-5 text-primary-600" />
          </div>
          <CardTitle className="text-base">Base TACO</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            A AuriNutri disponibiliza, como referência, dados da{" "}
            <strong className="text-foreground">
              Tabela Brasileira de Composição de Alimentos (TACO)
            </strong>
            , elaborada pelo <strong className="text-foreground">NEPA</strong> — Núcleo de Estudos e
            Pesquisas em Alimentação — da{" "}
            <strong className="text-foreground">Universidade Estadual de Campinas (UNICAMP)</strong>,
            referente à 4ª edição ampliada e revisada.
          </p>
          <p>
            Esses dados são reproduzidos com a devida citação de fonte, conforme autorizado pela
            publicação original. A AuriNutri não é afiliada, parceira, patrocinada ou oficialmente
            endossada pela UNICAMP ou pelo NEPA.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alimentos personalizados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Além da base TACO, cada nutricionista pode cadastrar seus próprios alimentos —
            incluindo produtos industrializados, marcas específicas e receitas próprias. Esses
            valores nutricionais são de responsabilidade exclusiva do profissional que os cadastrou
            e não são atribuídos à TACO em nenhuma hipótese.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Uma observação importante</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            A composição nutricional real de um alimento pode variar conforme fatores como marca,
            variedade, safra, região de origem, forma de preparo e condições de armazenamento. Os
            valores apresentados na AuriNutri devem ser interpretados como referência, e o
            julgamento clínico do profissional responsável prevalece sempre.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
