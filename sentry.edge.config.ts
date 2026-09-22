import * as Sentry from "@sentry/nextjs";

import { sentryPrivacyOptions } from "./src/lib/sentry-scrub";

// Edge (middleware). Todo evento passa pelo filtro de privacidade (LGPD) de
// src/lib/sentry-scrub.ts antes de sair.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  ...sentryPrivacyOptions,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});
