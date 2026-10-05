"use client";

import { useState, useTransition } from "react";
import {
  ArrowUpDown,
  BarChart3,
  CalendarDays,
  ChevronDown,
  Download,
  Eye,
  FileText,
  FlaskConical,
  ImageIcon,
  Info,
  Loader2,
  MoreHorizontal,
  Paperclip,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { deleteLabExam, getLabExamFileSignedUrl } from "@/lib/actions/lab-exams";
import {
  diasEntre,
  extensaoDoArquivo,
  ordenarExames,
  resumoExames,
  rotuloHaDias,
  TIPO_EXAME_LABEL,
  tipoDoExame,
  type OrdemExames,
} from "@/lib/lab-exams-view";
import { cn, formatDate } from "@/lib/utils";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import { NewLabExamDialog } from "@/components/patients/new-lab-exam-dialog";
import { NewLabExamWithFileDialog } from "@/components/patients/new-lab-exam-with-file-dialog";
import { NewCatalogMarkerDialog } from "@/components/patients/new-catalog-marker-dialog";
import { ExamMarkersDialog, type LabExamWithMarkers } from "@/components/patients/lab-exam-card";
import { LabMarkerEvolutionSection, type MarkerHistoryPoint } from "@/components/patients/lab-marker-evolution-section";

interface LabExamsPanelProps {
  patientId: string;
  exams: LabExamWithMarkers[];
  consentimentoAtivoExames: boolean;
  /** "yyyy-mm-dd" no fuso do Brasil — para o "há N dias". */
  hoje: string;
}

type Filtro = "todos" | "arquivo" | "marcadores";
type Novo = "arquivo" | "marcadores" | "catalogo" | null;

const TH = "h-10 text-xs font-medium uppercase tracking-wide text-muted-foreground";

/**
 * Aba "Exames" (Fase 19, layout de referência de 05/10/2026): uma tabela só
 * com os dois tipos de exame — arquivo do laboratório (PDF/imagem) ou
 * marcadores lançados à mão. O olho abre o arquivo (link temporário, como
 * antes) ou a janela dos marcadores; o gráfico de evolução continua abaixo.
 */
export function LabExamsPanel({ patientId, exams, consentimentoAtivoExames, hoje }: LabExamsPanelProps) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [ordem, setOrdem] = useState<OrdemExames>("recentes");
  const [novo, setNovo] = useState<Novo>(null);
  const [marcadoresDe, setMarcadoresDe] = useState<string | null>(null);

  const resumo = resumoExames(exams);
  const visiveis = ordenarExames(
    exams.filter((e) => (filtro === "todos" ? true : filtro === "arquivo" ? e.arquivo_path : !e.arquivo_path)),
    ordem,
  );
  const exameDosMarcadores = exams.find((e) => e.id === marcadoresDe) ?? null;
  const historico: MarkerHistoryPoint[] = exams
    .filter((e) => !e.arquivo_path)
    .flatMap((exam) => exam.lab_markers.map((marker) => ({ examDataColeta: exam.data_coleta, marker })));

  const FILTROS = [
    { valor: "todos", rotulo: "Todos", n: resumo.total },
    { valor: "arquivo", rotulo: "Com arquivo", n: resumo.comArquivo },
    { valor: "marcadores", rotulo: "Com marcadores", n: resumo.comMarcadores },
  ] as const;

  const fechar = (o: boolean) => !o && setNovo(null);

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Exames</h2>
          <p className="text-sm text-muted-foreground">Organize e acompanhe os exames laboratoriais do paciente.</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="self-start sm:self-auto">
              <Plus className="h-4 w-4" />
              Novo exame
              <ChevronDown className="h-4 w-4 opacity-80" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuItem onSelect={() => setNovo("arquivo")} disabled={!consentimentoAtivoExames}>
              <Paperclip className="h-4 w-4" />
              <div>
                <p>Anexar PDF/imagem</p>
                <p className="text-xs text-muted-foreground">
                  {consentimentoAtivoExames
                    ? "O arquivo que o paciente trouxe do laboratório."
                    : "Registre o consentimento de exames na aba Consentimentos."}
                </p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setNovo("marcadores")}>
              <FlaskConical className="h-4 w-4" />
              <div>
                <p>Preencher marcadores</p>
                <p className="text-xs text-muted-foreground">Resultados digitados, com faixa de referência.</p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Catálogo</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => setNovo("catalogo")}>
              <Plus className="h-4 w-4" />
              Adicionar marcador ao catálogo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <ResumoCard icon={FileText} rotulo="Total de exames" valor={String(resumo.total)}>
          {resumo.total === 0
            ? "nenhum exame ainda"
            : [
                resumo.comArquivo > 0 && `${resumo.comArquivo} com arquivo`,
                resumo.comMarcadores > 0 && `${resumo.comMarcadores} com marcadores`,
              ]
                .filter(Boolean)
                .join(" • ")}
        </ResumoCard>
        <ResumoCard
          icon={CalendarDays}
          rotulo="Mais recente"
          valor={resumo.maisRecente ? formatDate(resumo.maisRecente) : "—"}
        >
          {resumo.maisRecente ? rotuloHaDias(diasEntre(resumo.maisRecente, hoje)) : "nenhuma coleta registrada"}
        </ResumoCard>
        <ResumoCard icon={BarChart3} rotulo="Marcadores registrados" valor={String(resumo.marcadores)}>
          {resumo.marcadores === 0
            ? "nenhum lançado ainda"
            : resumo.foraDaFaixa === 0
              ? "nenhum fora da faixa de referência"
              : `${resumo.foraDaFaixa} fora da faixa de referência`}
        </ResumoCard>
      </div>

      {exams.length === 0 ? (
        <Card>
          <CardContent className="p-4 sm:p-6">
            <EmptyState
              icon={FlaskConical}
              title="Nenhum exame registrado"
              description='Use "Novo exame" para anexar o arquivo do laboratório ou lançar os marcadores.'
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar exames">
              {FILTROS.map((f) => {
                const ativo = filtro === f.valor;
                return (
                  <button
                    key={f.valor}
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => setFiltro(f.valor)}
                    className={cn(
                      "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      ativo ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted",
                    )}
                  >
                    {f.rotulo} ({f.n})
                  </button>
                );
              })}
            </div>
            <Select value={ordem} onValueChange={(v) => setOrdem(v as OrdemExames)}>
              <SelectTrigger className="h-9 w-full gap-2 bg-card sm:w-44" aria-label="Ordenar exames">
                <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="recentes">Mais recentes</SelectItem>
                <SelectItem value="antigas">Mais antigos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              {visiveis.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhum exame neste filtro.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className={cn(TH, "pl-5")}>Data</TableHead>
                        <TableHead className={TH}>Nome / descrição</TableHead>
                        <TableHead className={cn(TH, "hidden md:table-cell")}>Arquivo</TableHead>
                        <TableHead className={cn(TH, "hidden lg:table-cell")}>Observações</TableHead>
                        <TableHead className={cn(TH, "pr-5 text-right")}>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visiveis.map((exam) => (
                        <ExameLinha
                          key={exam.id}
                          patientId={patientId}
                          exam={exam}
                          onVerMarcadores={() => setMarcadoresDe(exam.id)}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success-soft/40 px-4 py-2.5 text-sm text-muted-foreground">
        <Info className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        O sistema mostra o valor e a faixa de referência — a interpretação clínica é sempre sua.
      </div>

      {historico.length > 0 && <LabMarkerEvolutionSection historico={historico} />}

      {/* Os diálogos de sempre, abertos pelo menu "Novo exame". */}
      <NewLabExamWithFileDialog
        patientId={patientId}
        consentimentoAtivoExames={consentimentoAtivoExames}
        controle={{ open: novo === "arquivo", onOpenChange: fechar }}
      />
      <NewLabExamDialog
        patientId={patientId}
        controle={{ open: novo === "marcadores", onOpenChange: fechar }}
        // Exame de marcadores criado: já abre a janela para lançar os resultados.
        onCreated={(id) => setMarcadoresDe(id)}
      />
      <NewCatalogMarkerDialog controle={{ open: novo === "catalogo", onOpenChange: fechar }} />

      {marcadoresDe && (
        <ExamMarkersDialog
          key={marcadoresDe}
          patientId={patientId}
          // Logo após criar, o exame ainda não chegou da página: mostra a janela quando chegar.
          exam={exameDosMarcadores ?? { ...PLACEHOLDER, id: marcadoresDe }}
          open
          onOpenChange={(o) => !o && setMarcadoresDe(null)}
        />
      )}
    </div>
  );
}

const PLACEHOLDER: LabExamWithMarkers = {
  id: "",
  patient_id: "",
  user_id: "",
  data_coleta: "",
  laboratorio: null,
  arquivo_path: null,
  observacoes: null,
  created_at: "",
  updated_at: "",
  deleted_at: null,
  lab_markers: [],
};

function ResumoCard({
  icon: Icon,
  rotulo,
  valor,
  children,
}: {
  icon: typeof FileText;
  rotulo: string;
  valor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-success-soft text-primary">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{rotulo}</p>
        <p className="text-xl font-bold tabular-nums tracking-tight text-foreground">{valor}</p>
        <p className="text-xs text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}

function ExameLinha({
  patientId,
  exam,
  onVerMarcadores,
}: {
  patientId: string;
  exam: LabExamWithMarkers;
  onVerMarcadores: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [excluindo, setExcluindo] = useState(false);
  const [abrindo, setAbrindo] = useState<"ver" | "baixar" | null>(null);
  const tipo = tipoDoExame(exam);
  const fora = exam.lab_markers.filter((m) => m.fora_da_faixa).length;
  const rotulo = `${TIPO_EXAME_LABEL[tipo]} de ${formatDate(exam.data_coleta)}`;

  /** Link temporário (1 h), gerado a cada clique como antes; "baixar" pede ao navegador para salvar. */
  async function abrirArquivo(acao: "ver" | "baixar") {
    if (!exam.arquivo_path) return;
    setAbrindo(acao);
    // A aba nova abre na hora do clique (antes do await) para o navegador não bloquear como pop-up.
    const aba = acao === "ver" ? window.open("", "_blank") : null;
    const nome = `exame-${exam.data_coleta}.${extensaoDoArquivo(exam.arquivo_path)}`;
    const url = await getLabExamFileSignedUrl(exam.arquivo_path, acao === "baixar" ? nome : undefined);
    setAbrindo(null);
    if (!url) {
      aba?.close();
      toast.error("Não foi possível gerar o link do arquivo.");
      return;
    }
    if (acao === "baixar") {
      window.location.href = url;
    } else if (aba) {
      aba.opener = null;
      aba.location.href = url;
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteLabExam(patientId, exam.id);
      setExcluindo(false);
      if (!result.success) toast.error("Não foi possível excluir o exame", { description: result.message });
      else toast.success("Exame excluído.");
    });
  }

  const iconeBtn = "h-9 w-9 text-muted-foreground hover:text-primary";

  return (
    <TableRow>
      <TableCell className="whitespace-nowrap pl-5 text-sm tabular-nums text-foreground">{formatDate(exam.data_coleta)}</TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">{TIPO_EXAME_LABEL[tipo]}</span>
          <Badge variant={tipo === "marcadores" ? "info" : "success"}>{tipo === "marcadores" ? "Marcadores" : "Arquivo"}</Badge>
        </div>
        {exam.laboratorio && <p className="mt-0.5 text-xs text-muted-foreground">{exam.laboratorio}</p>}
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <span className="inline-flex min-w-[10rem] items-center gap-2 rounded-lg border bg-muted/30 px-3 py-1.5 text-sm">
          {tipo === "pdf" ? (
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          ) : tipo === "imagem" ? (
            <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          ) : (
            <FlaskConical className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          {tipo === "marcadores" ? (
            <span>
              {exam.lab_markers.length} {exam.lab_markers.length === 1 ? "marcador" : "marcadores"}
              {fora > 0 && <span className="text-warning"> · {fora} fora da faixa</span>}
            </span>
          ) : (
            <span>Arquivo {tipo === "pdf" ? "PDF" : "de imagem"}</span>
          )}
        </span>
      </TableCell>
      <TableCell className="hidden max-w-[16rem] text-sm text-muted-foreground lg:table-cell">
        <span className="line-clamp-2">{exam.observacoes || "—"}</span>
      </TableCell>
      <TableCell className="pr-5">
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="outline"
            size="icon"
            className={iconeBtn}
            onClick={() => (tipo === "marcadores" ? onVerMarcadores() : abrirArquivo("ver"))}
            disabled={abrindo !== null}
            aria-label={tipo === "marcadores" ? `Ver marcadores: ${rotulo}` : `Ver arquivo: ${rotulo}`}
            title={tipo === "marcadores" ? "Ver marcadores" : "Ver arquivo"}
          >
            {abrindo === "ver" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
          </Button>
          {tipo !== "marcadores" && (
            <Button
              variant="outline"
              size="icon"
              className={iconeBtn}
              onClick={() => abrirArquivo("baixar")}
              disabled={abrindo !== null}
              aria-label={`Baixar arquivo: ${rotulo}`}
              title="Baixar arquivo"
            >
              {abrindo === "baixar" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className={iconeBtn} aria-label={`Mais ações: ${rotulo}`} title="Mais ações">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {tipo === "marcadores" && (
                <>
                  <DropdownMenuItem onSelect={onVerMarcadores}>
                    <Plus className="h-4 w-4" />
                    Lançar marcadores
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setExcluindo(true)}>
                <Trash2 className="h-4 w-4" />
                Excluir exame
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <AlertDialog open={excluindo} onOpenChange={setExcluindo}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir exame?</AlertDialogTitle>
              <AlertDialogDescription>
                {tipo === "marcadores"
                  ? `Exame de ${formatDate(exam.data_coleta)} e os marcadores lançados nele saem da lista e da evolução.`
                  : `Exame de ${formatDate(exam.data_coleta)}: o arquivo é removido do armazenamento de verdade, não só da lista — não há como recuperar depois.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  );
}
