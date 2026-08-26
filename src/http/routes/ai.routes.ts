import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../asyncHandler";
import {
  extractInvoiceFromPdf,
  extractPackingListFromPdf,
  extractQuotationFromEmail,
} from "../../modules/ai/extraction.service";
import {
  buildDraftBookingProposal,
  finalizeAirBookingFromDocument,
  finalizeRoadBookingFromDocument,
  reviewIngestedDocument,
} from "../../modules/ai/bookingAutomation";
import { PROVINCE_CODE } from "../../config/provinces";

export const aiRouter = Router();

const ProvinceSchema = z.enum(Object.keys(PROVINCE_CODE) as [string, ...string[]]);

// Express 5 tipa `req.params[x]` como `string | string[]` (para acomodar segmentos
// repetidos como `:id*`) — esta rota nunca usa esse padrão, por isso validamos com
// Zod para recuperar um `string` simples em vez de fazer cast às cegas.
const DocumentIdParamSchema = z.object({ documentId: z.string().min(1) });

// --- Extração --------------------------------------------------------------

const InvoiceUploadSchema = z.object({
  tenantId: z.string().min(1),
  base64Pdf: z.string().min(1),
  fileName: z.string().optional(),
});
aiRouter.post(
  "/documents/invoice",
  asyncHandler(async (req, res) => {
    const input = InvoiceUploadSchema.parse(req.body);
    const result = await extractInvoiceFromPdf(input);
    res.status(201).json(result);
  })
);

const PackingListUploadSchema = InvoiceUploadSchema;
aiRouter.post(
  "/documents/packing-list",
  asyncHandler(async (req, res) => {
    const input = PackingListUploadSchema.parse(req.body);
    const result = await extractPackingListFromPdf(input);
    res.status(201).json(result);
  })
);

const QuotationEmailSchema = z.object({
  tenantId: z.string().min(1),
  emailText: z.string().min(1),
  subject: z.string().optional(),
});
aiRouter.post(
  "/documents/quotation-email",
  asyncHandler(async (req, res) => {
    const input = QuotationEmailSchema.parse(req.body);
    const result = await extractQuotationFromEmail(input);
    res.status(201).json(result);
  })
);

// --- Revisão humana ----------------------------------------------------------

const ReviewSchema = z.object({
  tenantId: z.string().min(1),
  action: z.enum(["CONFIRM", "REJECT"]),
  reviewedByUserId: z.string().min(1),
  reviewNotes: z.string().optional(),
});
aiRouter.post(
  "/documents/:documentId/review",
  asyncHandler(async (req, res) => {
    const { documentId } = DocumentIdParamSchema.parse(req.params);
    const input = ReviewSchema.parse(req.body);
    const result = await reviewIngestedDocument({ documentId, ...input });
    res.status(200).json(result);
  })
);

const ProposalQuerySchema = z.object({ tenantId: z.string().min(1) });
aiRouter.get(
  "/documents/:documentId/proposal",
  asyncHandler(async (req, res) => {
    const { documentId } = DocumentIdParamSchema.parse(req.params);
    const { tenantId } = ProposalQuerySchema.parse(req.query);
    const proposal = await buildDraftBookingProposal({ documentId, tenantId });
    res.status(200).json(proposal);
  })
);

// --- Finalização da reserva ---------------------------------------------------

const FinalizeRoadSchema = z.object({
  tenantId: z.string().min(1),
  originProvince: ProvinceSchema,
  destinationProvince: ProvinceSchema,
  vehicleId: z.string().min(1),
  driverId: z.string().min(1),
});
aiRouter.post(
  "/documents/:documentId/finalize-road",
  asyncHandler(async (req, res) => {
    const { documentId } = DocumentIdParamSchema.parse(req.params);
    const input = FinalizeRoadSchema.parse(req.body);
    const result = await finalizeRoadBookingFromDocument({ documentId, ...input } as never);
    res.status(201).json(result);
  })
);

const FinalizeAirSchema = z.object({
  tenantId: z.string().min(1),
  airlinePrefix: z.string().regex(/^\d{3}$/),
  sequence: z.number().int().positive(),
  originAirportId: z.string().min(1),
  destinationAirportId: z.string().min(1),
  flightId: z.string().optional(),
  currency: z.enum(["AOA", "USD", "EUR", "ZAR"]).optional(),
  incoterm: z.string().optional(),
});
aiRouter.post(
  "/documents/:documentId/finalize-air",
  asyncHandler(async (req, res) => {
    const { documentId } = DocumentIdParamSchema.parse(req.params);
    const input = FinalizeAirSchema.parse(req.body);
    const result = await finalizeAirBookingFromDocument({ documentId, ...input } as never);
    res.status(201).json(result);
  })
);
