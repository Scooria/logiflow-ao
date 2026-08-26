import { test, expect } from "@playwright/test";

test.describe("Painel WMS", () => {
  test("etiqueta de posição mostra código de barras e QR", async ({ page }) => {
    await page.goto("/#/wms", { waitUntil: "networkidle" });
    const posButtons = page.locator('button[title*="ocupado"], button[title*="n/d"]');
    await posButtons.first().click();

    await expect(page.getByText("Etiqueta da Posição")).toBeVisible();
    await expect(page.locator("svg").locator("visible=true")).not.toHaveCount(0);
    await expect(page.getByAltText(/Código QR/)).toBeVisible();
  });
});
