/**
 * Levantamento de carga aérea de importação — Passo 6.
 *
 * Cobre o lado da CHEGADA do fluxo aéreo (o inverso do que `airWaybill.service.ts`
 * cobre do lado do envio): a carga chega fisicamente num ULD, a equipa de
 * conferência confere e arruma no armazém (WMS), o AWB fica pronto para
 * pagamento das taxas de importação, o destinatário paga (reaproveitando o
 * `emis.service.ts` já existente), e a equipa entrega o AWB original —
 * presencialmente ou por um serviço de entrega pago à parte.
 *
 * Destinatários com volume de movimentos elevado seguem um circuito
 * prioritário (`Party.vipStatus`, recalculado aqui, nunca definido à mão).
 *
 * Requisitos recolhidos directamente do operador (nota de voz, 2026-08-26) —
 * ver também prisma/schema.prisma, secção 12, para o modelo de dados.
 */
import { CargoReleaseStatus, PaymentMethod, UldType } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { NotFoundError, ValidationError } from "../../lib/errors";
import { generateMcxExpressCharge, generateMulticaixaReference } from "../payments/emis.service";

// --- Estatuto VIP --------------------------------------------------------
// Limiar ilustrativo — em produção deve ser configurável por tenant (ex.:
// campo em Tenant ou tabela de configuração), não uma constante fixa.
const VIP_LOOKBACK_DAYS = 30;
const VIP_MIN_MOVEMENTS = 4;

/**
 * Recalcula o estatuto VIP de um destinatário a partir do número de AWBs
 * conferidas (CargoRelease criado) nos últimos `VIP_LOOKBACK_DAYS` dias.
 * Chamado sempre que uma nova AWB dá entrada na conferência — nunca definido
 * manualmente, para não ficar desactualizado.
 */
export async function recalculateVipStatus(tenantId: string, consigneeId: string): Promise<boolean> {
  const since = new Date(Date.now() - VIP_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const movementCount = await prisma.cargoRelease.count({
    where: { tenantId, airWaybill: { consigneeId }, createdAt: { gte: since } },
  });

  const isVip = movementCount >= VIP_MIN_MOVEMENTS;
  const party = await prisma.party.findUnique({ where: { id: consigneeId } });
  if (party && party.vipStatus !== isVip) {
    await prisma.party.update({
      where: { id: consigneeId },
      data: { vipStatus: isVip, vipSince: isVip ? new Date() : null },
    });
  }
  return isVip;
}

// --- 1. Chegada do ULD ----------------------------------------------------

export interface RegisterUldArrivalInput {
  tenantId: string;
  uldNumber: string;
  type?: UldType;
  flightId?: string;
  warehouseId?: string;
}

/** Regista (ou actualiza) a chegada física de um ULD — scan ou introdução manual. */
export async function registerUldArrival(input: RegisterUldArrivalInput) {
  return prisma.uld.upsert({
    where: { tenantId_uldNumber: { tenantId: input.tenantId, uldNumber: input.uldNumber } },
    create: {
      tenantId: input.tenantId,
      uldNumber: input.uldNumber,
      type: input.type ?? "CONTAINER",
      flightId: input.flightId,
      warehouseId: input.warehouseId,
      arrivedAt: new Date(),
    },
    update: {
      flightId: input.flightId,
      warehouseId: input.warehouseId,
      arrivedAt: new Date(),
    },
  });
}

// --- 2. Conferência e arrumação (breakdown + put-away) --------------------

export interface BreakdownAndStoreInput {
  tenantId: string;
  awbNumber: string;
  storedLocationId: string; // posição do WMS lida no scan de arrumação
  breakdownByUserId: string;
  uldNumber?: string; // liga a AWB ao ULD em que chegou, se ainda não estiver ligada
}

/**
 * Passo único que cobre "o conferente escaneia o AWB, escaneia a posição do
 * armazém onde o está a colocar" — e, tal como descrito, avança logo o AWB
 * para "pronto para pagamento" assim que a arrumação termina.
 */
export async function breakdownAndStoreAirWaybill(input: BreakdownAndStoreInput) {
  const awb = await prisma.airWaybill.findFirst({
    where: { tenantId: input.tenantId, awbNumber: input.awbNumber },
  });
  if (!awb) throw new NotFoundError("AirWaybill", input.awbNumber);

  const location = await prisma.storageLocation.findUnique({ where: { id: input.storedLocationId } });
  if (!location) throw new NotFoundError("StorageLocation", input.storedLocationId);

  let uldId: string | undefined;
  if (input.uldNumber) {
    const uld = await registerUldArrival({ tenantId: input.tenantId, uldNumber: input.uldNumber });
    uldId = uld.id;
    if (!awb.uldId) {
      await prisma.airWaybill.update({ where: { id: awb.id }, data: { uldId: uld.id } });
    }
  }

  const isVip = await recalculateVipStatus(input.tenantId, awb.consigneeId);
  const now = new Date();

  const cargoRelease = await prisma.cargoRelease.upsert({
    where: { airWaybillId: awb.id },
    create: {
      tenantId: input.tenantId,
      airWaybillId: awb.id,
      uldId: uldId ?? awb.uldId ?? undefined,
      status: "READY_FOR_PAYMENT",
      breakdownByUserId: input.breakdownByUserId,
      storedLocationId: input.storedLocationId,
      isVip,
      readyForPaymentAt: now,
      // Cliente VIP: notificação automática e proactiva. Cliente normal:
      // consulta o estado por iniciativa própria (ver lookupCargoReleaseByAwbNumber).
      notifiedReadyForPaymentAt: isVip ? now : null,
    },
    update: {
      status: "READY_FOR_PAYMENT",
      breakdownByUserId: input.breakdownByUserId,
      storedLocationId: input.storedLocationId,
      uldId: uldId ?? undefined,
      isVip,
      readyForPaymentAt: now,
      notifiedReadyForPaymentAt: isVip ? now : undefined,
    },
    include: { airWaybill: { include: { consignee: true } } },
  });

  if (awb.status !== "ARRIVED") {
    await prisma.airWaybill.update({ where: { id: awb.id }, data: { status: "ARRIVED" } });
  }

  const shipment = await prisma.shipment.findUnique({ where: { airWaybillId: awb.id } });
  if (shipment) {
    await prisma.trackingEvent.create({
      data: {
        tenantId: input.tenantId,
        shipmentId: shipment.id,
        status: "ARRIVED",
        description: `Carga conferida e arrumada em ${location.uniqueAddress}. AWB pronta para pagamento das taxas de importação.${
          isVip ? " Destinatário VIP — notificação automática enviada." : ""
        }`,
        source: "CARGO_RELEASE_BREAKDOWN",
      },
    });
  }

  return cargoRelease;
}

// --- 3. Consulta pelo destinatário (self-service) --------------------------

/** Consulta pública/self-service pelo número do AWB — "coloca o AWB, vê o estado". */
export async function lookupCargoReleaseByAwbNumber(tenantId: string, awbNumber: string) {
  const awb = await prisma.airWaybill.findFirst({
    where: { tenantId, awbNumber },
    include: { consignee: true, cargoRelease: { include: { storedLocation: true, feesTransaction: true } } },
  });
  if (!awb) throw new NotFoundError("AirWaybill", awbNumber);

  return {
    awbNumber: awb.awbNumber,
    consigneeName: awb.consignee.name,
    consigneeRegistered: Boolean(awb.consignee.nif), // registo mínimo exigido: NIF
    isVip: awb.cargoRelease?.isVip ?? false,
    status: awb.cargoRelease?.status ?? null,
    storedLocation: awb.cargoRelease?.storedLocation?.uniqueAddress ?? null,
    feesTransactionStatus: awb.cargoRelease?.feesTransaction?.status ?? null,
    readyForPickupAt: awb.cargoRelease?.readyForPickupAt ?? null,
  };
}

// --- 4. Pagamento das taxas de importação ----------------------------------

export interface InitiateFeesPaymentInput {
  tenantId: string;
  cargoReleaseId: string;
  amount: number;
  method: Extract<PaymentMethod, "EMIS_REFERENCE" | "MCX_EXPRESS">;
  mcxExpressPhone?: string; // obrigatório quando method = MCX_EXPRESS
}

/** Gera a referência/cobrança de pagamento das taxas, reaproveitando o `emis.service.ts` já existente. */
export async function initiateFeesPayment(input: InitiateFeesPaymentInput) {
  const cargoRelease = await prisma.cargoRelease.findFirst({
    where: { id: input.cargoReleaseId, tenantId: input.tenantId },
  });
  if (!cargoRelease) throw new NotFoundError("CargoRelease", input.cargoReleaseId);
  if (cargoRelease.status !== "READY_FOR_PAYMENT") {
    throw new ValidationError(
      `Esta AWB não está pronta para pagamento (estado actual: ${cargoRelease.status}).`
    );
  }

  const description = `Taxas de importação — AWB (levantamento de carga)`;
  const transaction =
    input.method === "MCX_EXPRESS"
      ? await generateMcxExpressCharge({
          tenantId: input.tenantId,
          amount: input.amount,
          phone: input.mcxExpressPhone ?? "",
          description,
        })
      : await generateMulticaixaReference({
          tenantId: input.tenantId,
          amount: input.amount,
          description,
        });

  await prisma.cargoRelease.update({
    where: { id: cargoRelease.id },
    data: { feesTransactionId: transaction.id },
  });

  return transaction;
}

// --- 5. Confirmação de pagamento (chamado pelo webhook EMIS/Stripe) --------

/**
 * Avança o CargoRelease para PAYMENT_CONFIRMED. Chamado a partir do webhook
 * de pagamento (ver emisWebhook.controller.ts) assim que a Transaction ligada
 * fica PAID — nunca invocado directamente por um pedido do cliente.
 */
export async function confirmFeesPayment(transactionId: string) {
  const cargoRelease = await prisma.cargoRelease.findUnique({ where: { feesTransactionId: transactionId } });
  if (!cargoRelease || cargoRelease.status !== "READY_FOR_PAYMENT") return null;

  return prisma.cargoRelease.update({
    where: { id: cargoRelease.id },
    data: { status: "PAYMENT_CONFIRMED", paidAt: new Date() },
  });
}

// --- 6. Carimbo/assinatura do original — pronto para levantamento ----------

export interface MarkReadyForPickupInput {
  tenantId: string;
  cargoReleaseId: string;
  documentCustodyNotes?: string; // ex.: "carimbado e assinado, guardado no cofre A"
}

export async function markReadyForPickup(input: MarkReadyForPickupInput) {
  const cargoRelease = await prisma.cargoRelease.findFirst({
    where: { id: input.cargoReleaseId, tenantId: input.tenantId },
  });
  if (!cargoRelease) throw new NotFoundError("CargoRelease", input.cargoReleaseId);
  if (cargoRelease.status !== "PAYMENT_CONFIRMED") {
    throw new ValidationError(
      `Só é possível marcar como pronta para levantamento depois do pagamento confirmado (estado actual: ${cargoRelease.status}).`
    );
  }

  const now = new Date();
  return prisma.cargoRelease.update({
    where: { id: cargoRelease.id },
    data: {
      status: "READY_FOR_PICKUP",
      readyForPickupAt: now,
      notifiedReadyForPickupAt: now, // email "pronto para levantamento" — sempre enviado, VIP ou não
      documentCustodyNotes: input.documentCustodyNotes,
    },
  });
}

// --- 7. Entrega ao domicílio (serviço extra) OU levantamento presencial ----

export interface RequestDeliveryInput {
  tenantId: string;
  cargoReleaseId: string;
  deliveryAddress: string;
  deliveryFee: number;
}

export async function requestDelivery(input: RequestDeliveryInput) {
  const cargoRelease = await prisma.cargoRelease.findFirst({
    where: { id: input.cargoReleaseId, tenantId: input.tenantId },
  });
  if (!cargoRelease) throw new NotFoundError("CargoRelease", input.cargoReleaseId);
  if (cargoRelease.status !== "READY_FOR_PICKUP") {
    throw new ValidationError("Só é possível pedir entrega depois de a carga estar pronta para levantamento.");
  }

  return prisma.cargoRelease.update({
    where: { id: cargoRelease.id },
    data: {
      status: "OUT_FOR_DELIVERY",
      deliveryRequested: true,
      deliveryAddress: input.deliveryAddress,
      deliveryFee: input.deliveryFee,
    },
  });
}

export interface CollectCargoInput {
  tenantId: string;
  cargoReleaseId: string;
}

/** Levantamento presencial, ou confirmação de entrega concluída. */
export async function collectCargo(input: CollectCargoInput) {
  const cargoRelease = await prisma.cargoRelease.findFirst({
    where: { id: input.cargoReleaseId, tenantId: input.tenantId },
  });
  if (!cargoRelease) throw new NotFoundError("CargoRelease", input.cargoReleaseId);
  if (cargoRelease.status !== "READY_FOR_PICKUP" && cargoRelease.status !== "OUT_FOR_DELIVERY") {
    throw new ValidationError(
      `Esta AWB ainda não está pronta para ser levantada ou entregue (estado actual: ${cargoRelease.status}).`
    );
  }

  const now = new Date();
  const wasDelivery = cargoRelease.status === "OUT_FOR_DELIVERY";
  return prisma.cargoRelease.update({
    where: { id: cargoRelease.id },
    data: {
      status: "COLLECTED",
      collectedAt: now,
      deliveredAt: wasDelivery ? now : undefined,
    },
  });
}

export const CARGO_RELEASE_STATUS_VALUES: CargoReleaseStatus[] = [
  "ARRIVED_AT_BREAKDOWN",
  "STORED",
  "READY_FOR_PAYMENT",
  "PAYMENT_CONFIRMED",
  "READY_FOR_PICKUP",
  "OUT_FOR_DELIVERY",
  "COLLECTED",
];
