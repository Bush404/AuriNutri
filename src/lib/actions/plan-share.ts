"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generatePlanPdf } from "@/lib/pdf/generate-plan-pdf";
import { rateLimitOrError } from "@/lib/rate-limit";
import type { ActionResult } from "@/lib/actions/patients";
import type { PlanShareToken } from "@/lib/types/database.types";

const BUCKET = "planos";
const EXPIRES_IN_SECONDS = 90 * 24 * 60 * 60; // 90 dias

export interface CreatePlanShareLinkResult extends ActionResult {
  url?: string;
  expiresAt?: string;
}

/**
 * Gera o PDF do plano, salva no Storage privado (pasta do próprio
 * profissional) e cria um link de compartilhamento com token — válido por
 * 90 dias, revogável a qualquer momento. Ver migration 0010 para o desenho
 * completo de segurança (por que isso não precisa de service role em
 * produção e por que a revogação funciona de verdade).
 */
export async function createPlanShareLink(planId: string): Promise<CreatePlanShareLinkResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  const limited = await rateLimitOrError(supabase, "gerar_pdf");
  if (limited) return limited;

  const generated = await generatePlanPdf(supabase, user, planId);
  if (!generated) {
    return { success: false, message: "Plano não encontrado." };
  }

  const storagePath = `${user.id}/${planId}.pdf`;

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

  const token = randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + EXPIRES_IN_SECONDS * 1000).toISOString();

  const { error: insertError } = await supabase.from("plan_share_tokens").insert({
    meal_plan_id: planId,
    user_id: user.id,
    token,
    storage_path: storagePath,
    signed_url: signedUrlData.signedUrl,
    expires_at: expiresAt,
  });

  if (insertError) {
    return { success: false, message: insertError.message };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const url = `${siteUrl}/compartilhado/${token}`;

  revalidatePath(`/planos/${planId}`);
  return { success: true, url, expiresAt, message: "Link de compartilhamento criado." };
}

export async function listPlanShareLinks(planId: string): Promise<PlanShareToken[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("plan_share_tokens")
    .select("*")
    .eq("meal_plan_id", planId)
    .order("created_at", { ascending: false })
    .returns<PlanShareToken[]>();

  return data ?? [];
}

export async function revokePlanShareLink(tokenId: string, planId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("plan_share_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", tokenId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/planos/${planId}`);
  return { success: true, message: "Link revogado." };
}
