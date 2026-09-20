"use server";

import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { generateAntropometriaPdf } from "@/lib/pdf/generate-antropometria-pdf";
import { generateReceitaPdf } from "@/lib/pdf/generate-receita-pdf";
import type { ActionResult } from "@/lib/actions/patients";
import type { DocumentShareTipo, DocumentShareToken } from "@/lib/types/database.types";

const BUCKET = "documentos";
const EXPIRES_IN_SECONDS = 90 * 24 * 60 * 60; // 90 dias, mesmo prazo do link do plano.
const ARQUIVO_MAX_BYTES = 10 * 1024 * 1024; // 10MB, mesmo limite já usado para anexos de exame.

export interface CreateDocumentShareLinkResult extends ActionResult {
  url?: string;
  expiresAt?: string;
  titulo?: string;
}

async function findActiveToken(
  supabase: ReturnType<typeof createClient>,
  tipo: DocumentShareTipo,
  referenciaId: string
): Promise<DocumentShareToken | null> {
  const { data } = await supabase
    .from("document_share_tokens")
    .select("*")
    .eq("tipo", tipo)
    .eq("referencia_id", referenciaId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .returns<DocumentShareToken[]>();

  return data?.[0] ?? null;
}

async function insertToken(
  supabase: ReturnType<typeof createClient>,
  input: {
    userId: string;
    patientId: string;
    tipo: DocumentShareTipo;
    referenciaId: string | null;
    titulo: string;
    storagePath: string;
    signedUrl: string;
  }
): Promise<CreateDocumentShareLinkResult> {
  const token = randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + EXPIRES_IN_SECONDS * 1000).toISOString();

  const { error } = await supabase.from("document_share_tokens").insert({
    user_id: input.userId,
    patient_id: input.patientId,
    tipo: input.tipo,
    referencia_id: input.referenciaId,
    titulo: input.titulo,
    token,
    storage_path: input.storagePath,
    signed_url: input.signedUrl,
    expires_at: expiresAt,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return { success: true, url: `${siteUrl}/compartilhado/${token}`, expiresAt, titulo: input.titulo };
}

function tokenToResult(token: DocumentShareToken): CreateDocumentShareLinkResult {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return {
    success: true,
    url: `${siteUrl}/compartilhado/${token.token}`,
    expiresAt: token.expires_at,
    titulo: token.titulo,
  };
}

/**
 * PDF com todas as avaliações antropométricas do paciente ("Evolução
 * física" na Central de Envio). Reaproveita um link ainda válido em vez de
 * gerar um novo a cada clique — mesmo espírito do link do plano, mas sem a
 * etapa de revogação manual (não há tela própria de gerenciar esses links).
 */
export async function createAntropometriaShareLink(patientId: string): Promise<CreateDocumentShareLinkResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  const existente = await findActiveToken(supabase, "antropometria", patientId);
  if (existente) return tokenToResult(existente);

  const generated = await generateAntropometriaPdf(supabase, user, patientId);
  if (!generated) {
    return { success: false, message: "Nenhuma avaliação antropométrica registrada para este paciente ainda." };
  }

  const storagePath = `${user.id}/antropometria/${patientId}.pdf`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, generated.buffer, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (uploadError) {
    return { success: false, message: uploadError.message };
  }

  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, EXPIRES_IN_SECONDS);
  if (signedUrlError || !signedUrlData) {
    return { success: false, message: signedUrlError?.message ?? "Falha ao gerar o link do arquivo." };
  }

  return insertToken(supabase, {
    userId: user.id,
    patientId,
    tipo: "antropometria",
    referenciaId: patientId,
    titulo: generated.filename.replace(/\.pdf$/, ""),
    storagePath,
    signedUrl: signedUrlData.signedUrl,
  });
}

/**
 * PDF de uma receita específica ("Impressos" na Central de Envio) — qualquer
 * receita do profissional, não só as usadas no plano ativo do paciente. A
 * receita em si não tem conteúdo específico de paciente, então o mesmo link
 * é reaproveitado independente de para qual paciente foi gerado antes.
 */
export async function createReceitaShareLink(recipeId: string, patientId: string): Promise<CreateDocumentShareLinkResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  const existente = await findActiveToken(supabase, "receita", recipeId);
  if (existente) return tokenToResult(existente);

  const generated = await generateReceitaPdf(supabase, user, recipeId);
  if (!generated) {
    return { success: false, message: "Receita não encontrada ou ainda em rascunho (sem rendimento/porções definidos)." };
  }

  const storagePath = `${user.id}/receitas/${recipeId}.pdf`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, generated.buffer, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (uploadError) {
    return { success: false, message: uploadError.message };
  }

  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, EXPIRES_IN_SECONDS);
  if (signedUrlError || !signedUrlData) {
    return { success: false, message: signedUrlError?.message ?? "Falha ao gerar o link do arquivo." };
  }

  return insertToken(supabase, {
    userId: user.id,
    patientId,
    tipo: "receita",
    referenciaId: recipeId,
    titulo: generated.nome,
    storagePath,
    signedUrl: signedUrlData.signedUrl,
  });
}

/**
 * Sobe um PDF avulso do computador do profissional ("Impressos" →
 * "outros arquivos") e gera um link de compartilhamento — sempre um link
 * novo (cada upload é um arquivo distinto, sem recurso de origem pra
 * reaproveitar).
 */
export async function createArquivoShareLink(patientId: string, formData: FormData): Promise<CreateDocumentShareLinkResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, message: "Nenhum arquivo enviado." };
  }
  if (file.type !== "application/pdf") {
    return { success: false, message: "Só é possível enviar arquivos em PDF." };
  }
  if (file.size > ARQUIVO_MAX_BYTES) {
    return { success: false, message: "Arquivo muito grande. O limite é 10MB." };
  }

  const titulo = file.name.replace(/\.pdf$/i, "") || "Documento";
  const storagePath = `${user.id}/arquivos/${randomUUID()}.pdf`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    contentType: "application/pdf",
  });
  if (uploadError) {
    return { success: false, message: uploadError.message };
  }

  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, EXPIRES_IN_SECONDS);
  if (signedUrlError || !signedUrlData) {
    return { success: false, message: signedUrlError?.message ?? "Falha ao gerar o link do arquivo." };
  }

  return insertToken(supabase, {
    userId: user.id,
    patientId,
    tipo: "arquivo",
    referenciaId: null,
    titulo,
    storagePath,
    signedUrl: signedUrlData.signedUrl,
  });
}
