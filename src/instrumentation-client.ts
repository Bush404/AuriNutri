import * as Sentry from "@sentry/nextjs";

import { sentryPrivacyOptions } from "@/lib/sentry-scrub";

// Navegador. No Next.js 16 (Turbopack) este é o único arquivo carregado no
// cliente: o antigo sentry.client.config.ts deixou de funcionar. Fica em src/,
// como todo arquivo especial do Next neste projeto (ver CLAUDE.md).
// Sem Session Replay; todo evento passa pelo filtro de privacidade (LGPD) de
// src/lib/sentry-scrub.ts antes de sair.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  ...sentryPrivacyOptions,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});

// Mede a navegação entre páginas (mesma amostragem de 10%).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
