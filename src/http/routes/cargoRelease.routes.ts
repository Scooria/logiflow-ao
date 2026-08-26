/**
 * Rotas do levantamento de carga aérea de importação (Passo 6) — chegada do
 * ULD, conferência/arrumação, consulta pelo destinatário, pagamento das
 * taxas, carimbo/assinatura e levantamento ou entrega.
 */
import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../asyncHandler";
import {
  breakdownAndStoreAirWaybill,
  collectCargo,
  initiateFeesPayment,
  lookupCargoReleaseByAwbNumber,
  markReadyForPickup,
  registerUldArrival,
  requestDelivery,
} from "../../modules/cargo/cargoRelease.service";

export const cargoReleaseRouter = Router();

const UldArrivalSchema = z.object({
  tenantId: z.string().min(1),
  uldNumber: z.string().min(1),
  type: z.enum(["CONTAINER", "PALLET"]).optional(),
  flightId: z.string().optional(),
  warehouseId: z.string().optional(),
});
cargoReleaseRouter.post(
  "/ulds/arrival",
  asyncHandler(async (req, res) => {
    const input = UldArrivalSchema.parse(req.body);
    const uld = await registerUldArrival(input);
    res.status(200).json(uld);
  })
);

const BreakdownSchema = z.object({
  tenantId: z.string().min(1),
  awbNumber: z.string().min(1),
  storedLocationId: z.string().min(1),
  breakdownByUserId: z.string().min(1),
  uldNumber: z.string().optional(),
});
cargoReleaseRouter.post(
  "/breakdown",
  asyncHandler(async (req, res) => {
    const input = BreakdownSchema.parse(req.body);
    const cargoRelease = await breakdownAndStoreAirWaybill(input);
    res.status(200).json(cargoRelease);
  })
);

const LookupQuerySchema = z.object({ tenantId: z.string().min(1) });
const LookupParamsSchema = z.object({ awbNumber: z.string().min(1) });
cargoReleaseRouter.get(
  "/lookup/:awbNumber",
  asyncHandler(async (req, res) => {
    const { tenantId } = LookupQuerySchema.parse(req.query);
    const { awbNumber } = LookupParamsSchema.parse(req.params);
    const result = await lookupCargoReleaseByAwbNumber(tenantId, awbNumber);
    res.status(200).json(result);
  })
);

const InitiatePaymentSchema = z.object({
  tenantId: z.string().min(1),
  amount: z.number().positive(),
  method: z.enum(["EMIS_REFERENCE", "MCX_EXPRESS"]),
  mcxExpressPhone: z.string().optional(),
});
const CargoReleaseParamsSchema = z.object({ cargoReleaseId: z.string().min(1) });
cargoReleaseRouter.post(
  "/:cargoReleaseId/pay",
  asyncHandler(async (req, res) => {
    const { cargoReleaseId } = CargoReleaseParamsSchema.parse(req.params);
    const input = InitiatePaymentSchema.parse(req.body);
    const transaction = await initiateFeesPayment({ ...input, cargoReleaseId });
    res.status(201).json(transaction);
  })
);

const ReadyForPickupSchema = z.object({
  tenantId: z.string().min(1),
  documentCustodyNotes: z.string().optional(),
});
cargoReleaseRouter.post(
  "/:cargoReleaseId/ready-for-pickup",
  asyncHandler(async (req, res) => {
    const { cargoReleaseId } = CargoReleaseParamsSchema.parse(req.params);
    const input = ReadyForPickupSchema.parse(req.body);
    const cargoRelease = await markReadyForPickup({ ...input, cargoReleaseId });
    res.status(200).json(cargoRelease);
  })
);

const RequestDeliverySchema = z.object({
  tenantId: z.string().min(1),
  deliveryAddress: z.string().min(1),
  deliveryFee: z.number().nonnegative(),
});
cargoReleaseRouter.post(
  "/:cargoReleaseId/request-delivery",
  asyncHandler(async (req, res) => {
    const { cargoReleaseId } = CargoReleaseParamsSchema.parse(req.params);
    const input = RequestDeliverySchema.parse(req.body);
    const cargoRelease = await requestDelivery({ ...input, cargoReleaseId });
    res.status(200).json(cargoRelease);
  })
);

const CollectSchema = z.object({ tenantId: z.string().min(1) });
cargoReleaseRouter.post(
  "/:cargoReleaseId/collect",
  asyncHandler(async (req, res) => {
    const { cargoReleaseId } = CargoReleaseParamsSchema.parse(req.params);
    const input = CollectSchema.parse(req.body);
    const cargoRelease = await collectCargo({ ...input, cargoReleaseId });
    res.status(200).json(cargoRelease);
  })
);
