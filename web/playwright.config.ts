import { defineConfig, devices } from "@playwright/test";

/**
 * Configuração Playwright para a suite E2E do LogiFlow AO.
 *
 * Corre contra o build de produção servido por `vite preview` (não o
 * servidor de dev), para testar exatamente o que é publicado. O
 * `webServer` abaixo faz `npm run build && npm run preview` automaticamente
 * — não é preciso arrancar nada à mão antes de `npm run test:e2e`.
 *
 * Neste sandbox o Chromium não vem do `npx playwright install` (bloqueado
 * por falta de rede irrestrita); em vez disso aponta-se `executablePath`
 * para o Chromium pré-instalado via a variável de ambiente
 * PLAYWRIGHT_CHROMIUM_PATH. Em CI/máquina normal, remova essa variável e
 * corra `npx playwright install chromium` uma vez — o Playwright usa o
 * seu próprio Chromium gerido.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } }
      : {}),
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1600, height: 1000 } },
    },
  ],
  webServer: {
    command: "npm run build && npm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
