import { Router } from "express";
import { z } from "zod";
import { PROVINCE_CODE } from "../../config/provinces";
import { findRoute } from "../../modules/cargo/routeEngine";
import { issueRoadWaybill } from "../../modules/cargo/roadWaybill.service";
import { issueAirWaybill } from "../../modules/cargo/airWaybill.service";
import { asyncHandler } from "../asyncHandler";

export const cargoRouter = Router();

const ProvinceSchema = z.enum(Object.keys(PROVINCE_CODE) as [string, ...string[]]);

const RouteQuerySchema = z.object({
  tenantId: z.string().min(1),
  origin: ProvinceSchema,
  destination: ProvinceSchema,
});
cargoRouter.get(
  "/routes",
  asyncHandler(async (req, res) => {
    const { tenantId, origin, destination } = RouteQuerySchema.parse(req.query);
    const route = await findRoute(tenantId, origin as never, destination as never);
    res.status(200).json(route);
  })
);

const ManifestItemSchema = z.object({
  itemId: z.string().optional(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  weightKg: z.number().positive().optional(),
});
const RoadWaybillSchema = z.object({
  tenantId: z.string().min(1),
  shipperId: z.string().min(1),
  consigneeId: z.string().min(1),
  originProvince: ProvinceSchema,
  destinationProvince: ProvinceSchema,
  vehicleId: z.string().min(1),
  driverId: z.string().min(1),
  manifestItems: z.array(ManifestItemSchema).min(1),
  originWarehouseId: z.string().optional(),
  destinationWarehouseId: z.string().optional(),
  createShipment: z.boolean().optional(),
});
cargoRouter.post(
  "/road-waybills",
  asyncHandler(async (req, res) => {
    const input = RoadWaybillSchema.parse(req.body);
    const result = await issueRoadWaybill(input as never);
    res.status(201).json(result);
  })
);

const PieceSchema = z.object({
  lengthCm: z.number().positive(),
  widthCm: z.number().positive(),
  heightCm: z.number().positive(),
  grossWeightKg: z.number().positive(),
});
const AirWaybillSchema = z.object({
  tenantId: z.string().min(1),
  airlinePrefix: z.string().regex(/^\d{3}$/),
  sequence: z.number().int().positive(),
  type: z.enum(["MASTER", "HOUSE"]).optional(),
  masterAwbId: z.string().optional(),
  shipperId: z.string().min(1),
  consigneeId: z.string().min(1),
  originAirportId: z.string().min(1),
  destinationAirportId: z.string().min(1),
  flightId: z.string().optional(),
  pieces: z.array(PieceSchema).min(1),
  currency: z.enum(["AOA", "USD", "EUR", "ZAR"]).optional(),
  declaredValueForCarriage: z.number().nonnegative().optional(),
  declaredValueForCustoms: z.number().nonnegative().optional(),
  incoterm: z.string().optional(),
  createShipment: z.boolean().optional(),
});
cargoRouter.post(
  "/air-waybills",
  asyncHandler(async (req, res) => {
    const input = AirWaybillSchema.parse(req.body);
    const result = await issueAirWaybill(input as never);
    res.status(201).json(result);
  })
);
