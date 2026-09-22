import { withSentryConfig } from "@sentry/nextjs/config";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Necessário no Next.js 14 para carregar instrumentation.ts (Sentry no servidor).
    instrumentationHook: true,
  },
};

export default withSentryConfig(nextConfig, {
  org: "aurinutri",
  project: "aurinutri",

  // Envio dos source maps no build (stack traces legíveis em produção). Sem o
  // token, o build segue normalmente, só sem o envio.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,

  // Encaminha os eventos por /monitoring, para não serem barrados por
  // bloqueadores de anúncio. Excluído do matcher do middleware.ts.
  tunnelRoute: "/monitoring",

  silent: !process.env.CI,
});
