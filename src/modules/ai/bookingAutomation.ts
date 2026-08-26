/**
 * Automação de reservas a partir de documentos extraídos.
 *
 * Princípio central: a IA PROPÕE, uma pessoa CONFIRMA, o sistema EXECUTA.
 * `buildDraftBookingProposal` nunca escreve nada operacional — apenas
 * resolve/cria os `Party` (shipper/consignee) e normaliza os volumes de
 * carga a partir do `IngestedDocument`, devolvendo também a lista do que
 * ainda falta (`missingFields`) para se poder emitir uma guia real. Só
 * depois de um utilizador confirmar o documento (status CONFIRMED) e
 * fornecer os dados operacionais que nenhum documento comercial contém —
 * veículo/motorista para a via terrestre, aeroporto/voo para a via aérea —
 * é que `finalizeRoadBookingFromDocument` / `finalizeAirBookingFromDocument`
 * chamam efectivamente os serviços de emissão do Passo 2.
 */
import { Province } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { NotFoundError, ValidationError } from "../../lib/errors";
import { resolveOrCreateParty } from "./partyResolution";
import { PieceDimensions } from "../cargo/chargeableWeight";
import { issueAirWaybill, IssueAirWaybillInput } from "../cargo/airWaybill.service";
import { issueRoadWaybill, ManifestItemInput } from "../cargo/roadWaybill.service";
import { InvoiceExtraction, PackingListExtraction, QuotationEmailExtraction } from "./schemas";

export type ConfirmAction = "CONFIRM" | "REJECT";

export async function reviewIngestedDocument(params: {
  documentId: string;
  tenantId: string;
  action: ConfirmAction;
  reviewedByUserId: string;
  reviewNotes?: string;
}) {
  const doc = await prisma.ingestedDocument.findFirst({
    where: { id: params.documentId, tenantId: params.tenantId },
  });
  if (!doc) throw new NotFoundError("IngestedDocument", params.documentId);
  if (doc.status !== "PENDING_REVIEW") {
    throw new ValidationError(
      `Documento já está em estado ${doc.status} — só é possível rever documentos PENDING_REVIEW.`
    );
  }

  return prisma.ingestedDocument.update({
    where: { id: doc.id },
    data: {
      status: params.action === "CONFIRM" ? "CONFIRMED" : "REJECTED",
      reviewedByUserId: params.reviewedByUserId,
      reviewNotes: params.reviewNotes,
    },
  });
}

export interface DraftBookingProposal {
  documentId: string;
  documentType: "INVOICE" | "PACKING_LIST" | "QUOTATION_EMAIL";
  shipperId: string;
  shipperName: string;
  consigneeId: string;
  consigneeName: string;
  suggestedMode: "AIR" | "ROAD" | "UNKNOWN";
  pieces: PieceDimensions[];
  piecesMissingDimensionsCount: number;
  originHint?: string | null;
  destinationHint?: string | null;
  originProvince?: Province | null;
  destinationProvince?: Province | null;
  missingFields: string[];
}

function piecesFromPackingList(extraction: PackingListExtraction): {
  ready: PieceDimensions[];
  missingCount: number;
} {
  const ready: PieceDimensions[] = [];
  let missingCount = 0;
  for (const piece of extraction.pieces) {
    if (
      piece.lengthCm != null &&
      piece.widthCm != null &&
      piece.heightCm != null &&
      piece.grossWeightKg != null
    ) {
      // Expande pela quantidade: cada unidade física vira uma "peça" para efeitos de AWB.
      for (let i = 0; i < Math.max(1, Math.round(piece.quantity)); i++) {
        ready.push({
          lengthCm: piece.lengthCm,
          widthCm: piece.widthCm,
          heightCm: piece.heightCm,
          grossWeightKg: piece.grossWeightKg,
        });
      }
    } else {
      missingCount += 1;
    }
  }
  return { ready, missingCount };
}

/**
 * Constrói uma proposta de reserva a partir de um documento já CONFIRMADO.
 * Resolve/cria os Party de shipper e consignee (side-effect leve e idempotente
 * — nunca duplica um Party existente pelo mesmo NIF/nome), mas não emite
 * nenhuma guia.
 */
export async function buildDraftBookingProposal(params: {
  documentId: string;
  tenantId: string;
}): Promise<DraftBookingProposal> {
  const doc = await prisma.ingestedDocument.findFirst({
    where: { id: params.documentId, tenantId: params.tenantId },
  });
  if (!doc) throw new NotFoundError("IngestedDocument", params.documentId);
  if (doc.status !== "CONFIRMED") {
    throw new ValidationError(
      `O documento tem de estar CONFIRMED antes de gerar uma proposta de reserva (estado actual: ${doc.status}).`
    );
  }

  const missingFields: string[] = [];

  if (doc.type === "INVOICE") {
    const extraction = doc.extractedPayload as unknown as InvoiceExtraction;
    const shipper = await resolveOrCreateParty({ tenantId: params.tenantId, name: extraction.sellerName, nif: extraction.sellerNif });
    const consignee = await resolveOrCreateParty({ tenantId: params.tenantId, name: extraction.buyerName, nif: extraction.buyerNif });
    missingFields.push(
      "Fatura não contém volumes/dimensões de carga — associe uma Packing List para completar a reserva."
    );
    return {
      documentId: doc.id,
      documentType: "INVOICE",
      shipperId: shipper.id,
      shipperName: shipper.name,
      consigneeId: consignee.id,
      consigneeName: consignee.name,
      suggestedMode: "UNKNOWN",
      pieces: [],
      piecesMissingDimensionsCount: 0,
      missingFields,
    };
  }

  if (doc.type === "PACKING_LIST") {
    const extraction = doc.extractedPayload as unknown as PackingListExtraction;
    const shipper = await resolveOrCreateParty({ tenantId: params.tenantId, name: extraction.shipperName, nif: extraction.shipperNif });
    const consignee = await resolveOrCreateParty({ tenantId: params.tenantId, name: extraction.consigneeName, nif: extraction.consigneeNif });
    const { ready, missingCount } = piecesFromPackingList(extraction);

    if (missingCount > 0) {
      missingFields.push(`Dimensões em falta para ${missingCount} volume(s) — necessárias para frete aéreo.`);
    }
    if (ready.length === 0) {
      missingFields.push("Nenhum volume com dimensões completas — reserva terrestre pode prosseguir apenas com peso.");
    }
    missingFields.push("Escolha o modo (Aéreo/Terrestre) e os dados operacionais (veículo+motorista, ou aeroporto+voo).");

    return {
      documentId: doc.id,
      documentType: "PACKING_LIST",
      shipperId: shipper.id,
      shipperName: shipper.name,
      consigneeId: consignee.id,
      consigneeName: consignee.name,
      suggestedMode: "UNKNOWN",
      pieces: ready,
      piecesMissingDimensionsCount: missingCount,
      originHint: extraction.originHint,
      destinationHint: extraction.destinationHint,
      missingFields,
    };
  }

  // QUOTATION_EMAIL
  const extraction = doc.extractedPayload as unknown as QuotationEmailExtraction;
  const shipper = await resolveOrCreateParty({
    tenantId: params.tenantId,
    name: extraction.contactName,
    province: extraction.originProvince,
  });
  // Numa cotação ainda não há necessariamente um consignee identificado — usa o
  // próprio contacto como marcador de posição; a equipa comercial substitui ao confirmar.
  const consignee = await resolveOrCreateParty({
    tenantId: params.tenantId,
    name: extraction.destinationText ?? "Destinatário a confirmar",
    province: extraction.destinationProvince,
  });

  if (!extraction.originProvince || !extraction.destinationProvince) {
    missingFields.push("Província de origem/destino não identificada com confiança — confirme manualmente.");
  }
  missingFields.push("Cotação não tem volumes detalhados — associe uma Packing List quando disponível, ou introduza manualmente.");

  return {
    documentId: doc.id,
    documentType: "QUOTATION_EMAIL",
    shipperId: shipper.id,
    shipperName: shipper.name,
    consigneeId: consignee.id,
    consigneeName: consignee.name,
    suggestedMode: extraction.requestedMode,
    pieces: [],
    piecesMissingDimensionsCount: 0,
    originHint: extraction.originText,
    destinationHint: extraction.destinationText,
    originProvince: extraction.originProvince,
    destinationProvince: extraction.destinationProvince,
    missingFields,
  };
}

async function markDocumentBooked(documentId: string, shipmentId: string) {
  await prisma.ingestedDocument.update({
    where: { id: documentId },
    data: { status: "BOOKED", linkedShipmentId: shipmentId },
  });
}

export interface FinalizeRoadBookingInput {
  documentId: string;
  tenantId: string;
  originProvince: Province;
  destinationProvince: Province;
  vehicleId: string;
  driverId: string;
}

/** Completa uma reserva TERRESTRE a partir de um documento confirmado. */
export async function finalizeRoadBookingFromDocument(input: FinalizeRoadBookingInput) {
  const proposal = await buildDraftBookingProposal({ documentId: input.documentId, tenantId: input.tenantId });

  const manifestItems: ManifestItemInput[] =
    proposal.pieces.length > 0
      ? proposal.pieces.map((p, idx) => ({
          description: `Volume ${idx + 1} (extraído por IA)`,
          quantity: 1,
          weightKg: p.grossWeightKg,
        }))
      : [{ description: "Carga extraída por IA — detalhe indisponível", quantity: 1 }];

  const result = await issueRoadWaybill({
    tenantId: input.tenantId,
    shipperId: proposal.shipperId,
    consigneeId: proposal.consigneeId,
    originProvince: input.originProvince,
    destinationProvince: input.destinationProvince,
    vehicleId: input.vehicleId,
    driverId: input.driverId,
    manifestItems,
  });

  if (result.shipmentId) {
    await markDocumentBooked(input.documentId, result.shipmentId);
  }
  return result;
}

export interface FinalizeAirBookingInput {
  documentId: string;
  tenantId: string;
  airlinePrefix: string;
  sequence: number;
  originAirportId: string;
  destinationAirportId: string;
  flightId?: string;
  currency?: IssueAirWaybillInput["currency"];
  incoterm?: string;
}

/** Completa uma reserva AÉREA a partir de um documento confirmado — exige volumes com dimensões completas. */
export async function finalizeAirBookingFromDocument(input: FinalizeAirBookingInput) {
  const proposal = await buildDraftBookingProposal({ documentId: input.documentId, tenantId: input.tenantId });

  if (proposal.pieces.length === 0) {
    throw new ValidationError(
      "Não é possível emitir um AWB sem pelo menos um volume com dimensões completas (comprimento/largura/altura/peso)."
    );
  }
  if (proposal.piecesMissingDimensionsCount > 0) {
    throw new ValidationError(
      `${proposal.piecesMissingDimensionsCount} volume(s) sem dimensões completas — complete manualmente antes de emitir o AWB.`
    );
  }

  const result = await issueAirWaybill({
    tenantId: input.tenantId,
    airlinePrefix: input.airlinePrefix,
    sequence: input.sequence,
    shipperId: proposal.shipperId,
    consigneeId: proposal.consigneeId,
    originAirportId: input.originAirportId,
    destinationAirportId: input.destinationAirportId,
    flightId: input.flightId,
    pieces: proposal.pieces,
    currency: input.currency,
    incoterm: input.incoterm,
  });

  if (result.shipmentId) {
    await markDocumentBooked(input.documentId, result.shipmentId);
  }
  return result;
}
