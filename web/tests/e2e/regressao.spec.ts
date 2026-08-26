import { test, expect } from "@playwright/test";

/**
 * Regressão dos módulos construídos em fases anteriores (Scanner, Copilot,
 * Document AI) — não alterados nesta fase, mas sensíveis ao refactor da
 * sidebar/layout e ao code-splitting de rotas.
 */
test.describe("Regressão — módulos existentes", () => {
  test("Scanner regista uma posição manualmente", async ({ page }) => {
    await page.goto("/#/scanner", { waitUntil: "networkidle" });
    await page.getByPlaceholder("Ex.: AO-LUA-WH1-ZA-R04-L02-B12").fill("AO-LUA-WH1-ZA-R04-L02-B01");
    await page.getByRole("button", { name: "Registar" }).click();
    await expect(page.getByText("AO-LUA-WH1-ZA-R04-L02-B01")).toBeVisible();
  });

  test("Copilot responde a uma pergunta sobre rota", async ({ page }) => {
    await page.goto("/#/copilot", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Qual a rota Luanda/ }).click();
    await expect(page.getByText("604 km")).toBeVisible({ timeout: 3000 });
  });

  test("Document AI extrai dados de uma fatura de exemplo", async ({ page }) => {
    await page.goto("/#/document-ai", { waitUntil: "networkidle" });
    await page.getByText("fatura_farmangola_2608.pdf").click();
    await expect(page.getByText("Nº Fatura")).toBeVisible({ timeout: 3000 });
  });
});
