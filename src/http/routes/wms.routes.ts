import { Router } from "express";
import { z } from "zod";
import {
  computeAndPersistLocationAddress,
  recomputeWarehouseAddresses,
} from "../../modules/wms/addressing";
import {
  generateItemBarcode,
  generateLocationBarcode,
  generateCompositeQrCode,
  registerBarcodeScan,
} from "../../modules/wms/barcode";
import { asyncHandler } from "../asyncHandler";
import { prisma } from "../../lib/prisma";

export const wmsRouter = Router();

/**
 * Mapa completo do armazém (zonas -> racks -> prateleiras -> posições),
 * com a ocupação de cada posição (soma das quantidades de StockItem), no
 * formato consumido pelo Painel WMS do frontend (Passo 3/5). Ver
 * web/src/lib/mockData.ts (MOCK_WAREHOUSE) para o mesmo formato em modo
 * demonstração.
 */
const WarehouseMapParamsSchema = z.object({ warehouseId: z.string().min(1) });
wmsRouter.get(
  "/warehouses/:warehouseId/map",
  asyncHandler(async (req, res) => {
    const { warehouseId } = WarehouseMapParamsSchema.parse(req.params);
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouseId },
      include: {
        zones: {
          include: {
            racks: {
              include: {
                shelves: {
                  include: {
                    locations: {
                      include: { stockItems: { include: { item: true, batch: true } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!warehouse) {
      res.status(404).json({ error: "NOT_FOUND", message: "Armazém não encontrado." });
      return;
    }

    res.status(200).json({
      id: warehouse.id,
      code: warehouse.code,
      name: warehouse.name,
      province: warehouse.province,
      zones: warehouse.zones.map((zone) => ({
        id: zone.id,
        code: zone.code,
        name: zone.name,
        type: zone.type,
        racks: zone.racks.map((rack) => ({
          id: rack.id,
          code: rack.code,
          shelves: rack.shelves.map((shelf) => ({
            id: shelf.id,
            code: shelf.code,
            positions: shelf.locations.map((location) => ({
              id: location.id,
              code: location.code,
              uniqueAddress: location.uniqueAddress,
              capacityUnits: location.capacityUnits,
              occupiedUnits: location.stockItems.reduce((sum, si) => sum + Number(si.quantity), 0),
              stockItems: location.stockItems.map((si) => ({
                id: si.id,
                itemName: si.item.name,
                sku: si.item.sku,
                batchNumber: si.batch?.batchNumber,
                expiryDate: si.batch?.expiryDate?.toISOString(),
                quantity: Number(si.quantity),
              })),
            })),
          })),
        })),
      })),
    });
  })
);

const AddressParamsSchema = z.object({ locationId: z.string().min(1) });
wmsRouter.post(
  "/locations/:locationId/address",
  asyncHandler(async (req, res) => {
    const { locationId } = AddressParamsSchema.parse(req.params);
    const location = await computeAndPersistLocationAddress(locationId);
    res.status(200).json(location);
  })
);

const RecomputeParamsSchema = z.object({ warehouseId: z.string().min(1) });
wmsRouter.post(
  "/warehouses/:warehouseId/recompute-addresses",
  asyncHandler(async (req, res) => {
    const { warehouseId } = RecomputeParamsSchema.parse(req.params);
    const updated = await recomputeWarehouseAddresses(warehouseId);
    res.status(200).json({ updated });
  })
);

const ItemBarcodeSchema = z.object({
  tenantId: z.string().min(1),
  itemId: z.string().min(1),
  batchId: z.string().min(1).optional(),
  gtin14: z.string().length(14).optional(),
});
wmsRouter.post(
  "/barcodes/item",
  asyncHandler(async (req, res) => {
    const input = ItemBarcodeSchema.parse(req.body);
    const result = await generateItemBarcode(input);
    res.status(201).json(result);
  })
);

const LocationBarcodeSchema = z.object({
  tenantId: z.string().min(1),
  locationId: z.string().min(1),
});
wmsRouter.post(
  "/barcodes/location",
  asyncHandler(async (req, res) => {
    const input = LocationBarcodeSchema.parse(req.body);
    const result = await generateLocationBarcode(input);
    res.status(201).json(result);
  })
);

const QrCodeSchema = z.object({
  tenantId: z.string().min(1),
  itemId: z.string().min(1),
  batchId: z.string().min(1).optional(),
  locationId: z.string().min(1).optional(),
});
wmsRouter.post(
  "/barcodes/qr",
  asyncHandler(async (req, res) => {
    const input = QrCodeSchema.parse(req.body);
    const result = await generateCompositeQrCode(input);
    res.status(201).json(result);
  })
);

const ScanSchema = z.object({
  tenantId: z.string().min(1),
  barcodeValue: z.string().min(1),
  action: z.enum(["INBOUND", "OUTBOUND", "TRANSFER", "CYCLE_COUNT", "PICK", "PUTAWAY"]),
  scannedByUserId: z.string().min(1),
  deviceId: z.string().optional(),
});
wmsRouter.post(
  "/scan",
  asyncHandler(async (req, res) => {
    const input = ScanSchema.parse(req.body);
    const barcode = await registerBarcodeScan(input);
    res.status(200).json(barcode);
  })
);
