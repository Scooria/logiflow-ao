/**
 * Recepção de Webhook EMIS — confirmação de pagamento de Referência
 * Multicaixa / MCX Express, com actualização atómica do estado da carga.
 *
 * Fluxo:
 *   1. Verifica a assinatura HMAC-SHA256 do corpo bruto do pedido.
 *   2. Localiza a Transaction pendente pela combinação (entidade, referência).
 *   3. Idempotência: se já estiver PAID, responde 200 sem reprocessar.
 *   4. Numa única transacção de BD: marca a Transaction como PAID, actualiza
 *      a Invoice associada (se existir) e regista um TrackingEvent no
 *      Shipment associado (se existir) para aparecer na timeline do cliente.
 *
 * IMPORTANTE: o endpoint que recebe este webhook DEVE estar montado com o
 * raw body disponível (ver http/app.ts — `express.raw()` nesta rota
 * específica) porque a verificação HMAC precisa dos bytes exactos enviados
 * pelo EMIS, antes de qualquer parsing JSON.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { env } from "../../lib/env";
import { ConfigurationError, SignatureVerificationError, ValidationError } from "../../lib/errors";
import { confirmFeesPayment } from "../cargo/cargoRelease.service";

interface EmisWebhookPayload {
  entidade: string;
  referencia: string;
  valor: string;
  estado: "PAGO" | "EXPIRADO" | "CANCELADO" | string;
  dataHora: string;
  terminalId?: string;
}

const EMIS_SIGNATURE_HEADER = "x-emis-signature";

function verifySignature(rawBody: Buffer, signatureHeader: string | undefined): void {
  if (!env.EMIS_WEBHOOK_SECRET) {
    throw new ConfigurationError("EMIS_WEBHOOK_SECRET não configurado — não é possível validar o webhook.");
  }
  if (!signatureHeader) {
    throw new SignatureVerificationError("Cabeçalho de assinatura em falta.");
  }

  const expected = createHmac("sha256", env.EMIS_WEBHOOK_SECRET).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const receivedBuf = Buffer.from(signatureHeader, "utf8");

  const isValid =
    expectedBuf.length === receivedBuf.length && timingSafeEqual(expectedBuf, receivedBuf);

  if (!isValid) {
    throw new SignatureVerificationError();
  }
}

function parsePayload(rawBody: Buffer): EmisWebhookPayload {
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    throw new ValidationError("Corpo do webhook EMIS não é um JSON válido.");
  }
  const p = payload as Partial<EmisWebhookPayload>;
  if (!p.entidade || !p.referencia || !p.estado) {
    throw new ValidationError("Payload do webhook EMIS incompleto (entidade/referencia/estado em falta).");
  }
  return p as EmisWebhookPayload;
}

/** Handler Express — POST /webhooks/emis */
export async function handleEmisWebhook(req: Request, res: Response): Promise<void> {
  const rawBody = req.body as Buffer; // ver nota sobre express.raw() acima

  try {
    verifySignature(rawBody, req.header(EMIS_SIGNATURE_HEADER));
  } catch (err) {
    if (err instanceof SignatureVerificationError) {
      res.status(401).json({ error: err.code, message: err.message });
      return;
    }
    throw err;
  }

  const payload = parsePayload(rawBody);

  const transaction = await prisma.transaction.findFirst({
    where: { emisEntity: payload.entidade, emisReference: payload.referencia },
  });

  if (!transaction) {
    // Referência desconhecida — devolve 200 para o EMIS não reenviar em
    // loop, mas fica registado para investigação manual/alerta operacional.
    console.warn("[emis-webhook] Transação não encontrada", payload);
    res.status(200).json({ received: true, matched: false });
    return;
  }

  // Idempotência: pagamento já processado anteriormente.
  if (transaction.status === "PAID") {
    res.status(200).json({ received: true, matched: true, alreadyProcessed: true });
    return;
  }

  const newStatus =
    payload.estado === "PAGO" ? "PAID" : payload.estado === "EXPIRADO" ? "EXPIRED" : "CANCELLED";

  await prisma.$transaction(async (tx) => {
    await tx.transaction.update({
      where: { id: transaction.id },
      data: {
        status: newStatus,
        paidAt: newStatus === "PAID" ? new Date(payload.dataHora) : undefined,
        webhookPayload: payload as unknown as object,
      },
    });

    if (newStatus === "PAID" && transaction.invoiceId) {
      await tx.invoice.update({
        where: { id: transaction.invoiceId },
        data: { status: "PAID" },
      });
    }

    if (transaction.shipmentId) {
      await tx.trackingEvent.create({
        data: {
          tenantId: transaction.tenantId,
          shipmentId: transaction.shipmentId,
          status: "BOOKED", // o pagamento confirma a reserva; o estado operacional
                             // seguinte (recolha/trânsito) é actualizado pelo WMS/TMS.
          description:
            newStatus === "PAID"
              ? `Pagamento confirmado via Multicaixa (ref. ${payload.referencia}).`
              : `Pagamento ${newStatus.toLowerCase()} via Multicaixa (ref. ${payload.referencia}).`,
          source: "EMIS_WEBHOOK",
        },
      });
    }
  });

  // Se esta Transaction for o pagamento das taxas de importação de uma AWB
  // (Passo 6 — levantamento de carga), avança o respectivo CargoRelease.
  if (newStatus === "PAID") {
    await confirmFeesPayment(transaction.id);
  }

  res.status(200).json({ received: true, matched: true, status: newStatus });
}
