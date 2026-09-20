"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CookingPot, Loader2, MessageCircle, Salad, Send, Share2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import type { PlanShareToken } from "@/lib/types/database.types";
import type { SendCenterContext, SendCenterRecipe } from "@/lib/actions/patient-send";
import { createPlanShareLink } from "@/lib/actions/plan-share";
import { findActivePlanShareLink, planShareDisplayUrl } from "@/lib/plan-share-status";
import { normalizePhoneToWhatsApp, buildWhatsAppUrl } from "@/lib/whatsapp";
import {
  buildConsultaLembreteWhatsAppMessage,
  buildMensagemLivreWhatsAppTemplate,
  buildPlanoWhatsAppMessage,
  buildReceitaWhatsAppMessage,
  primeiroNomeDe,
} from "@/lib/whatsapp-templates";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";

interface PatientSendPanelProps {
  patientId: string;
  patientNome: string;
  patientTelefone: string | null;
  context: SendCenterContext;
}

export function PatientSendPanel({ patientId, patientNome, patientTelefone, context }: PatientSendPanelProps) {
  const primeiroNome = primeiroNomeDe(patientNome);
  const telefone = normalizePhoneToWhatsApp(patientTelefone);

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

      <PlanoCard
        patientId={patientId}
        primeiroNome={primeiroNome}
        profissionalNome={context.profissionalNome}
        telefone={telefone}
        planoAtivo={context.planoAtivo}
        shareLinks={context.planoShareLinks}
      />

      <ReceitasSection
        primeiroNome={primeiroNome}
        profissionalNome={context.profissionalNome}
        telefone={telefone}
        temPlanoAtivo={context.planoAtivo !== null}
        receitas={context.receitasDoPlano}
      />

      <ConsultaCard
        primeiroNome={primeiroNome}
        profissionalNome={context.profissionalNome}
        telefone={telefone}
        proximaConsulta={context.proximaConsulta}
      />

      <MensagemLivreCard primeiroNome={primeiroNome} profissionalNome={context.profissionalNome} telefone={telefone} />
    </div>
  );
}

/** Bloco reutilizado pelas 4 seções: textarea editável (pré-preenchida) e botão de enviar — o título/ícone já vem do Card ao redor. */
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

function ReceitasSection({
  primeiroNome,
  profissionalNome,
  telefone,
  temPlanoAtivo,
  receitas,
}: {
  primeiroNome: string;
  profissionalNome: string;
  telefone: string | null;
  temPlanoAtivo: boolean;
  receitas: SendCenterRecipe[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CookingPot className="h-4 w-4" />
          Receitas do plano
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!temPlanoAtivo ? (
          <p className="text-sm text-muted-foreground">Sem plano alimentar ativo, não há receitas para enviar.</p>
        ) : receitas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            O plano ativo não usa nenhuma receita — só alimentos avulsos.
          </p>
        ) : (
          receitas.map((receita) => (
            <div key={receita.id} className="rounded-md border border-border p-3">
              <p className="mb-2 text-sm font-medium text-foreground">{receita.nome}</p>
              <SendCard
                telefone={telefone}
                mensagemInicial={buildReceitaWhatsAppMessage({ primeiroNome, nomeProfissional: profissionalNome, receita })}
              />
            </div>
          ))
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
