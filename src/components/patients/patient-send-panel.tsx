"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  Activity,
  BookOpen,
  FileText,
  Loader2,
  MessageCircle,
  Paperclip,
  Receipt,
  RotateCcw,
  Salad,
  Search,
  Send,
  Share2,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import type { LibraryMaterial, PlanShareToken, Recipe } from "@/lib/types/database.types";
import type { SendCenterAssessment, SendCenterContext, SendCenterPayment } from "@/lib/actions/patient-send";
import { createPlanShareLink } from "@/lib/actions/plan-share";
import {
  createAntropometriaShareLink,
  createArquivoShareLink,
  createReceitaShareLink,
  createReciboShareLink,
  createMaterialShareLink,
} from "@/lib/actions/document-share";
import { searchRecipesForPicker } from "@/lib/actions/recipes";
import { searchLibraryMaterialsForPicker, listLibraryMaterialTags } from "@/lib/actions/library-materials";
import { findActivePlanShareLink, planShareDisplayUrl } from "@/lib/plan-share-status";
import { normalizePhoneToWhatsApp, buildWhatsAppUrl } from "@/lib/whatsapp";
import { buildMensagemCombinada, primeiroNomeDe } from "@/lib/whatsapp-templates";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";

interface PatientSendPanelProps {
  patientId: string;
  patientNome: string;
  patientTelefone: string | null;
  context: SendCenterContext;
}

const SEND_ITEMS = [
  { id: "plano", label: "Plano Alimentar" },
  { id: "avaliacao", label: "Avaliação Antropométrica" },
  { id: "impressos", label: "Impressos" },
  { id: "recibo", label: "Recibo de pagamento" },
  { id: "material", label: "Material da biblioteca" },
  { id: "consulta", label: "Lembrete de consulta" },
  { id: "mensagem", label: "Mensagem livre" },
] as const;

type SendItemId = (typeof SEND_ITEMS)[number]["id"];

/** Mantém uma callback sempre atualizada sem precisar entrar como dependência do efeito que a usa — evita loop de re-render quando o componente pai passa uma função nova a cada render. */
function useEventCallback<T extends (...args: never[]) => void>(fn: T): T {
  const ref = useRef(fn);
  ref.current = fn;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- por design: ref.current sempre atualizado acima, a wrapper nunca precisa mudar de identidade.
  return useCallback(((...args: Parameters<T>) => ref.current(...args)) as T, []);
}

interface ImpressoPronto {
  chave: string;
  titulo: string;
  link: string;
}

export function PatientSendPanel({ patientId, patientNome, patientTelefone, context }: PatientSendPanelProps) {
  const primeiroNome = primeiroNomeDe(patientNome);
  const telefone = normalizePhoneToWhatsApp(patientTelefone);
  const [selecionados, setSelecionados] = useState<Set<SendItemId>>(new Set());

  const [planoInfo, setPlanoInfo] = useState<{ nome: string; link: string } | null>(null);
  const [avaliacaoInfo, setAvaliacaoInfo] = useState<{ dataFormatada: string; link: string } | null>(null);
  const [impressosProntos, setImpressosProntos] = useState<ImpressoPronto[]>([]);
  const [reciboInfo, setReciboInfo] = useState<{ descricao: string; link: string } | null>(null);
  const [materialInfo, setMaterialInfo] = useState<{ titulo: string; link: string } | null>(null);
  const [mensagemLivreTexto, setMensagemLivreTexto] = useState("");
  const [mensagemManual, setMensagemManual] = useState<string | null>(null);

  function toggle(id: SendItemId, checked: boolean) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const mensagemAuto = buildMensagemCombinada({
    primeiroNome,
    nomeProfissional: context.profissionalNome,
    plano: selecionados.has("plano") ? planoInfo : null,
    avaliacao: selecionados.has("avaliacao") ? avaliacaoInfo : null,
    impressos: selecionados.has("impressos") ? impressosProntos.map((i) => ({ titulo: i.titulo, link: i.link })) : [],
    consulta: selecionados.has("consulta") ? context.proximaConsulta : null,
    recibo: selecionados.has("recibo") ? reciboInfo : null,
    material: selecionados.has("material") ? materialInfo : null,
    mensagemLivre: selecionados.has("mensagem") ? mensagemLivreTexto : "",
  });
  const mensagemFinal = mensagemManual ?? mensagemAuto;

  return (
    <div className="space-y-6">
      {!telefone && (
        <div className="flex flex-col gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm text-foreground">
              {patientTelefone
                ? "O telefone cadastrado deste paciente não parece válido para WhatsApp."
                : "Este paciente ainda não tem telefone cadastrado."}{" "}
              Os envios abaixo ficam indisponíveis até corrigir o cadastro.
            </p>
          </div>
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link href={`/pacientes/${patientId}/editar`}>Editar cadastro</Link>
          </Button>
        </div>
      )}

      <div className="rounded-md border border-border p-4">
        <p className="mb-3 text-sm font-medium text-foreground">O que você quer enviar?</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SEND_ITEMS.map((item) => (
            <label key={item.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={selecionados.has(item.id)}
                onCheckedChange={(checked) => toggle(item.id, checked === true)}
              />
              {item.label}
            </label>
          ))}
        </div>
      </div>

      {selecionados.size === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Marque acima o que você quer enviar para {primeiroNome}.
        </p>
      )}

      {selecionados.has("plano") && (
        <PlanoCard
          planoAtivo={context.planoAtivo}
          shareLinks={context.planoShareLinks}
          onLinkReady={setPlanoInfo}
        />
      )}

      {selecionados.has("avaliacao") && (
        <AvaliacaoAntropometricaCard
          patientId={patientId}
          avaliacoes={context.avaliacoes}
          onLinkReady={setAvaliacaoInfo}
        />
      )}

      {selecionados.has("impressos") && (
        <ImpressosSection patientId={patientId} onItensChange={setImpressosProntos} />
      )}

      {selecionados.has("recibo") && (
        <ReciboCard patientId={patientId} pagamentos={context.pagamentosRecebidos} onLinkReady={setReciboInfo} />
      )}

      {selecionados.has("material") && (
        <MaterialBibliotecaCard patientId={patientId} onLinkReady={setMaterialInfo} />
      )}

      {selecionados.has("consulta") && <ConsultaCard proximaConsulta={context.proximaConsulta} />}

      {selecionados.has("mensagem") && (
        <MensagemLivreCard texto={mensagemLivreTexto} onChange={setMensagemLivreTexto} />
      )}

      {selecionados.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="h-4 w-4" />
              Mensagem para enviar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={mensagemFinal}
              onChange={(e) => setMensagemManual(e.target.value)}
              rows={8}
              className="text-sm"
            />
            {mensagemManual !== null && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setMensagemManual(null)}>
                <RotateCcw className="h-3.5 w-3.5" />
                Recompor mensagem automaticamente
              </Button>
            )}
            <Button asChild disabled={!telefone} className="w-full sm:w-auto">
              <a
                href={telefone ? buildWhatsAppUrl(telefone, mensagemFinal) : undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!telefone}
                onClick={(e) => {
                  if (!telefone) e.preventDefault();
                }}
              >
                <MessageCircle className="h-4 w-4" />
                Enviar por WhatsApp
              </a>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PlanoCard({
  planoAtivo,
  shareLinks,
  onLinkReady,
}: {
  planoAtivo: { id: string; nome: string } | null;
  shareLinks: PlanShareToken[];
  onLinkReady: (info: { nome: string; link: string } | null) => void;
}) {
  const [links, setLinks] = useState(shareLinks);
  const [isPending, startTransition] = useTransition();
  const linkAtivo = findActivePlanShareLink(links);

  const stableOnLinkReady = useEventCallback(onLinkReady);
  useEffect(() => {
    stableOnLinkReady(
      planoAtivo && linkAtivo ? { nome: planoAtivo.nome, link: planShareDisplayUrl(linkAtivo) } : null
    );
  }, [planoAtivo, linkAtivo, stableOnLinkReady]);

  function handleGerarLink() {
    if (!planoAtivo) return;
    startTransition(async () => {
      const result = await createPlanShareLink(planoAtivo.id);
      if (!result.success || !result.url || !result.expiresAt) {
        toast.error("Não foi possível gerar o link", { description: result.message });
        return;
      }
      setLinks((prev) => [
        {
          id: crypto.randomUUID(),
          meal_plan_id: planoAtivo.id,
          user_id: "",
          token: result.url!.split("/compartilhado/")[1] ?? "",
          storage_path: "",
          signed_url: result.url!,
          expires_at: result.expiresAt!,
          revoked_at: null,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      toast.success("Link gerado — válido por 90 dias.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Share2 className="h-4 w-4" />
          Plano alimentar ativo
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!planoAtivo ? (
          <EmptyState
            icon={Salad}
            title="Nenhum plano alimentar ativo"
            description="Monte um plano na aba Planos alimentares para poder enviá-lo."
          />
        ) : !linkAtivo ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Plano <span className="font-medium text-foreground">&quot;{planoAtivo.nome}&quot;</span> — ainda não
              tem um link de compartilhamento ativo.
            </p>
            <Button type="button" variant="outline" onClick={handleGerarLink} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
              Gerar link do plano
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">✓ Link do plano pronto — incluído na mensagem abaixo.</p>
        )}
      </CardContent>
    </Card>
  );
}

function AvaliacaoAntropometricaCard({
  patientId,
  avaliacoes,
  onLinkReady,
}: {
  patientId: string;
  avaliacoes: SendCenterAssessment[];
  onLinkReady: (info: { dataFormatada: string; link: string } | null) => void;
}) {
  const [selecionadaId, setSelecionadaId] = useState<string | null>(avaliacoes[0]?.id ?? null);
  const [link, setLink] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selecionada = avaliacoes.find((a) => a.id === selecionadaId) ?? null;

  const stableOnLinkReady = useEventCallback(onLinkReady);
  useEffect(() => {
    stableOnLinkReady(link && selecionada ? { dataFormatada: selecionada.dataFormatada, link } : null);
  }, [link, selecionada, stableOnLinkReady]);

  function handleSelecionar(id: string) {
    setSelecionadaId(id);
    setLink(null);
  }

  function handleGerarLink() {
    if (!selecionadaId) return;
    startTransition(async () => {
      const result = await createAntropometriaShareLink(patientId, selecionadaId);
      if (!result.success || !result.url) {
        toast.error("Não foi possível gerar o link", { description: result.message });
        return;
      }
      setLink(result.url);
      toast.success("Link gerado — válido por 90 dias.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4" />
          Avaliação antropométrica
        </CardTitle>
      </CardHeader>
      <CardContent>
        {avaliacoes.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="Nenhuma avaliação registrada"
            description="Registre uma avaliação antropométrica na aba Antropometria Geral para poder enviá-la."
          />
        ) : (
          <div className="space-y-3">
            <Select value={selecionadaId ?? undefined} onValueChange={handleSelecionar}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder="Escolha a data da avaliação" />
              </SelectTrigger>
              <SelectContent>
                {avaliacoes.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.dataFormatada}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {!link ? (
              <Button type="button" variant="outline" onClick={handleGerarLink} disabled={isPending || !selecionadaId}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                Gerar PDF e link
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">✓ Link pronto — incluído na mensagem abaixo.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReciboCard({
  patientId,
  pagamentos,
  onLinkReady,
}: {
  patientId: string;
  pagamentos: SendCenterPayment[];
  onLinkReady: (info: { descricao: string; link: string } | null) => void;
}) {
  const [selecionadoId, setSelecionadoId] = useState<string | null>(pagamentos[0]?.id ?? null);
  const [link, setLink] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selecionado = pagamentos.find((p) => p.id === selecionadoId) ?? null;

  const stableOnLinkReady = useEventCallback(onLinkReady);
  useEffect(() => {
    stableOnLinkReady(link && selecionado ? { descricao: selecionado.descricao, link } : null);
  }, [link, selecionado, stableOnLinkReady]);

  function handleSelecionar(id: string) {
    setSelecionadoId(id);
    setLink(null);
  }

  function handleGerarLink() {
    if (!selecionadoId) return;
    startTransition(async () => {
      const result = await createReciboShareLink(selecionadoId, patientId);
      if (!result.success || !result.url) {
        toast.error("Não foi possível gerar o recibo", { description: result.message });
        return;
      }
      setLink(result.url);
      toast.success("Recibo gerado — link válido por 90 dias.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Receipt className="h-4 w-4" />
          Recibo de pagamento
        </CardTitle>
      </CardHeader>
      <CardContent>
        {pagamentos.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Nenhum pagamento recebido ainda"
            description="Registre uma cobrança e marque um pagamento como recebido na aba Financeiro para poder gerar o recibo."
          />
        ) : (
          <div className="space-y-3">
            <Select value={selecionadoId ?? undefined} onValueChange={handleSelecionar}>
              <SelectTrigger className="w-full sm:w-80">
                <SelectValue placeholder="Escolha o pagamento" />
              </SelectTrigger>
              <SelectContent>
                {pagamentos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.descricao} — {p.valorFormatado} ({p.dataFormatada})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {!link ? (
              <Button type="button" variant="outline" onClick={handleGerarLink} disabled={isPending || !selecionadoId}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                Gerar recibo e link
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">✓ Recibo pronto — incluído na mensagem abaixo.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MaterialBibliotecaCard({
  patientId,
  onLinkReady,
}: {
  patientId: string;
  onLinkReady: (info: { titulo: string; link: string } | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [tagFiltro, setTagFiltro] = useState("todas");
  const [tagsDisponiveis, setTagsDisponiveis] = useState<string[]>([]);
  const [resultados, setResultados] = useState<LibraryMaterial[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [selecionado, setSelecionado] = useState<LibraryMaterial | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const buscaTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stableOnLinkReady = useEventCallback(onLinkReady);
  useEffect(() => {
    stableOnLinkReady(link && selecionado ? { titulo: selecionado.titulo, link } : null);
  }, [link, selecionado, stableOnLinkReady]);

  useEffect(() => {
    listLibraryMaterialTags().then(setTagsDisponiveis);
  }, []);

  async function runSearch(value: string, tag: string) {
    setBuscando(true);
    const data = await searchLibraryMaterialsForPicker(value, tag === "todas" ? undefined : tag);
    setResultados(data);
    setBuscando(false);
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    setSelecionado(null);
    setLink(null);
    if (buscaTimeout.current) clearTimeout(buscaTimeout.current);
    buscaTimeout.current = setTimeout(() => runSearch(value, tagFiltro), 300);
  }

  function handleTagChange(tag: string) {
    setTagFiltro(tag);
    setSelecionado(null);
    setLink(null);
    runSearch(query, tag);
  }

  function handleSelecionar(material: LibraryMaterial) {
    setSelecionado(material);
    setLink(null);
    setResultados([]);
    setQuery(material.titulo);
  }

  function handleGerarLink() {
    if (!selecionado) return;
    startTransition(async () => {
      const result = await createMaterialShareLink(selecionado.id, patientId);
      if (!result.success || !result.url) {
        toast.error("Não foi possível gerar o link", { description: result.message });
        return;
      }
      setLink(result.url);
      toast.success("Link gerado — válido por 90 dias.");
    });
  }

  const temFiltroAtivo = Boolean(query) || tagFiltro !== "todas";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="h-4 w-4" />
          Material da biblioteca
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Buscar material pelo nome..."
              className="pl-8"
            />
          </div>
          <Select value={tagFiltro} onValueChange={handleTagChange}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filtrar por tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as tags</SelectItem>
              {tagsDisponiveis.map((tag) => (
                <SelectItem key={tag} value={tag}>
                  {tag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {buscando && <p className="text-xs text-muted-foreground">Buscando...</p>}
        {!buscando && resultados.length > 0 && (
          <div className="space-y-1 rounded-md border border-border p-2">
            {resultados.map((material) => (
              <button
                key={material.id}
                type="button"
                onClick={() => handleSelecionar(material)}
                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                {material.titulo}
                <span className="text-xs text-muted-foreground">Selecionar</span>
              </button>
            ))}
          </div>
        )}

        {!buscando && temFiltroAtivo && resultados.length === 0 && !selecionado && (
          <EmptyState
            icon={BookOpen}
            title="Nenhum material encontrado"
            description="Cadastre materiais de orientação na página Biblioteca para poder enviá-los."
          />
        )}

        {selecionado && !link && (
          <Button type="button" variant="outline" onClick={handleGerarLink} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
            Gerar PDF e link
          </Button>
        )}
        {selecionado && link && (
          <p className="text-sm text-muted-foreground">✓ Link pronto — incluído na mensagem abaixo.</p>
        )}
      </CardContent>
    </Card>
  );
}

interface ImpressoItem {
  key: string;
  tipo: "receita" | "arquivo";
  titulo: string;
  recipeId?: string;
  file?: File;
  status: "idle" | "gerando" | "pronto" | "erro";
  url?: string;
  erro?: string;
}

const ARQUIVO_MAX_BYTES = 10 * 1024 * 1024;

function ImpressosSection({
  patientId,
  onItensChange,
}: {
  patientId: string;
  onItensChange: (itens: ImpressoPronto[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<Recipe[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [itens, setItens] = useState<ImpressoItem[]>([]);
  const buscaTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stableOnItensChange = useEventCallback(onItensChange);
  useEffect(() => {
    stableOnItensChange(
      itens
        .filter((i): i is ImpressoItem & { url: string } => i.status === "pronto" && !!i.url)
        .map((i) => ({ chave: i.key, titulo: i.titulo, link: i.url }))
    );
  }, [itens, stableOnItensChange]);

  function handleQueryChange(value: string) {
    setQuery(value);
    if (buscaTimeout.current) clearTimeout(buscaTimeout.current);
    buscaTimeout.current = setTimeout(async () => {
      setBuscando(true);
      const data = await searchRecipesForPicker(value);
      setResultados(data);
      setBuscando(false);
    }, 300);
  }

  function adicionarReceita(receita: Recipe) {
    if (itens.some((i) => i.tipo === "receita" && i.recipeId === receita.id)) return;
    setItens((prev) => [
      ...prev,
      { key: crypto.randomUUID(), tipo: "receita", titulo: receita.nome, recipeId: receita.id, status: "idle" },
    ]);
  }

  function handleArquivosSelecionados(files: FileList | null) {
    if (!files) return;
    const novos: ImpressoItem[] = [];
    for (const file of Array.from(files)) {
      if (file.type !== "application/pdf") {
        toast.error(`"${file.name}" não é um PDF.`);
        continue;
      }
      if (file.size > ARQUIVO_MAX_BYTES) {
        toast.error(`"${file.name}" é maior que 10MB.`);
        continue;
      }
      novos.push({
        key: crypto.randomUUID(),
        tipo: "arquivo",
        titulo: file.name.replace(/\.pdf$/i, ""),
        file,
        status: "idle",
      });
    }
    setItens((prev) => [...prev, ...novos]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removerItem(key: string) {
    setItens((prev) => prev.filter((i) => i.key !== key));
  }

  function gerarLink(item: ImpressoItem) {
    setItens((prev) => prev.map((i) => (i.key === item.key ? { ...i, status: "gerando" } : i)));

    (async () => {
      const result =
        item.tipo === "receita"
          ? await createReceitaShareLink(item.recipeId!, patientId)
          : await (async () => {
              const formData = new FormData();
              formData.set("file", item.file!);
              return createArquivoShareLink(patientId, formData);
            })();

      if (!result.success || !result.url) {
        setItens((prev) =>
          prev.map((i) => (i.key === item.key ? { ...i, status: "erro", erro: result.message } : i))
        );
        toast.error("Não foi possível gerar o link", { description: result.message });
        return;
      }

      setItens((prev) => prev.map((i) => (i.key === item.key ? { ...i, status: "pronto", url: result.url } : i)));
      toast.success("Link gerado — válido por 90 dias.");
    })();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" />
          Impressos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Receita (qualquer uma, não só as do plano)</p>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Buscar receita pelo nome..."
              className="pl-8"
            />
          </div>
          {buscando && <p className="text-xs text-muted-foreground">Buscando...</p>}
          {!buscando && resultados.length > 0 && (
            <div className="space-y-1 rounded-md border border-border p-2">
              {resultados.map((receita) => (
                <button
                  key={receita.id}
                  type="button"
                  onClick={() => adicionarReceita(receita)}
                  className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  {receita.nome}
                  <span className="text-xs text-muted-foreground">Adicionar</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Outros arquivos PDF do seu computador</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            multiple
            className="hidden"
            onChange={(e) => handleArquivosSelecionados(e.target.files)}
          />
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Paperclip className="h-4 w-4" />
            Selecionar PDF(s)
          </Button>
        </div>

        {itens.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum item selecionado ainda.</p>
        ) : (
          <div className="space-y-3">
            {itens.map((item) => (
              <div key={item.key} className="rounded-md border border-border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{item.titulo}</p>
                  {item.status !== "gerando" && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removerItem(item.key)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {item.status === "idle" && (
                  <Button type="button" variant="outline" size="sm" onClick={() => gerarLink(item)}>
                    <Share2 className="h-4 w-4" />
                    Gerar PDF e link
                  </Button>
                )}
                {item.status === "gerando" && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Gerando...
                  </p>
                )}
                {item.status === "erro" && <p className="text-sm text-destructive">{item.erro}</p>}
                {item.status === "pronto" && (
                  <p className="text-sm text-muted-foreground">✓ Link pronto — incluído na mensagem abaixo.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ConsultaCard({
  proximaConsulta,
}: {
  proximaConsulta: { dataFormatada: string; horaFormatada: string } | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Send className="h-4 w-4" />
          Lembrete de consulta
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!proximaConsulta ? (
          <p className="text-sm text-muted-foreground">Nenhuma consulta futura agendada para este paciente.</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            ✓ Consulta em {proximaConsulta.dataFormatada} às {proximaConsulta.horaFormatada} — incluída na mensagem
            abaixo.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function MensagemLivreCard({ texto, onChange }: { texto: string; onChange: (value: string) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="h-4 w-4" />
          Mensagem livre
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Textarea
          value={texto}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder="Escreva algo pra incluir na mensagem..."
          className="text-sm"
        />
      </CardContent>
    </Card>
  );
}
