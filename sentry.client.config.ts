import * as Sentry from "@sentry/nextjs";

// Navegador. (No Next.js 15.3+ o padrão passa a ser instrumentation-client.ts; no 14
// este é o arquivo certo — o aviso de "deprecation" no build pode ser ignorado.)
// Sem Session Replay e sem dados do usuário: o app exibe dados de
// saúde de pacientes (LGPD), então só o erro técnico é enviado ao Sentry.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  dataCollection: {
    userInfo: false,
    httpBodies: [],
  },
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});
