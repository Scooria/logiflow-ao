/**
 * Formas de extração estruturada para os 3 tipos de documento do Passo 4.
 *
 * Cada tipo tem um par (Zod schema, JSON Schema): o Zod schema valida e tipa
 * a resposta no lado do servidor; o JSON Schema é o `input_schema` da
 * ferramenta Anthropic que força o modelo a produzir exactamente esta forma
 * (ver anthropicClient.ts). Os dois têm de se manter em sincronia — mantidos
 * lado a lado no mesmo ficheiro para facilitar isso.
 *
 * Todos os schemas incluem `confidence` (0–1, auto-reportado pelo modelo) e
 * `needsReview` — o extrator NUNCA decide sozinho que um documento está
 * "suficientemente bom"; isso fica ao critério do fluxo de revisão humana
 * (ver bookingAutomation.ts).
 */
import { z } from "zod";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";

const PROVINCE_VALUES = [
  "LUANDA", "BENGO", "BENGUELA", "BIE", "CABINDA", "CUANDO_CUBANGO",
  "CUANZA_NORTE", "CUANZA_SUL", "CUNENE", "HUAMBO", "HUILA",
  "LUNDA_NORTE", "LUNDA_SUL", "MALANJE", "MOXICO", "NAMIBE", "UIGE",
  "ZAIRE", "ICOLO_E_BENGO", "MOXICO_LESTE", "CUANDO",
] as const;

const ConfidenceFields = {
  confidence: z.number().min(0).max(1),
  needsReview: z.boolean(),
  notes: z.string().optional(),
};
const confidenceProperties = {
  confidence: {
    type: "number",
    minimum: 0,
    maximum: 1,
    description: "Confiança do modelo na extração global, de 0 a 1.",
  },
  needsReview: {
    type: "boolean",
    description: "true se algum campo estiver ambíguo, ilegível ou incompleto e exigir revisão humana.",
  },
  notes: {
    type: "string",
    description: "Observações curtas sobre ambiguidades encontradas (opcional).",
  },
};

// ---------------------------------------------------------------------------
// FATURA (Invoice)
// ---------------------------------------------------------------------------

export const InvoiceLineSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  lineTotal: z.number(),
});

export const InvoiceExtractionSchema = z.object({
  invoiceNumber: z.string().nullable(),
  issueDate: z.string().nullable().describe("Formato ISO 8601 (AAAA-MM-DD), quando identificável."),
  currency: z.enum(["AOA", "USD", "EUR", "ZAR"]).nullable(),
  sellerName: z.string().nullable(),
  sellerNif: z.string().nullable(),
  buyerName: z.string().nullable(),
  buyerNif: z.string().nullable(),
  subtotal: z.number().nullable(),
  ivaRate: z.number().nullable(),
  ivaAmount: z.number().nullable(),
  totalAmount: z.number().nullable(),
  lineItems: z.array(InvoiceLineSchema),
  ...ConfidenceFields,
});
export type InvoiceExtraction = z.infer<typeof InvoiceExtractionSchema>;

export const INVOICE_EXTRACTION_TOOL: Tool = {
  name: "record_invoice_extraction",
  description:
    "Regista os dados estruturados extraídos de uma fatura (nacional ou internacional).",
  input_schema: {
    type: "object",
    properties: {
      invoiceNumber: { type: ["string", "null"] },
      issueDate: { type: ["string", "null"], description: "AAAA-MM-DD" },
      currency: { type: ["string", "null"], enum: ["AOA", "USD", "EUR", "ZAR", null] },
      sellerName: { type: ["string", "null"] },
      sellerNif: { type: ["string", "null"] },
      buyerName: { type: ["string", "null"] },
      buyerNif: { type: ["string", "null"] },
      subtotal: { type: ["number", "null"] },
      ivaRate: { type: ["number", "null"], description: "Ex.: 0.14 para 14%." },
      ivaAmount: { type: ["number", "null"] },
      totalAmount: { type: ["number", "null"] },
      lineItems: {
        type: "array",
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            quantity: { type: "number" },
            unitPrice: { type: "number" },
            lineTotal: { type: "number" },
          },
          required: ["description", "quantity", "unitPrice", "lineTotal"],
        },
      },
      ...confidenceProperties,
    },
    required: [
      "invoiceNumber", "issueDate", "currency", "sellerName", "sellerNif",
      "buyerName", "buyerNif", "subtotal", "ivaRate", "ivaAmount", "totalAmount",
      "lineItems", "confidence", "needsReview",
    ],
  },
};

// ---------------------------------------------------------------------------
// LISTA DE EMBARQUE (Packing List)
// ---------------------------------------------------------------------------

export const PackingListPieceSchema = z.object({
  description: z.string(),
  quantity: z.number().positive(),
  lengthCm: z.number().positive().nullable(),
  widthCm: z.number().positive().nullable(),
  heightCm: z.number().positive().nullable(),
  grossWeightKg: z.number().positive().nullable(),
});

export const PackingListExtractionSchema = z.object({
  shipperName: z.string().nullable(),
  shipperNif: z.string().nullable(),
  consigneeName: z.string().nullable(),
  consigneeNif: z.string().nullable(),
  originHint: z.string().nullable().describe("Texto livre de origem tal como aparece no documento."),
  destinationHint: z.string().nullable(),
  pieces: z.array(PackingListPieceSchema),
  totalGrossWeightKg: z.number().nullable(),
  ...ConfidenceFields,
});
export type PackingListExtraction = z.infer<typeof PackingListExtractionSchema>;

export const PACKING_LIST_EXTRACTION_TOOL: Tool = {
  name: "record_packing_list_extraction",
  description:
    "Regista os dados estruturados extraídos de uma lista de embarque (packing list), " +
    "incluindo um volume/peça por linha física de carga (não por SKU) sempre que o " +
    "documento tiver dimensões por volume.",
  input_schema: {
    type: "object",
    properties: {
      shipperName: { type: ["string", "null"] },
      shipperNif: { type: ["string", "null"] },
      consigneeName: { type: ["string", "null"] },
      consigneeNif: { type: ["string", "null"] },
      originHint: { type: ["string", "null"] },
      destinationHint: { type: ["string", "null"] },
      pieces: {
        type: "array",
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            quantity: { type: "number" },
            lengthCm: { type: ["number", "null"] },
            widthCm: { type: ["number", "null"] },
            heightCm: { type: ["number", "null"] },
            grossWeightKg: { type: ["number", "null"] },
          },
          required: ["description", "quantity", "lengthCm", "widthCm", "heightCm", "grossWeightKg"],
        },
      },
      totalGrossWeightKg: { type: ["number", "null"] },
      ...confidenceProperties,
    },
    required: [
      "shipperName", "shipperNif", "consigneeName", "consigneeNif", "originHint",
      "destinationHint", "pieces", "totalGrossWeightKg", "confidence", "needsReview",
    ],
  },
};

// ---------------------------------------------------------------------------
// E-MAIL DE COTAÇÃO (Quotation Email)
// ---------------------------------------------------------------------------

export const QuotationEmailExtractionSchema = z.object({
  requestedMode: z.enum(["AIR", "ROAD", "UNKNOWN"]),
  originText: z.string().nullable(),
  destinationText: z.string().nullable(),
  originProvince: z.enum(PROVINCE_VALUES).nullable(),
  destinationProvince: z.enum(PROVINCE_VALUES).nullable(),
  cargoDescription: z.string().nullable(),
  estimatedWeightKg: z.number().nullable(),
  estimatedVolumeM3: z.number().nullable(),
  incoterm: z.string().nullable(),
  requestedPickupDate: z.string().nullable().describe("ISO 8601 quando identificável."),
  contactName: z.string().nullable(),
  contactEmail: z.string().nullable(),
  contactPhone: z.string().nullable(),
  ...ConfidenceFields,
});
export type QuotationEmailExtraction = z.infer<typeof QuotationEmailExtractionSchema>;

export const QUOTATION_EMAIL_EXTRACTION_TOOL: Tool = {
  name: "record_quotation_email_extraction",
  description:
    "Regista o pedido de cotação estruturado extraído de um e-mail de cliente, para " +
    "automatizar o início de uma reserva.",
  input_schema: {
    type: "object",
    properties: {
      requestedMode: { type: "string", enum: ["AIR", "ROAD", "UNKNOWN"] },
      originText: { type: ["string", "null"] },
      destinationText: { type: ["string", "null"] },
      originProvince: { type: ["string", "null"], enum: [...PROVINCE_VALUES, null] },
      destinationProvince: { type: ["string", "null"], enum: [...PROVINCE_VALUES, null] },
      cargoDescription: { type: ["string", "null"] },
      estimatedWeightKg: { type: ["number", "null"] },
      estimatedVolumeM3: { type: ["number", "null"] },
      incoterm: { type: ["string", "null"] },
      requestedPickupDate: { type: ["string", "null"] },
      contactName: { type: ["string", "null"] },
      contactEmail: { type: ["string", "null"] },
      contactPhone: { type: ["string", "null"] },
      ...confidenceProperties,
    },
    required: [
      "requestedMode", "originText", "destinationText", "originProvince", "destinationProvince",
      "cargoDescription", "estimatedWeightKg", "estimatedVolumeM3", "incoterm",
      "requestedPickupDate", "contactName", "contactEmail", "contactPhone",
      "confidence", "needsReview",
    ],
  },
};
