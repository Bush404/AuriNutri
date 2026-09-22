import * as Sentry from "@sentry/nextjs";

// Edge (middleware). Sem corpo de requisição/dados do
// usuário, para não levar dados de pacientes junto com o erro (LGPD).
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  dataCollection: {
    userInfo: false,
    httpBodies: [],
  },
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});
