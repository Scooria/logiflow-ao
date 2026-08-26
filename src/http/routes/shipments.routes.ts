import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../asyncHandler";
import { prisma } from "../../lib/prisma";

/**
 * Leitura consolidada de expedições e rastreamento — o que falta ao Passo 2
 * (que só tinha endpoints de escrita: POST /cargo/road-waybills e
 * POST /cargo/air-waybills) para alimentar o Dashboard e a tabela de Envios
 * do frontend (Passo 3/5). Ver web/src/lib/mockData.ts (MOCK_SHIPMENTS,
 * MOCK_TRACKING_EVENTS) para o mesmo formato em modo demonstração.
 */
export const shipmentsRouter = Router();

const ShipmentsQuerySchema = z.object({
  tenantId: z.string().min(1),
  mode: z.enum(["AIR", "ROAD", "MULTIMODAL"]).optional(),
  status: z
    .enum([
      "DRAFT", "BOOKED", "PICKED_UP", "IN_TRANSIT", "CUSTOMS_HOLD", "CUSTOMS_CLEARED",
      "ARRIVED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURNED",
    ])
    .optional(),
});

shipmentsRouter.get(
  "/shipments",
  asyncHandler(async (req, res) => {
    const { tenantId, mode, status } = ShipmentsQuerySchema.parse(req.query);
    const shipments = await prisma.shipment.findMany({
      where: { tenantId, ...(mode ? { mode } : {}), ...(status ? { status } : {}) },
      include: {
        shipper: true,
        consignee: true,
        airWaybill: { include: { originAirport: true, destinationAirport: true } },
        roadWaybill: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    res.status(200).json(
      shipments.map((s) => ({
        id: s.id,
        shipmentNumber: s.shipmentNumber,
        mode: s.mode,
        status: s.status,
        shipperName: s.shipper.name,
        consigneeName: s.consignee.name,
        originProvince: s.roadWaybill?.originProvince,
        destinationProvince: s.roadWaybill?.destinationProvince,
        originAirportCode: s.airWaybill?.originAirport?.iataCode,
        destinationAirportCode: s.airWaybill?.destinationAirport?.iataCode,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      }))
    );
  })
);

const TrackingQuerySchema = z.object({
  tenantId: z.string().min(1),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

shipmentsRouter.get(
  "/tracking-events",
  asyncHandler(async (req, res) => {
    const { tenantId, limit } = TrackingQuerySchema.parse(req.query);
    const events = await prisma.trackingEvent.findMany({
      where: { tenantId },
      include: { shipment: { select: { shipmentNumber: true } } },
      orderBy: { occurredAt: "desc" },
      take: limit ?? 20,
    });

    res.status(200).json(
      events.map((e) => ({
        id: e.id,
        shipmentId: e.shipmentId,
        shipmentNumber: e.shipment.shipmentNumber,
        status: e.status,
        location: e.location ?? undefined,
        province: e.province ?? undefined,
        description: e.description ?? undefined,
        source: e.source ?? undefined,
        occurredAt: e.occurredAt.toISOString(),
      }))
    );
  })
);
