import { test, expect } from "@playwright/test";

test.describe("Nova Expedição Multimodal", () => {
  test("emite uma Guia Rodoviária (Terrestre) e a expedição aparece no Dashboard", async ({ page }) => {
    await page.goto("/#/", { waitUntil: "networkidle" });
    await page.getByRole("link", { name: /Nova Expedição/ }).click();
    await expect(page.getByText("1. Modo de Transporte")).toBeVisible();

    await page.selectOption("select >> nth=0", "BENGUELA"); // origem
    await page.selectOption("select >> nth=1", "HUAMBO"); // destino
    await page.getByPlaceholder("Ex.: Sonangol Distribuição").fill("Teste Expedidor Lda");
    await page.getByPlaceholder("Ex.: Distribuidora do Huambo").fill("Teste Consignatário SA");

    const pieceInputs = page.locator('input[type="number"]');
    await pieceInputs.nth(0).fill("2"); // qtd
    await pieceInputs.nth(1).fill("40"); // compr.
    await pieceInputs.nth(2).fill("30"); // larg.
    await pieceInputs.nth(3).fill("20"); // alt.
    await pieceInputs.nth(4).fill("15"); // peso

    await expect(page.getByText(/kg/).first()).toBeVisible();

    await page.getByRole("button", { name: "Emitir Expedição" }).click();
    await expect(page.getByText(/GTR-/)).toBeVisible();
    await expect(page.getByText("Teste Expedidor Lda")).toBeVisible();

    await page.getByRole("link", { name: "Ver no Dashboard" }).click();
    await expect(page.getByText("Teste Expedidor Lda")).toBeVisible();
  });

  test("emite um AWB (Aéreo, internacional) com número válido", async ({ page }) => {
    await page.goto("/#/nova-expedicao", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Aéreo \(AWB\)/ }).click();
    await expect(page.getByText("Luanda — LAD")).toBeVisible();

    await page.getByRole("button", { name: "Internacional" }).click();
    await page.selectOption("select >> nth=0", "JFK");
    await page.getByPlaceholder("Ex.: Sonangol Distribuição").fill("Exportador Teste");
    await page.getByPlaceholder("Ex.: Distribuidora do Huambo").fill("Importer Test Inc");

    const pieceInputs = page.locator('input[type="number"]');
    await pieceInputs.nth(0).fill("1");
    await pieceInputs.nth(1).fill("50");
    await pieceInputs.nth(2).fill("50");
    await pieceInputs.nth(3).fill("50");
    await pieceInputs.nth(4).fill("30");

    await page.getByRole("button", { name: "Emitir Expedição" }).click();
    await expect(page.getByText(/649-\d{7}\d/)).toBeVisible();
  });
});
