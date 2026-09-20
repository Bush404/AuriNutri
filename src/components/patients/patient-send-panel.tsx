"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  Activity,
  FileText,
  Loader2,
  MessageCircle,
  Paperclip,
  Salad,
  Search,
  Send,
  Share2,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import type { PlanShareToken, Recipe } from "@/lib/types/database.types";
import type { SendCenterContext } from "@/lib/actions/patient-send";
import { createPlanShareLink } from "@/lib/actions/plan-share";
import { createAntropometriaShareLink, createArquivoShareLink, createReceitaShareLink } from "@/lib/actions/document-share";
import { searchRecipesForPicker } from "@/lib/actions/recipes";
import { findActivePlanShareLink, planShareDisplayUrl } from "@/lib/plan-share-status";
import { normalizePhoneToWhatsApp, buildWhatsAppUrl } from "@/lib/whatsapp";
import {
  buildConsultaLembreteWhatsAppMessage,
  buildEvolucaoFisicaWhatsAppMessage,
  buildImpressoWhatsAppMessage,
  buildMensagemLivreWhatsAppTemplate,
  buildPlanoWhatsAppMessage,
  primeiroNomeDe,
} from "@/lib/whatsapp-templates";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";

interface PatientSendPanelProps {
  patientId: string;
  patientNome: string;
  patientTelefone: string | null;
  context: SendCenterContext;
}

const SEND_ITEMS = [
  { id: "plano", label: "Plano Alimentar" },
  { id: "evolucao", label: "Evolução Física" },
  { id: "impressos", label: "Impressos" },
  { id: "consulta", label: "Lembrete de consulta" },
  { id: "mensagem", label: "Mensagem livre" },
] as const;

type SendItemId = (typeof SEND_ITEMS)[number]["id"];

export function PatientSendPanel({ patientId, patientNome, patientTelefone, context }: PatientSendPanelProps) {
  const primeiroNome = primeiroNomeDe(patientNome);
  const telefone = normalizePhoneToWhatsApp(patientTelefone);
  const [selecionados, setSelecionados] = useState<Set<SendItemId>>(new Set());

  function toggle(id: SendItemId, checked: boolean) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

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
          patientId={patientId}
          primeiroNome={primeiroNome}
          profissionalNome={context.profissionalNome}
          telefone={telefone}
          planoAtivo={context.planoAtivo}
          shareLinks={context.planoShareLinks}
        />
      )}

      {selecionados.has("evolucao") && (
        <EvolucaoFisicaCard
          patientId={patientId}
          primeiroNome={primeiroNome}
          profissionalNome={context.profissionalNome}
          telefone={telefone}
          temAvaliacoes={context.temAvaliacoes}
        />
      )}

      {selecionados.has("impressos") && (
        <ImpressosSection
          patientId={patientId}
          primeiroNome={primeiroNome}
          profissionalNome={context.profissionalNome}
          telefone={telefone}
        />
      )}

      {selecionados.has("consulta") && (
        <ConsultaCard
          primeiroNome={primeiroNome}
          profissionalNome={context.profissionalNome}
          telefone={telefone}
          proximaConsulta={context.proximaConsulta}
        />
      )}

      {selecionados.has("mensagem") && (
        <MensagemLivreCard primeiroNome={primeiroNome} profissionalNome={context.profissionalNome} telefone={telefone} />
      )}
    </div>
  );
}

/** Bloco reutilizado por todas as seções: textarea editável (pré-preenchida) e botão de enviar — o título/ícone já vem do Card ao redor. */
function SendCard({ mensagemInicial, telefone }: { mensagemInicial: string; telefone: string | null }) {
  const [mensagem, setMensagem] = useState(mensagemInicial);

  return (
    <div className="space-y-3">
      <Textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={5} className="text-sm" />
      <Button asChild disabled={!telefone} className="w-full sm:w-auto">
        <a
          href={telefone ? buildWhatsAppUrl(telefone, mensagem) : undefined}
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
    </div>
  );
}

function PlanoCard({
  patientId,
  primeiroNome,
  profissionalNome,
  telefone,
  planoAtivo,
  shareLinks,
}: {
  patientId: string;
  primeiroNome: string;
  profissionalNome: string;
  telefone: string | null;
  planoAtivo: { id: string; nome: string } | null;
  shareLinks: PlanShareToken[];
}) {
  const [links, setLinks] = useState(shareLinks);
  const [isPending, startTransition] = useTransition();

  const linkAtivo = findActivePlanShareLink(links);

  function handleGerarLink() {
    if (!planoAtivo) return;
    startTransition(async () => {
      const result = await createPlanShareLink(planoAtivo.id);
      if (!result.success || !result.url || !result.expiresAt) {
        toast.error("Não foi possível gerar o link", { description: result.message });
        return;
      }
      // Atualiza a lista local direto com o retorno da action, sem esperar
      // uma revalidação — createPlanShareLink já retorna tudo que precisa.
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
          <SendCard
            telefone={telefone}
            mensagemInicial={buildPlanoWhatsAppMessage({
              primeiroNome,
              nomeProfissional: profissionalNome,
              nomePlano: planoAtivo.nome,
              link: planShareDisplayUrl(linkAtivo),
            })}
          />
        )}
      </CardContent>
    </Card>
  );
}

function EvolucaoFisicaCard({
  patientId,
  primeiroNome,
  profissionalNome,
  telefone,
  temAvaliacoes,
}: {
  patientId: string;
  primeiroNome: string;
  profissionalNome: string;
  telefone: string | null;
  temAvaliacoes: boolean;
}) {
  const [link, setLink] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleGerarLink() {
    startTransition(async () => {
      const result = await createAntropometriaShareLink(patientId);
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
          Evolução física
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!temAvaliacoes ? (
          <EmptyState
            icon={Activity}
            title="Nenhuma avaliação registrada"
            description="Registre ao menos uma avaliação antropométrica na aba Antropometria Geral para poder enviá-la."
          />
        ) : !link ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Gera um PDF com todas as avaliações antropométricas do paciente até agora.
            </p>
            <Button type="button" variant="outline" onClick={handleGerarLink} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
              Gerar PDF e link
            </Button>
          </div>
        ) : (
          <SendCard
            telefone={telefone}
            mensagemInicial={buildEvolucaoFisicaWhatsAppMessage({ primeiroNome, nomeProfissional: profissionalNome, link })}
          />
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
  primeiroNome,
  profissionalNome,
  telefone,
}: {
  patientId: string;
  primeiroNome: string;
  profissionalNome: string;
  telefone: string | null;
}) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<Recipe[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [itens, setItens] = useState<ImpressoItem[]>([]);
  const buscaTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      setItens((prev) => (prev.map((i) => (i.key === item.key ? { ...i, status: "pronto", url: result.url } : i))));
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
                {item.status === "pronto" && item.url && (
                  <SendCard
                    telefone={telefone}
                    mensagemInicial={buildImpressoWhatsAppMessage({
                      primeiroNome,
                      nomeProfissional: profissionalNome,
                      titulo: item.titulo,
                      link: item.url,
                    })}
                  />
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
  primeiroNome,
  profissionalNome,
  telefone,
  proximaConsulta,
}: {
  primeiroNome: string;
  profissionalNome: string;
  telefone: string | null;
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
          <SendCard
            telefone={telefone}
            mensagemInicial={buildConsultaLembreteWhatsAppMessage({
              primeiroNome,
              nomeProfissional: profissionalNome,
              dataFormatada: proximaConsulta.dataFormatada,
              horaFormatada: proximaConsulta.horaFormatada,
            })}
          />
        )}
      </CardContent>
    </Card>
  );
}

function MensagemLivreCard({
  primeiroNome,
  profissionalNome,
  telefone,
}: {
  primeiroNome: string;
  profissionalNome: string;
  telefone: string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="h-4 w-4" />
          Mensagem livre
        </CardTitle>
      </CardHeader>
      <CardContent>
        <SendCard
          telefone={telefone}
          mensagemInicial={buildMensagemLivreWhatsAppTemplate({ primeiroNome, nomeProfissional: profissionalNome })}
        />
      </CardContent>
    </Card>
  );
}
