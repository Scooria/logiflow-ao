/**
 * Emissão de Air Waybill (MAWB/HAWB) com cálculo de peso taxável IATA e
 * construção do payload IATA CargoXML (estrutura simplificada — o schema XML
 * completo XFWB/XFZB deve ser gerado por um serializer dedicado antes de
 * envio real a uma transportadora / ao IATA One Record).
 */
import { AwbType, Currency } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { NotFoundError, ValidationError } from "../../lib/errors";
import { PieceDimensions, summarizeAwbWeights } from "./chargeableWeight";
import { formatAwbNumber } from "./awbNumber";
import { generateShipmentNumber } from "./documentCodes";

export interface IssueAirWaybillInput {
  tenantId: string;
  airlinePrefix: string; // 3 dígitos IATA da companhia aérea
  sequence: number; // próximo número de série disponível para este prefixo (controlado pelo chamador/contador)
  type?: AwbType; // default MASTER
  masterAwbId?: string; // obrigatório quando type = HOUSE
  shipperId: string;
  consigneeId: string;
  originAirportId: string;
  destinationAirportId: string;
  flightId?: string;
  pieces: PieceDimensions[];
  currency?: Currency;
  declaredValueForCarriage?: number;
  declaredValueForCustoms?: number;
  incoterm?: string;
  createShipment?: boolean;
}

export interface IssueAirWaybillResult {
  airWaybillId: string;
  awbNumber: string;
  shipmentId?: string;
  weights: ReturnType<typeof summarizeAwbWeights>;
}

export async function issueAirWaybill(input: IssueAirWaybillInput): Promise<IssueAirWaybillResult> {
  const type = input.type ?? "MASTER";
  if (type === "HOUSE" && !input.masterAwbId) {
    throw new ValidationError("Um HAWB (House Air Waybill) precisa de masterAwbId.");
  }

  const [shipper, consignee, originAirport, destinationAirport] = await Promise.all([
    prisma.party.findFirst({ where: { id: input.shipperId, tenantId: input.tenantId } }),
    prisma.party.findFirst({ where: { id: input.consigneeId, tenantId: input.tenantId } }),
    prisma.airport.findUnique({ where: { id: input.originAirportId } }),
    prisma.airport.findUnique({ where: { id: input.destinationAirportId } }),
  ]);
  if (!shipper) throw new NotFoundError("Party (shipper)", input.shipperId);
  if (!consignee) throw new NotFoundError("Party (consignee)", input.consigneeId);
  if (!originAirport) throw new NotFoundError("Airport (origin)", input.originAirportId);
  if (!destinationAirport) throw new NotFoundError("Airport (destination)", input.destinationAirportId);

  if (type === "HOUSE") {
    const master = await prisma.airWaybill.findFirst({
      where: { id: input.masterAwbId, tenantId: input.tenantId, type: "MASTER" },
    });
    if (!master) throw new NotFoundError("AirWaybill (master)", input.masterAwbId!);
  }

  const weights = summarizeAwbWeights(input.pieces);
  const awbNumber = formatAwbNumber(input.airlinePrefix, input.sequence);
  const currency = input.currency ?? "USD";
  const createShipment = input.createShipment ?? true;
  const shipmentNumber = createShipment ? generateShipmentNumber("AIR") : undefined;

  // Estrutura simplificada alinhada ao IATA CargoXML (mensagem XFWB) — os
  // nomes de campo seguem a nomenclatura do schema oficial de forma
  // resumida; para integração real, gerar o XML completo a partir deste
  // objecto com um serializer dedicado (ex.: biblioteca CargoXML/One Record).
  const cargoXmlPayload = {
    messageType: type === "MASTER" ? "XFWB" : "XFZB",
    waybillNumber: awbNumber,
    origin: originAirport.iataCode,
    destination: destinationAirport.iataCode,
    shipper: { name: shipper.name, nif: shipper.nif },
    consignee: { name: consignee.name, nif: consignee.nif },
    totalPieces: weights.pieces,
    grossWeight: { value: weights.grossWeightKg, unit: "KGM" },
    chargeableWeight: { value: weights.chargeableWeightKg, unit: "KGM" },
    volume: { value: weights.volumeM3, unit: "MTQ" },
  };

  const result = await prisma.$transaction(async (tx) => {
    const awb = await tx.airWaybill.create({
      data: {
        tenantId: input.tenantId,
        awbNumber,
        type,
        masterAwbId: type === "HOUSE" ? input.masterAwbId : undefined,
        shipperId: input.shipperId,
        consigneeId: input.consigneeId,
        originAirportId: input.originAirportId,
        destinationAirportId: input.destinationAirportId,
        flightId: input.flightId,
        pieces: weights.pieces,
        grossWeightKg: weights.grossWeightKg,
        volumeM3: weights.volumeM3,
        chargeableWeightKg: weights.chargeableWeightKg,
        currency,
        declaredValueForCarriage: input.declaredValueForCarriage,
        declaredValueForCustoms: input.declaredValueForCustoms,
        incoterm: input.incoterm,
        status: "BOOKED",
        cargoXmlPayload,
        awbPieces: {
          create: input.pieces.map((p) => ({
            lengthCm: p.lengthCm,
            widthCm: p.widthCm,
            heightCm: p.heightCm,
            grossWeightKg: p.grossWeightKg,
          })),
        },
      },
    });

    let shipmentId: string | undefined;
    if (createShipment && shipmentNumber) {
      const shipment = await tx.shipment.create({
        data: {
          tenantId: input.tenantId,
          shipmentNumber,
          mode: "AIR",
          status: "BOOKED",
          shipperId: input.shipperId,
          consigneeId: input.consigneeId,
          airWaybillId: awb.id,
        },
      });
      shipmentId = shipment.id;

      await tx.trackingEvent.create({
        data: {
          tenantId: input.tenantId,
          shipmentId: shipment.id,
          status: "BOOKED",
          description: `AWB ${awbNumber} emitido (${originAirport.iataCode} -> ${destinationAirport.iataCode}); peso taxável ${weights.chargeableWeightKg} kg.`,
          source: "AIR_WAYBILL_SERVICE",
        },
      });
    }

    return { airWaybillId: awb.id, shipmentId };
  });

  return { ...result, awbNumber, weights };
}
