/**
 * Checkout Stripe para clientes internacionais — ao contrário do EMIS
 * (Multicaixa) e do RUPE (AGT), o Stripe é auto-serviço: basta criar uma
 * conta em https://dashboard.stripe.com e colar a chave secreta de teste
 * (sk_test_...) em STRIPE_SECRET_KEY, sem precisar de nenhum acordo
 * comercial ou institucional prévio. Em modo de teste, o Stripe fornece
 * números de cartão fictícios que nunca cobram dinheiro real
 * (ex.: 4242 4242 4242 4242) — ver https://docs.stripe.com/testing.
 *
 * Fluxo: este serviço cria uma Stripe Checkout Session (hosted, o cliente é
 * redirecionado para uma página segura da própria Stripe) e regista uma
 * Transaction em estado PENDING. A confirmação de pagamento chega depois
 * via webhook `checkout.session.completed` (ver stripeWebhook.controller.ts)
 * — nunca confiar apenas no redirect de sucesso no browser.
 */
import Stripe from "stripe";
import { Currency } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { env } from "../../lib/env";
import { ConfigurationError, ValidationError } from "../../lib/errors";

let stripeClient: Stripe | null = null;

function getStripeClient(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new ConfigurationError(
      "Integração Stripe não configurada — defina STRIPE_SECRET_KEY (chave de teste ou produção; ver https://dashboard.stripe.com/apikeys)."
    );
  }
  if (!stripeClient) {
    stripeClient = new Stripe(env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

export interface CreateCheckoutSessionInput {
  tenantId: string;
  amount: number; // na unidade principal da moeda (ex.: 150.00 USD), NÃO em cêntimos
  currency?: Currency;
  description?: string;
  shipmentId?: string;
  invoiceId?: string;
}

const STRIPE_SUPPORTED_CURRENCIES: Currency[] = ["USD", "EUR"];

/**
 * Cria uma Checkout Session da Stripe (hosted) e a Transaction PENDING
 * correspondente. Devolve o `url` para onde o frontend deve redirecionar o
 * cliente.
 */
export async function createStripeCheckoutSession(input: CreateCheckoutSessionInput) {
  const currency = input.currency ?? "USD";
  if (!STRIPE_SUPPORTED_CURRENCIES.includes(currency)) {
    throw new ValidationError(
      `Checkout Stripe configurado apenas para ${STRIPE_SUPPORTED_CURRENCIES.join("/")} nesta demonstração — para AOA usar Multicaixa/RUPE.`
    );
  }
  if (input.amount <= 0) {
    throw new ValidationError("O montante do checkout deve ser positivo.");
  }

  const stripe = getStripeClient();
  const unitAmountInCents = Math.round(input.amount * 100);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: currency.toLowerCase(),
          product_data: { name: input.description ?? "Frete internacional — LogiFlow AO" },
          unit_amount: unitAmountInCents,
        },
        quantity: 1,
      },
    ],
    success_url: `${env.STRIPE_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: env.STRIPE_CANCEL_URL,
    metadata: {
      tenantId: input.tenantId,
      ...(input.shipmentId ? { shipmentId: input.shipmentId } : {}),
    },
  });

  const transaction = await prisma.transaction.create({
    data: {
      tenantId: input.tenantId,
      shipmentId: input.shipmentId,
      invoiceId: input.invoiceId,
      type: "PAYMENT",
      method: "STRIPE_CARD",
      status: "PENDING",
      amount: input.amount,
      currency,
      stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : undefined,
    },
  });

  return { checkoutUrl: session.url, sessionId: session.id, transaction };
}
