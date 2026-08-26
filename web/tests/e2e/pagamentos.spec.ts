import { test, expect } from "@playwright/test";

test.describe("Terminal de Pagamentos", () => {
  test("gera Referência Multicaixa (Entidade 00099)", async ({ page }) => {
    await page.goto("/#/pagamentos", { waitUntil: "networkidle" });
    await expect(page.getByText("Terminal de Pagamentos")).toBeVisible();
    await page.getByRole("button", { name: /Gerar Referência Multicaixa/ }).click();
    await expect(page.getByText("00099")).toBeVisible();
    await page.getByRole("button", { name: "Nova simulação" }).click();
  });

  test("gera número RUPE (AGT)", async ({ page }) => {
    await page.goto("/#/pagamentos", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /RUPE \(AGT\)/ }).click();
    await page.getByRole("button", { name: /Gerar RUPE/ }).click();
    await expect(page.getByText(/Nº RUPE/)).toBeVisible();
    await page.getByRole("button", { name: "Nova simulação" }).click();
  });

  test("checkout Stripe devolve uma sessão de teste", async ({ page }) => {
    await page.goto("/#/pagamentos", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Stripe Internacional/ }).click();
    await page.getByRole("button", { name: /Pagar com Stripe/ }).click();
    await expect(page.getByText(/cs_test_/)).toBeVisible();
  });
});
