import { Router } from "express";
import { z } from "zod";
import { generateMulticaixaReference, generateMcxExpressCharge } from "../../modules/payments/emis.service";
import { createStripeCheckoutSession } from "../../modules/payments/stripe.service";
import { asyncHandler } from "../asyncHandler";
import { prisma } from "../../lib/prisma";

export const paymentsRouter = Router();

/**
 * Lista de pagamentos EMIS (Multicaixa Referência) do tenant, para o cartão
 * "Pagamentos EMIS Pendentes" do Dashboard e para os chips de seleção rápida
 * do Terminal de Pagamentos (Passo 5). Ver web/src/lib/mockData.ts
 * (MOCK_EMIS_PAYMENTS) para o mesmo formato em modo demonstração.
 */
const EmisListQuerySchema = z.object({ tenantId: z.string().min(1) });
paymentsRouter.get(
  "/emis",
  asyncHandler(async (req, res) => {
    const { tenantId } = EmisListQuerySchema.parse(req.query);
    const transactions = await prisma.transaction.findMany({
      where: { tenantId, method: { in: ["EMIS_REFERENCE", "MCX_EXPRESS"] } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.status(200).json(
      transactions.map((t) => ({
        id: t.id,
        emisReference: t.emisReference ?? "",
        amount: Number(t.amount),
        currency: t.currency,
        status: t.status,
        createdAt: t.createdAt.toISOString(),
      }))
    );
  })
);

const ReferenceSchema = z.object({
  tenantId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.enum(["AOA", "USD", "EUR", "ZAR"]).optional(),
  shipmentId: z.string().optional(),
  invoiceId: z.string().optional(),
  description: z.string().optional(),
});
paymentsRouter.post(
  "/emis/reference",
  asyncHandler(async (req, res) => {
    const input = ReferenceSchema.parse(req.body);
    const transaction = await generateMulticaixaReference(input);
    res.status(201).json(transaction);
  })
);

const McxExpressSchema = ReferenceSchema.extend({
  phone: z.string().regex(/^9\d{8}$/),
});
paymentsRouter.post(
  "/emis/mcx-express",
  asyncHandler(async (req, res) => {
    const input = McxExpressSchema.parse(req.body);
    const transaction = await generateMcxExpressCharge(input);
    res.status(201).json(transaction);
  })
);

const StripeCheckoutSchema = z.object({
  tenantId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.enum(["USD", "EUR"]).optional(),
  description: z.string().optional(),
  shipmentId: z.string().optional(),
  invoiceId: z.string().optional(),
});
paymentsRouter.post(
  "/stripe/checkout-session",
  asyncHandler(async (req, res) => {
    const input = StripeCheckoutSchema.parse(req.body);
    const result = await createStripeCheckoutSession(input);
    res.status(201).json(result);
  })
);
