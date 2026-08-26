import { test, expect } from "@playwright/test";

test.describe("Navegação e Dashboard", () => {
  test("barra lateral tem os 7 módulos e o dashboard carrega KPIs", async ({ page }) => {
    await page.goto("/#/", { waitUntil: "networkidle" });
    await expect(page.locator("nav a")).toHaveCount(7);
    await expect(page.getByText("Faturação do Mês (AOA)")).toBeVisible();
    await expect(page.getByText("Faturação do Mês (USD)")).toBeVisible();
  });

  test("filtro Aéreo/Terrestre altera as linhas da tabela de envios", async ({ page }) => {
    await page.goto("/#/", { waitUntil: "networkidle" });
    const initialRows = await page.locator("table tbody tr").count();
    expect(initialRows).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Aéreo" }).click();
    await expect(async () => {
      expect(await page.locator("table tbody tr").count()).not.toBe(initialRows);
    }).toPass({ timeout: 2000 });

    await page.getByRole("button", { name: "Todos os modos" }).click();
  });
});
