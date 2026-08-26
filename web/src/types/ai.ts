/**
 * Tipos de domínio para o Document AI e o Copilot (Passo 4) — espelham as
 * respostas dos endpoints /ai/documents/* e /copilot/chat do backend
 * (src/modules/ai/schemas.ts, copilot/tools.ts). Mantidos manualmente em
 * sincronia, tal como types/domain.ts.
 */
import { Province } from "./domain";

export type DocumentType = "INVOICE" | "PACKING_LIST" | "QUOTATION_EMAIL";

export const DOCUMENT_TYPE_LABEL_PT: Record<DocumentType, string> = {
  INVOICE: "Fatura",
  PACKING_LIST: "Packing List",
  QUOTATION_EMAIL: "Email de Cotação",
};

export type DocumentStatus = "PENDING_REVIEW" | "CONFIRMED" | "REJECTED" | "BOOKED";

export const DOCUMENT_STATUS_LABEL_PT: Record<DocumentStatus, string> = {
  PENDING_REVIEW: "Aguarda Revisão",
  CONFIRMED: "Confirmado",
  REJECTED: "Rejeitado",
  BOOKED: "Reserva Criada",
};

export interface InvoiceExtraction {
  invoiceNumber: string | null;
  issueDate: string | null;
  sellerName: string | null;
  sellerNif: string | null;
  buyerName: string | null;
  buyerNif: string | null;
  currency: string | null;
  totalAmount: number | null;
  lineItems: Array<{ description: string; quantity: number | null; unitPrice: number | null }>;
  confidence: number;
  needsReview: boolean;
  notes: string | null;
}

export interface PackingListExtraction {
  referenceNumber: string | null;
  shipperName: string | null;
  consigneeName: string | null;
  pieces: Array<{
    description: string;
    quantity: number;
    lengthCm: number | null;
    widthCm: number | null;
    heightCm: number | null;
    grossWeightKg: number | null;
  }>;
  totalGrossWeightKg: number | null;
  confidence: number;
  needsReview: boolean;
  notes: string | null;
}

export interface QuotationEmailExtraction {
  requestedMode: "AIR" | "ROAD" | "UNKNOWN";
  originProvince: Province | null;
  destinationProvince: Province | null;
  requesterName: string | null;
  requesterCompany: string | null;
  cargoDescription: string | null;
  approxWeightKg: number | null;
  targetDate: string | null;
  confidence: number;
  needsReview: boolean;
  notes: string | null;
}

export type ExtractionPayload = InvoiceExtraction | PackingListExtraction | QuotationEmailExtraction;

export interface IngestedDocument {
  id: string;
  tenantId: string;
  type: DocumentType;
  status: DocumentStatus;
  sourceFileName: string | null;
  extractedPayload: ExtractionPayload;
  confidenceScore: number;
  modelUsed: string | null;
  createdAt: string;
}

export interface DraftBookingProposal {
  documentId: string;
  suggestedMode: "AIR" | "ROAD" | "UNKNOWN";
  shipperName: string | null;
  consigneeName: string | null;
  originProvince: Province | null;
  destinationProvince: Province | null;
  pieceCount: number;
  totalGrossWeightKg: number | null;
  chargeableWeightKg: number | null;
  missingFields: string[];
}

// --- Copilot -----------------------------------------------------------------

export interface CopilotChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CopilotToolCall {
  name: string;
  input: Record<string, unknown>;
  result: unknown;
}

export interface CopilotTurnResult {
  reply: string;
  actions: CopilotToolCall[];
  truncated: boolean;
}
