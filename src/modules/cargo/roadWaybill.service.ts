/**
 * Emissão de Guias de Transporte Rodoviário para as 21 províncias de Angola,
 * incluindo cálculo de rota (routeEngine.ts), manifesto de carga e criação
 * opcional do Shipment "guarda-chuva" com o primeiro evento de tracking.
 */
import { Province } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { NotFoundError, ValidationError } from "../../lib/errors";
import { findRoute, RouteResult } from "./routeEngine";
import { generateRoadGuideNumber, computeLocalAgtValidationCode, generateShipmentNumber } from "./documentCodes";

export interface ManifestItemInput {
  itemId?: string;
  description: string;
  quantity: number;
  weightKg?: number;
}

export interface IssueRoadWaybillInput {
  tenantId: string;
  shipperId: string;
  consigneeId: string;
  originProvince: Province;
  destinationProvince: Province;
  vehicleId: string;
  driverId: string;
  manifestItems: ManifestItemInput[];
  /** Se fornecido, o Shipment fica ligado a este armazém de origem/destino. */
  originWarehouseId?: string;
  destinationWarehouseId?: string;
  /** Cria também o Shipment guarda-chuva multimodal (default: true). */
  createShipment?: boolean;
}

export interface IssueRoadWaybillResult {
  roadWaybillId: string;
  guideNumber: string;
  shipmentId?: string;
  route: RouteResult;
}

async function assertPartyBelongsToTenant(tenantId: string, partyId: string, label: string) {
  const party = await prisma.party.findFirst({ where: { id: partyId, tenantId } });
  if (!party) throw new NotFoundError(label, partyId);
}

export async function issueRoadWaybill(input: IssueRoadWaybillInput): Promise<IssueRoadWaybillResult> {
  if (input.manifestItems.length === 0) {
    throw new ValidationError("O manifesto de carga precisa de pelo menos um item.");
  }

  await assertPartyBelongsToTenant(input.tenantId, input.shipperId, "Party (shipper)");
  await assertPartyBelongsToTenant(input.tenantId, input.consigneeId, "Party (consignee)");

  const [vehicle, driver] = await Promise.all([
    prisma.vehicle.findFirst({ where: { id: input.vehicleId, tenantId: input.tenantId } }),
    prisma.driver.findFirst({ where: { id: input.driverId, tenantId: input.tenantId } }),
  ]);
  if (!vehicle) throw new NotFoundError("Vehicle", input.vehicleId);
  if (!driver) throw new NotFoundError("Driver", input.driverId);

  const route = await findRoute(input.tenantId, input.originProvince, input.destinationProvince);

  const totalWeightKg = input.manifestItems.reduce((sum, i) => sum + (i.weightKg ?? 0), 0);
  const guideNumber = generateRoadGuideNumber(input.originProvince, input.destinationProvince);
  const agtValidationCode = computeLocalAgtValidationCode({
    guideNumber,
    tenantId: input.tenantId,
    shipperId: input.shipperId,
    consigneeId: input.consigneeId,
    totalWeightKg,
  });

  const createShipment = input.createShipment ?? true;
  const shipmentNumber = createShipment ? generateShipmentNumber("ROAD") : undefined;

  const result = await prisma.$transaction(async (tx) => {
    const roadWaybill = await tx.roadWaybill.create({
      data: {
        tenantId: input.tenantId,
        guideNumber,
        shipperId: input.shipperId,
        consigneeId: input.consigneeId,
        originProvince: input.originProvince,
        destinationProvince: input.destinationProvince,
        routeId: route.hops.find((h) => h.roadRouteId)?.roadRouteId,
        vehicleId: input.vehicleId,
        driverId: input.driverId,
        totalWeightKg: totalWeightKg > 0 ? totalWeightKg : undefined,
        status: "BOOKED",
        agtValidationCode,
      },
    });

    await tx.cargoManifest.create({
      data: {
        roadWaybillId: roadWaybill.id,
        items: {
          create: input.manifestItems.map((item) => ({
            itemId: item.itemId,
            description: item.description,
            quantity: item.quantity,
            weightKg: item.weightKg,
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
          mode: "ROAD",
          status: "BOOKED",
          shipperId: input.shipperId,
          consigneeId: input.consigneeId,
          originWarehouseId: input.originWarehouseId,
          destinationWarehouseId: input.destinationWarehouseId,
          roadWaybillId: roadWaybill.id,
        },
      });
      shipmentId = shipment.id;

      await tx.trackingEvent.create({
        data: {
          tenantId: input.tenantId,
          shipmentId: shipment.id,
          status: "BOOKED",
          province: input.originProvince,
          description: `Guia de Transporte Rodoviário ${guideNumber} emitida (${route.source === "SEED_ESTIMATE" ? "rota estimada" : "rota validada"}: ${route.totalDistanceKm} km, ~${route.totalEstimatedHours}h).`,
          source: "ROAD_WAYBILL_SERVICE",
        },
      });
    }

    return { roadWaybillId: roadWaybill.id, shipmentId };
  });

  return { ...result, guideNumber, route };
}
