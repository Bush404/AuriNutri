import { defineConfig, devices } from "@playwright/test";

// Testes E2E dos fluxos críticos. Rodam contra o projeto Supabase do .env.local,
// com uma conta descartável criada em global-setup e removida em global-teardown
// (exige SUPABASE_SERVICE_ROLE_KEY temporário no .env.local — ver e2e/README.md).
// Arquivos *.e2e.ts, para o Vitest (npm test) não tentar executá-los.
const PORT = 3100;

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
    baseURL: `http://localhost:${PORT}`,
    locale: "pt-BR",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
