/**
 * Controlador de Pagamentos Angolanos — EMIS (Multicaixa Referência dinâmica
 * e MCX Express).
 *
 * O EMIS (Empresa Interbancária de Serviços) disponibiliza aos comerciantes,
 * através do banco emissor / agregador contratado, uma API de "Gestão de
 * Pagamentos Online" (GPO) para gerar referências Multicaixa dinâmicas e
 * cobranças MCX Express. O endpoint exacto, nomes de campos e mecanismo de
 * autenticação VARIAM consoante o acordo comercial/banco — os nomes usados
 * abaixo (`/references`, `entidade`, `referencia`) seguem a nomenclatura
 * habitual do mercado angolano, mas devem ser confirmados e ajustados ao
 * contrato técnico fornecido pelo banco/agregador antes de produção.
 */
import { randomUUID } from "node:crypto";
import { Currency } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { env } from "../../lib/env";
import { ConfigurationError, ExternalServiceError, ValidationError } from "../../lib/errors";

interface EmisReferenceResponse {
  entidade: string;
  referencia: string;
  validade: string; // ISO date-time
}

interface EmisMcxExpressResponse {
  entidade: string;
  referencia: string;
  estado: string;
}

function assertEmisConfigured(): void {
  if (!env.EMIS_API_BASE_URL || !env.EMIS_ENTITY_ID || !env.EMIS_API_KEY) {
    throw new ConfigurationError(
      "Integração EMIS não configurada — defina EMIS_API_BASE_URL, EMIS_ENTITY_ID e EMIS_API_KEY."
    );
  }
}

async function emisRequest<T>(path: string, body: Record<string, unknown>): Promise<T> {
  assertEmisConfigured();
  const response = await fetch(`${env.EMIS_API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.EMIS_API_KEY}`,
      "X-Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new ExternalServiceError("EMIS", `HTTP ${response.status} — ${detail}`);
  }

  return (await response.json()) as T;
}

export interface GenerateReferenceInput {
  tenantId: string;
  amount: number;
  currency?: Currency; // Multicaixa opera em Kwanza — validado abaixo
  shipmentId?: string;
  invoiceId?: string;
  description?: string;
}

/**
 * Gera uma Referência Multicaixa dinâmica junto do EMIS e regista a
 * Transaction correspondente em estado PENDING, pronta para conciliação via
 * webhook (ver emisWebhook.controller.ts).
 */
export async function generateMulticaixaReference(input: GenerateReferenceInput) {
  const currency = input.currency ?? "AOA";
  if (currency !== "AOA") {
    throw new ValidationError(
      "Referências Multicaixa (EMIS) só podem ser emitidas em Kwanza (AOA). Converta o montante antes de chamar este serviço."
    );
  }
  if (input.amount <= 0) {
    throw new ValidationError("O montante da referência deve ser positivo.");
  }

  const expiresAt = new Date(Date.now() + env.EMIS_REFERENCE_TTL_HOURS * 60 * 60 * 1000);

  const emisResponse = await emisRequest<EmisReferenceResponse>("/references", {
    entidade: env.EMIS_ENTITY_ID,
    valor: input.amount.toFixed(2),
    validade: expiresAt.toISOString(),
    descricao: input.description ?? "Pagamento LogiFlow AO",
  });

  return prisma.transaction.create({
    data: {
      tenantId: input.tenantId,
      shipmentId: input.shipmentId,
      invoiceId: input.invoiceId,
      type: "PAYMENT",
      method: "EMIS_REFERENCE",
      status: "PENDING",
      amount: input.amount,
      currency,
      emisEntity: emisResponse.entidade,
      emisReference: emisResponse.referencia,
      expiresAt,
    },
  });
}

export interface GenerateMcxExpressInput extends GenerateReferenceInput {
  /** Número de telefone associado à conta Multicaixa Express do pagador. */
  phone: string;
}

/**
 * Dispara uma cobrança "push" via MCX Express para o telemóvel do pagador.
 * O estado inicial fica PROCESSING até o utilizador aprovar/rejeitar no seu
 * telemóvel — a confirmação final chega, tal como na referência, via webhook.
 */
export async function generateMcxExpressCharge(input: GenerateMcxExpressInput) {
  const currency = input.currency ?? "AOA";
  if (currency !== "AOA") {
    throw new ValidationError("MCX Express só opera em Kwanza (AOA).");
  }
  if (!/^9\d{8}$/.test(input.phone)) {
    throw new ValidationError("Número de telefone MCX Express inválido (esperado formato 9XXXXXXXX).");
  }

  const emisResponse = await emisRequest<EmisMcxExpressResponse>("/mcx-express/charges", {
    entidade: env.EMIS_ENTITY_ID,
    telefone: input.phone,
    valor: input.amount.toFixed(2),
    descricao: input.description ?? "Pagamento LogiFlow AO",
  });

  return prisma.transaction.create({
    data: {
      tenantId: input.tenantId,
      shipmentId: input.shipmentId,
      invoiceId: input.invoiceId,
      type: "PAYMENT",
      method: "MCX_EXPRESS",
      status: "PROCESSING",
      amount: input.amount,
      currency,
      emisEntity: emisResponse.entidade,
      emisReference: emisResponse.referencia,
      mcxExpressPhone: input.phone,
    },
  });
}
