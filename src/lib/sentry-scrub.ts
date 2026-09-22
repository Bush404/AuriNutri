// Só tipos; @sentry/core vem junto com o @sentry/nextjs.
import type { Breadcrumb, ErrorEvent, SpanJSON, TransactionEvent } from "@sentry/core";

/**
 * Filtro de privacidade (LGPD) aplicado a TUDO que sai para o Sentry — erros,
 * medições de desempenho (transactions/spans) e o rastro de ações (breadcrumbs).
 * Usado pelos três sentry.*.config.ts. Estratégia: lista do que PODE sair
 * (allowlist), não do que não pode — campo novo que o SDK passe a mandar fica
 * de fora por padrão.
 *
 * Sai: tipo e mensagem do erro (com e-mail/CPF/telefone/valor/ids mascarados),
 * pilha de chamadas (arquivo/linha/função — é código, não dado), método e URL
 * sem query string e sem ids, sistema/navegador/runtime.
 *
 * Não sai: usuário/IP, corpo de requisição, cookies, headers (exceto
 * user-agent), query string, extra/contexto customizado, variáveis locais,
 * saída do console, texto/atributos de elementos clicados.
 *
 * Limite conhecido: um nome próprio escrito solto na mensagem de um erro não é
 * detectável por padrão de texto. Por isso as fontes de texto livre (console,
 * corpo, extra, estado) são descartadas inteiras, em vez de filtradas.
 */

const FILTRADO = "[filtrado]";

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const SHARE_TOKEN = /\/compartilhado\/[^/\s?#"']+/g;
// Query string e fragmento com pares chave=valor (busca por nome, filtros do
// Supabase como ?nome=ilike.*Maria*, tokens de auth no #access_token=...).
const QUERY = /\?[^\s#"']*=[^\s#"']*/g;
const FRAGMENT = /#[^\s"']*=[^\s"']*/g;
const JWT = /eyJ[\w-]+\.[\w-]+\.[\w-]+/g;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const TELEFONE = /\(?\b\d{2}\)?\s?9?\d{4}-?\d{4}\b/g;
const VALOR = /R\$\s?\d[\d.]*(?:,\d{1,2})?/g;

export function scrubUrl(value: string): string {
  return value
    .replace(QUERY, `?${FILTRADO}`)
    .replace(FRAGMENT, `#${FILTRADO}`)
    .replace(SHARE_TOKEN, "/compartilhado/:token")
    .replace(UUID, ":id");
}

export function scrubText(value: string): string {
  return scrubUrl(value)
    .replace(JWT, "[token]")
    .replace(EMAIL, "[email]")
    .replace(CPF, "[cpf]")
    .replace(TELEFONE, "[telefone]")
    .replace(VALOR, "R$ [valor]");
}

const CONTEXTOS_PERMITIDOS = new Set(["trace", "os", "runtime", "browser", "device", "app", "culture", "cloud_resource"]);
const BREADCRUMB_DATA_PERMITIDO = new Set(["method", "status_code", "url", "from", "to"]);

type AnyEvent = ErrorEvent | TransactionEvent;

function scrubCommon<T extends AnyEvent>(event: T): T {
  if (event.message) event.message = scrubText(event.message);
  if (event.logentry) event.logentry = { message: event.logentry.message ? scrubText(event.logentry.message) : undefined };
  if (event.transaction) event.transaction = scrubUrl(event.transaction);

  // Nunca identificar quem usou; ip_address null impede o Sentry de deduzir IP/cidade.
  event.user = { ip_address: null };

  if (event.request) {
    const userAgent = event.request.headers?.["User-Agent"] ?? event.request.headers?.["user-agent"];
    event.request = {
      method: event.request.method,
      url: event.request.url ? scrubUrl(event.request.url) : undefined,
      headers: userAgent ? { "User-Agent": userAgent } : undefined,
    };
  }

  delete event.extra;

  if (event.contexts) {
    for (const key of Object.keys(event.contexts)) {
      if (!CONTEXTOS_PERMITIDOS.has(key)) delete event.contexts[key];
    }
  }

  if (event.tags) {
    for (const [key, value] of Object.entries(event.tags)) {
      if (typeof value === "string") event.tags[key] = scrubText(value);
    }
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb).filter((b): b is Breadcrumb => b !== null);
  }

  return event;
}

export function scrubErrorEvent(event: ErrorEvent): ErrorEvent {
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = scrubText(exception.value);
    for (const frame of exception.stacktrace?.frames ?? []) {
      delete frame.vars;
    }
  }
  return scrubCommon(event);
}

export function scrubTransactionEvent(event: TransactionEvent): TransactionEvent {
  if (event.spans) event.spans = event.spans.map(scrubSpan);
  return scrubCommon(event);
}

export function scrubSpan(span: SpanJSON): SpanJSON {
  if (span.description) span.description = scrubText(span.description);
  if (span.data) {
    for (const [key, value] of Object.entries(span.data)) {
      if (/body|query|cookie|header|statement|args|params/i.test(key)) {
        delete span.data[key];
      } else if (typeof value === "string") {
        span.data[key] = scrubText(value);
      }
    }
  }
  return span;
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  // Saída do console pode conter qualquer coisa (inclusive objetos de paciente).
  if (breadcrumb.category === "console") return null;

  const scrubbed: Breadcrumb = {
    type: breadcrumb.type,
    category: breadcrumb.category,
    level: breadcrumb.level,
    timestamp: breadcrumb.timestamp,
  };

  if (breadcrumb.message) {
    // Cliques (ui.*) vêm como seletor CSS; atributos entre [] podem trazer texto da tela.
    const message = breadcrumb.category?.startsWith("ui.")
      ? breadcrumb.message.replace(/\[[^\]]*\]/g, "")
      : breadcrumb.message;
    scrubbed.message = scrubText(message);
  }

  if (breadcrumb.data) {
    scrubbed.data = {};
    for (const [key, value] of Object.entries(breadcrumb.data)) {
      if (!BREADCRUMB_DATA_PERMITIDO.has(key)) continue;
      scrubbed.data[key] = typeof value === "string" ? scrubText(value) : value;
    }
  }

  return scrubbed;
}

/** Opções comuns aos três runtimes — espalhar dentro de cada Sentry.init(). */
export const sentryPrivacyOptions = {
  sendDefaultPii: false,
  dataCollection: {
    userInfo: false,
    httpBodies: [] as [],
  },
  beforeSend: scrubErrorEvent,
  beforeSendTransaction: scrubTransactionEvent,
  beforeSendSpan: scrubSpan,
  beforeBreadcrumb: scrubBreadcrumb,
};
