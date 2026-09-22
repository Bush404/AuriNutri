import { withSentryConfig } from "@sentry/nextjs/config";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Necessário no Next.js 14 para carregar instrumentation.ts (Sentry no servidor).
    instrumentationHook: true,
    // O pdfkit (usado pelo @react-pdf) carrega as fontes padrão (Helvetica etc.)
    // por um caminho montado em tempo de execução, que o rastreamento de
    // arquivos do Next não enxerga — sem isto, as fontes ficam fora da função
    // do Netlify e toda página/rota que gera PDF derruba a função
    // ("Cannot find module .../pdfkit/js/standard-fonts/Helvetica.cjs").
    outputFileTracingIncludes: {
      "/**/*": ["./node_modules/pdfkit/js/**/*"],
    },
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
