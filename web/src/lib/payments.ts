/**
 * Simuladores de emissão de referência de pagamento — Multicaixa (EMIS),
 * RUPE (AGT) e Stripe Checkout internacional. Espelham o padrão já usado no
 * backend (src/modules/payments/emis.service.ts): geram uma referência
 * plausível e um comprovativo, claramente identificados como simulação —
 * uma integração real exige o contrato comercial com o banco emissor
 * (EMIS/Multicaixa), o webservice da AGT (RUPE), e as chaves de API da
 * Stripe respectivamente.
 */

function randomDigits(n: number): string {
  let out = "";
  for (let i = 0; i < n; i++) out += Math.floor(Math.random() * 10);
  return out;
}

function randomAlphaNum(n: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < n; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export interface MulticaixaReference {
  kind: "MULTICAIXA";
  entity: string;
  reference: string;
  amount: number;
  currency: "AOA";
  description: string;
  issuedAt: string;
  expiresAt: string;
}

/** Entidade 00099 — meramente ilustrativa; a entidade real é atribuída pela EMIS por contrato. */
export function generateMulticaixaReference(input: { amount: number; description: string }): MulticaixaReference {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 72 * 3600 * 1000);
  return {
    kind: "MULTICAIXA",
    entity: "00099",
    reference: `${randomDigits(3)} ${randomDigits(3)} ${randomDigits(3)}`,
    amount: input.amount,
    currency: "AOA",
    description: input.description,
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export interface RupeReference {
  kind: "RUPE";
  rupeNumber: string;
  nif: string;
  amount: number;
  currency: "AOA";
  description: string;
  issuedAt: string;
  validUntil: string;
}

/** RUPE — Referência Única de Pagamento ao Estado (AGT). Formato ilustrativo para demonstração. */
export function generateRupeReference(input: { amount: number; description: string; nif: string }): RupeReference {
  const now = new Date();
  const validUntil = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
  return {
    kind: "RUPE",
    rupeNumber: `${now.getFullYear()}${randomDigits(4)}${randomDigits(6)}`,
    nif: input.nif,
    amount: input.amount,
    currency: "AOA",
    description: input.description,
    issuedAt: now.toISOString(),
    validUntil: validUntil.toISOString(),
  };
}

export interface StripeCheckoutResult {
  kind: "STRIPE";
  sessionId: string;
  amount: number;
  currency: "USD" | "EUR";
  description: string;
  cardLast4: string;
  status: "succeeded";
  paidAt: string;
}

/** Checkout Stripe internacional — sessão simulada, sem qualquer chamada real à Stripe. */
export function simulateStripeCheckout(input: {
  amount: number;
  currency: "USD" | "EUR";
  description: string;
}): StripeCheckoutResult {
  return {
    kind: "STRIPE",
    sessionId: `cs_test_${randomAlphaNum(24)}`,
    amount: input.amount,
    currency: input.currency,
    description: input.description,
    cardLast4: randomDigits(4),
    status: "succeeded",
    paidAt: new Date().toISOString(),
  };
}
