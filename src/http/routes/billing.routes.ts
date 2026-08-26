import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../asyncHandler";
import { prisma } from "../../lib/prisma";

/**
 * Faturação do mês corrente, por moeda — alimenta os tiles "Faturação do Mês
 * (AOA)" / "Faturação do Mês (USD)" do Dashboard (Passo 5). Soma
 * `Invoice.totalAmount` das faturas emitidas este mês com estado ISSUED,
 * CERTIFIED_AGT ou PAID (isto é, faturação reconhecida, não rascunhos).
 * Ver web/src/lib/mockData.ts (MOCK_BILLING_SUMMARY) para o mesmo formato em
 * modo demonstração.
 */
export const billingRouter = Router();

const BillingQuerySchema = z.object({ tenantId: z.string().min(1) });

billingRouter.get(
  "/billing/summary",
  asyncHandler(async (req, res) => {
    const { tenantId } = BillingQuerySchema.parse(req.query);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const invoices = await prisma.invoice.findMany({
      where: {
        tenantId,
        issuedAt: { gte: startOfMonth },
        status: { in: ["ISSUED", "CERTIFIED_AGT", "PAID"] },
      },
      select: { totalAmount: true, currency: true },
    });

    const aoaThisMonth = invoices
      .filter((i) => i.currency === "AOA")
      .reduce((sum, i) => sum + Number(i.totalAmount), 0);
    const usdThisMonth = invoices
      .filter((i) => i.currency === "USD")
      .reduce((sum, i) => sum + Number(i.totalAmount), 0);

    res.status(200).json({ aoaThisMonth, usdThisMonth });
  })
);
