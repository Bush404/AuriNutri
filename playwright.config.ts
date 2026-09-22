import { defineConfig, devices } from "@playwright/test";

// Testes E2E dos fluxos críticos. Rodam contra o projeto Supabase do .env.local,
// com uma conta descartável criada em global-setup e removida em global-teardown
// (exige SUPABASE_SERVICE_ROLE_KEY temporário no .env.local — ver e2e/README.md).
// Arquivos *.e2e.ts, para o Vitest (npm test) não tentar executá-los.
//
// Por padrão sobe o `next dev` local. Com E2E_BASE_URL (ex.: o site publicado),
// roda contra esse endereço e não sobe servidor nenhum — ver `npm run test:e2e:prod`.
const PORT = 3100;
const PRODUCAO = "https://aurinutri-app.netlify.app";
// `npm run test:e2e:prod` aponta para o site publicado (npm expõe o nome do script).
if (!process.env.E2E_BASE_URL && process.env.npm_lifecycle_event === "test:e2e:prod") process.env.E2E_BASE_URL = PRODUCAO;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL,
    locale: "pt-BR",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run dev -- -p ${PORT}`,
        url: `http://localhost:${PORT}/login`,
        reuseExistingServer: true,
        timeout: 180_000,
      },
});
