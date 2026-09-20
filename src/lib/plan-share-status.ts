import type { PlanShareToken } from "@/lib/types/database.types";

export interface PlanShareLinkStatus {
  label: "Ativo" | "Revogado" | "Expirado";
  tone: "success" | "warning" | "outline";
}

/** Status de um link de compartilhamento de plano — extraído de share-plan-dialog.tsx pra ser reusado pela Central de Envio (Fase 8, Bloco B), em vez de reimplementar a mesma checagem. */
export function planShareLinkStatus(link: PlanShareToken): PlanShareLinkStatus {
  if (link.revoked_at) return { label: "Revogado", tone: "outline" };
  if (new Date(link.expires_at) <= new Date()) return { label: "Expirado", tone: "outline" };
  return { label: "Ativo", tone: "success" };
}

/** O link ativo de um plano (não revogado, não expirado), se houver — mais recente primeiro. */
export function findActivePlanShareLink(links: PlanShareToken[]): PlanShareToken | null {
  return links.find((link) => planShareLinkStatus(link).label === "Ativo") ?? null;
}

/**
 * URL final pra colar na mensagem — usa NEXT_PUBLIC_SITE_URL (nunca
 * `window.location.origin`, pra não depender do navegador em componentes
 * que renderizam fora de um diálogo lazy).
 */
export function planShareDisplayUrl(link: PlanShareToken): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return link.token ? `${siteUrl}/compartilhado/${link.token}` : link.signed_url;
}
