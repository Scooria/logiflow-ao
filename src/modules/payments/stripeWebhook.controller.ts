/**
 * Recepção de Webhook Stripe — confirmação de pagamento do Checkout
 * internacional, com o mesmo padrão de idempotência e efeitos colaterais
 * (Invoice/TrackingEvent) usado em emisWebhook.controller.ts.
 *
 * IMPORTANTE: tal como o webhook EMIS, este endpoint precisa do raw body
 * (ver http/app.ts) — a verificação de assinatura da Stripe (`stripe-signature`)
 * usa os bytes exactos do pedido, através de `stripe.webhooks.constructEvent`.
 */
import { Request, Response } from "express";
import Stripe from "stripe";
import { prisma } from "../../lib/prisma";
import { env } from "../../lib/env";
import { ConfigurationError, SignatureVerificationError } from "../../lib/errors";

/** Handler Express — POST /webhooks/stripe */
export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    throw new ConfigurationError(
      "Integração Stripe não configurada — defina STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET."
    );
  }
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  const rawBody = req.body as Buffer; // ver nota sobre express.raw() acima
  const signature = req.header("stripe-signature");

  let event: Stripe.Event;
  try {
    if (!signature) throw new SignatureVerificationError("Cabeçalho stripe-signature em falta.");
    event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    res.status(401).json({ error: "SIGNATURE_VERIFICATION_ERROR", message: "Assinatura Stripe inválida." });
    return;
  }

  if (event.type !== "checkout.session.completed") {
    res.status(200).json({ received: true, ignored: event.type });
    return;
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : undefined;

  const transaction = await prisma.transaction.findFirst({
    where: { stripePaymentIntentId: paymentIntentId ?? "__none__" },
  });

  if (!transaction) {
    console.warn("[stripe-webhook] Transação não encontrada para sessão", session.id);
    res.status(200).json({ received: true, matched: false });
    return;
  }
  if (transaction.status === "PAID") {
    res.status(200).json({ received: true, matched: true, alreadyProcessed: true });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.transaction.update({
      where: { id: transaction.id },
      data: { status: "PAID", paidAt: new Date(), webhookPayload: session as unknown as object },
    });
    if (transaction.invoiceId) {
      await tx.invoice.update({ where: { id: transaction.invoiceId }, data: { status: "PAID" } });
    }
    if (transaction.shipmentId) {
      await tx.trackingEvent.create({
        data: {
          tenantId: transaction.tenantId,
          shipmentId: transaction.shipmentId,
          status: "BOOKED",
          description: `Pagamento internacional confirmado via Stripe (sessão ${session.id}).`,
          source: "STRIPE_WEBHOOK",
        },
      });
    }
  });

  res.status(200).json({ received: true, matched: true, status: "PAID" });
}
