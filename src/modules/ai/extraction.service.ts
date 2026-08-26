/**
 * Serviços de extração Document AI — Faturas, Packing Lists e e-mails de
 * cotação. Cada função chama o Claude com tool-use forçado (ver
 * anthropicClient.ts), valida o resultado e persiste um `IngestedDocument`
 * em estado PENDING_REVIEW. Nenhuma destas funções cria reservas — isso é
 * responsabilidade explícita de bookingAutomation.ts, só depois de um
 * humano confirmar a extração.
 */
import { prisma } from "../../lib/prisma";
import { extractStructured } from "./anthropicClient";
import {
  InvoiceExtraction,
  InvoiceExtractionSchema,
  INVOICE_EXTRACTION_TOOL,
  PackingListExtraction,
  PackingListExtractionSchema,
  PACKING_LIST_EXTRACTION_TOOL,
  QuotationEmailExtraction,
  QuotationEmailExtractionSchema,
  QUOTATION_EMAIL_EXTRACTION_TOOL,
} from "./schemas";

const RAW_EXCERPT_MAX_CHARS = 2000;

async function persistIngestedDocument(params: {
  tenantId: string;
  type: "INVOICE" | "PACKING_LIST" | "QUOTATION_EMAIL";
  sourceFileName?: string;
  sourceMimeType?: string;
  rawTextExcerpt?: string;
  extractedPayload: object;
  confidenceScore: number;
  modelUsed: string;
}) {
  return prisma.ingestedDocument.create({
    data: {
      tenantId: params.tenantId,
      type: params.type,
      status: "PENDING_REVIEW",
      sourceFileName: params.sourceFileName,
      sourceMimeType: params.sourceMimeType,
      rawTextExcerpt: params.rawTextExcerpt?.slice(0, RAW_EXCERPT_MAX_CHARS),
      extractedPayload: params.extractedPayload,
      confidenceScore: params.confidenceScore,
      modelUsed: params.modelUsed,
    },
  });
}

const INVOICE_SYSTEM_PROMPT =
  "És um assistente de extração de dados para uma plataforma de logística angolana. " +
  "Extrai apenas o que está explicitamente no documento — nunca inventes valores. " +
  "Quando um campo não estiver presente ou for ilegível, devolve null nesse campo " +
  "e marca needsReview=true.";

export async function extractInvoiceFromPdf(params: {
  tenantId: string;
  base64Pdf: string;
  fileName?: string;
}): Promise<{ record: Awaited<ReturnType<typeof persistIngestedDocument>>; extraction: InvoiceExtraction }> {
  const { data, modelUsed } = await extractStructured<InvoiceExtraction>({
    systemPrompt: INVOICE_SYSTEM_PROMPT,
    userInstruction:
      "Extrai os dados estruturados desta fatura usando a ferramenta record_invoice_extraction.",
    source: { base64Pdf: params.base64Pdf },
    tool: INVOICE_EXTRACTION_TOOL,
    zodSchema: InvoiceExtractionSchema,
  });

  const record = await persistIngestedDocument({
    tenantId: params.tenantId,
    type: "INVOICE",
    sourceFileName: params.fileName,
    sourceMimeType: "application/pdf",
    rawTextExcerpt: data.notes,
    extractedPayload: data,
    confidenceScore: data.confidence,
    modelUsed,
  });

  return { record, extraction: data };
}

export async function extractPackingListFromPdf(params: {
  tenantId: string;
  base64Pdf: string;
  fileName?: string;
}): Promise<{ record: Awaited<ReturnType<typeof persistIngestedDocument>>; extraction: PackingListExtraction }> {
  const { data, modelUsed } = await extractStructured<PackingListExtraction>({
    systemPrompt: INVOICE_SYSTEM_PROMPT,
    userInstruction:
      "Extrai os dados estruturados desta lista de embarque (packing list) usando a " +
      "ferramenta record_packing_list_extraction. Um 'piece' corresponde a um volume " +
      "físico (caixa/palete/fardo) — se o documento só indicar totais por SKU sem " +
      "dimensões por volume, usa quantity=1 por linha e deixa lengthCm/widthCm/heightCm " +
      "a null.",
    source: { base64Pdf: params.base64Pdf },
    tool: PACKING_LIST_EXTRACTION_TOOL,
    zodSchema: PackingListExtractionSchema,
  });

  const record = await persistIngestedDocument({
    tenantId: params.tenantId,
    type: "PACKING_LIST",
    sourceFileName: params.fileName,
    sourceMimeType: "application/pdf",
    rawTextExcerpt: data.notes,
    extractedPayload: data,
    confidenceScore: data.confidence,
    modelUsed,
  });

  return { record, extraction: data };
}

export async function extractQuotationFromEmail(params: {
  tenantId: string;
  emailText: string;
  subject?: string;
}): Promise<{ record: Awaited<ReturnType<typeof persistIngestedDocument>>; extraction: QuotationEmailExtraction }> {
  const fullText = params.subject ? `Assunto: ${params.subject}\n\n${params.emailText}` : params.emailText;

  const { data, modelUsed } = await extractStructured<QuotationEmailExtraction>({
    systemPrompt:
      INVOICE_SYSTEM_PROMPT +
      " Este documento é um e-mail de pedido de cotação de frete — identifica o modo " +
      "pretendido (aéreo/terrestre), origem/destino e, quando a origem ou destino for uma " +
      "localidade em Angola, tenta mapear para uma das 21 províncias oficiais.",
    userInstruction:
      "Extrai o pedido de cotação estruturado deste e-mail usando a ferramenta " +
      "record_quotation_email_extraction.",
    source: { text: fullText },
    tool: QUOTATION_EMAIL_EXTRACTION_TOOL,
    zodSchema: QuotationEmailExtractionSchema,
  });

  const record = await persistIngestedDocument({
    tenantId: params.tenantId,
    type: "QUOTATION_EMAIL",
    sourceMimeType: "text/plain",
    rawTextExcerpt: fullText,
    extractedPayload: data,
    confidenceScore: data.confidence,
    modelUsed,
  });

  return { record, extraction: data };
}
