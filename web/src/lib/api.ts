/**
 * Cliente API para o backend do Passo 2. Se `VITE_API_BASE_URL` não estiver
 * definido, ou o pedido falhar (backend ainda não ligado), cada função
 * recorre aos dados de demonstração (mockData.ts) — para que a UI seja
 * sempre demonstrável, mesmo antes da infraestrutura estar de pé.
 */
import { EmisPaymentSummary, Shipment, TrackingEvent, Warehouse } from "../types/domain";
import {
  MOCK_BILLING_SUMMARY,
  MOCK_EMIS_PAYMENTS,
  MOCK_SHIPMENTS,
  MOCK_TRACKING_EVENTS,
  MOCK_WAREHOUSE,
} from "./mockData";
import {
  CopilotChatMessage,
  CopilotTurnResult,
  DocumentStatus,
  DraftBookingProposal,
  IngestedDocument,
} from "../types/ai";
import { COPILOT_SCENARIOS, SAMPLE_DOCUMENTS, SAMPLE_DRAFT_PROPOSALS } from "./aiDemoData";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined;
export const DEFAULT_TENANT_ID = (import.meta.env.VITE_DEMO_TENANT_ID as string | undefined) ?? "demo-tenant";
const DEFAULT_USER_ID = (import.meta.env.VITE_DEMO_USER_ID as string | undefined) ?? "demo-user";

async function tryFetch<T>(path: string, fallback: T, init?: RequestInit): Promise<T> {
  if (!API_BASE_URL) return fallback;
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, init);
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    // Backend indisponível — a UI continua a funcionar em modo demonstração.
    return fallback;
  }
}

/** Pequeno atraso artificial para simular latência real de um pedido a um LLM em modo demonstração. */
function demoDelay(ms = 900): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Duração da análise simulada de documento — exportada para a UI poder animar uma barra de progresso a condizer. */
export const DOCUMENT_ANALYSIS_DELAY_MS = 1100;

export async function fetchShipments(params?: { mode?: string; status?: string }): Promise<Shipment[]> {
  const query = new URLSearchParams({ tenantId: DEFAULT_TENANT_ID, ...params }).toString();
  return tryFetch<Shipment[]>(`/shipments?${query}`, MOCK_SHIPMENTS);
}

export async function fetchTrackingEvents(limit = 20): Promise<TrackingEvent[]> {
  return tryFetch<TrackingEvent[]>(
    `/tracking-events?tenantId=${DEFAULT_TENANT_ID}&limit=${limit}`,
    MOCK_TRACKING_EVENTS
  );
}

export async function fetchWarehouseMap(warehouseId: string): Promise<Warehouse> {
  return tryFetch<Warehouse>(`/wms/warehouses/${warehouseId}/map`, MOCK_WAREHOUSE);
}

export async function fetchEmisPayments(): Promise<EmisPaymentSummary[]> {
  return tryFetch<EmisPaymentSummary[]>(`/payments/emis?tenantId=${DEFAULT_TENANT_ID}`, MOCK_EMIS_PAYMENTS);
}

export interface BillingSummary {
  aoaThisMonth: number;
  usdThisMonth: number;
}

export async function fetchBillingSummary(): Promise<BillingSummary> {
  return tryFetch<BillingSummary>(`/billing/summary?tenantId=${DEFAULT_TENANT_ID}`, MOCK_BILLING_SUMMARY);
}

export interface ScanBarcodePayload {
  barcodeValue: string;
  action: "INBOUND" | "OUTBOUND" | "TRANSFER" | "CYCLE_COUNT" | "PICK" | "PUTAWAY";
  scannedByUserId: string;
  deviceId?: string;
}

/** Regista uma leitura de scanner. Em modo demonstração, apenas simula sucesso. */
export async function postBarcodeScan(payload: ScanBarcodePayload): Promise<{ ok: boolean; demo: boolean }> {
  if (!API_BASE_URL) {
    return { ok: true, demo: true };
  }
  try {
    const res = await fetch(`${API_BASE_URL}/wms/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId: DEFAULT_TENANT_ID, ...payload }),
    });
    return { ok: res.ok, demo: false };
  } catch {
    return { ok: false, demo: false };
  }
}

export const isDemoMode = () => !API_BASE_URL;

// --- Pagamentos (Passo 5) -----------------------------------------------------
//
// Multicaixa (EMIS) e Stripe têm integração real no backend (ver
// src/modules/payments/{emis,stripe}.service.ts) — quando VITE_API_BASE_URL
// está definido, estas funções chamam-na; devolvem `null` em modo
// demonstração (ou se o pedido falhar), e o chamador cai para o simulador
// local (ver lib/payments.ts). RUPE (AGT) NÃO tem integração real ainda —
// ver DEPLOY.md secção "EMIS/Multicaixa e RUPE" — por isso não tem
// equivalente aqui e mantém-se sempre simulado.

export interface RealEmisReference {
  entity: string;
  reference: string;
  issuedAt: string;
  expiresAt: string;
}

export async function requestMulticaixaReference(input: {
  amount: number;
  description: string;
}): Promise<RealEmisReference | null> {
  if (!API_BASE_URL) return null;
  try {
    const res = await fetch(`${API_BASE_URL}/payments/emis/reference`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId: DEFAULT_TENANT_ID, amount: input.amount, description: input.description }),
    });
    if (!res.ok) return null;
    const tx = await res.json();
    if (!tx.emisEntity || !tx.emisReference) return null;
    return { entity: tx.emisEntity, reference: tx.emisReference, issuedAt: tx.createdAt, expiresAt: tx.expiresAt };
  } catch {
    return null;
  }
}

export interface RealStripeCheckoutSession {
  checkoutUrl: string;
  sessionId: string;
}

export async function requestStripeCheckout(input: {
  amount: number;
  currency: "USD" | "EUR";
  description: string;
}): Promise<RealStripeCheckoutSession | null> {
  if (!API_BASE_URL) return null;
  try {
    const res = await fetch(`${API_BASE_URL}/payments/stripe/checkout-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId: DEFAULT_TENANT_ID, ...input }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.checkoutUrl) return null;
    return { checkoutUrl: data.checkoutUrl, sessionId: data.sessionId };
  } catch {
    return null;
  }
}

// --- Document AI (Passo 4) ---------------------------------------------------
//
// Numa integração real, cada função abaixo envia o PDF/email em base64 para
// /ai/documents/{invoice|packing-list|quotation-email} (ver src/http/routes/
// ai.routes.ts no backend), e a Anthropic API devolve o payload estruturado.
// Nesta demonstração publicada de forma estática não há um backend acessível
// nem ficheiros reais para enviar — por isso `analyzeSampleDocument` carrega
// um dos 3 exemplos pré-processados (aiDemoData.ts) com um atraso artificial,
// para que a interacção (escolher um documento, ver a IA "processar") seja
// real, mesmo que o resultado seja fixo.

export async function analyzeSampleDocument(sampleId: string): Promise<IngestedDocument> {
  const sample = SAMPLE_DOCUMENTS.find((s) => s.id === sampleId);
  if (!sample) throw new Error(`Documento de exemplo desconhecido: ${sampleId}`);

  if (API_BASE_URL) {
    // Ambiente ligado a um backend real: o documento de exemplo seria lido do
    // disco e enviado como base64 para o endpoint correspondente ao seu tipo.
    // Mantido como fallback local porque esta demonstração não tem ficheiros
    // binários reais para enviar.
  }
  await demoDelay(DOCUMENT_ANALYSIS_DELAY_MS);
  return sample.document;
}

export async function submitDocumentReview(input: {
  documentId: string;
  action: "CONFIRM" | "REJECT";
  reviewNotes?: string;
}): Promise<{ id: string; status: DocumentStatus }> {
  const fallback = { id: input.documentId, status: (input.action === "CONFIRM" ? "CONFIRMED" : "REJECTED") as DocumentStatus };
  return tryFetch(
    `/ai/documents/${input.documentId}/review`,
    fallback,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId: DEFAULT_TENANT_ID,
        reviewedByUserId: DEFAULT_USER_ID,
        action: input.action,
        reviewNotes: input.reviewNotes,
      }),
    }
  );
}

export async function fetchDraftProposal(documentId: string): Promise<DraftBookingProposal | null> {
  const fallback = SAMPLE_DRAFT_PROPOSALS[documentId] ?? null;
  return tryFetch(
    `/ai/documents/${documentId}/proposal?tenantId=${DEFAULT_TENANT_ID}`,
    fallback
  );
}

// --- Copilot (Passo 4) --------------------------------------------------------
//
// Em produção, `sendCopilotMessage` chama POST /copilot/chat, que corre o
// ciclo agêntico completo (Anthropic tool-use) do backend. Nesta demonstração
// estática, quando não há backend ligado, a resposta é resolvida contra os
// cenários roteirizados (aiDemoData.ts) — a mesma pergunta escrita à mão ou
// através de um botão de sugestão dá a mesma resposta com as mesmas
// ferramentas "chamadas", para que a apresentação seja sempre fiável.

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function resolveScriptedReply(history: CopilotChatMessage[]): CopilotTurnResult {
  const lastUser = [...history].reverse().find((m) => m.role === "user");
  if (!lastUser) {
    return { reply: "Em que posso ajudar?", actions: [], truncated: false };
  }
  const needle = normalize(lastUser.content);

  for (const scenario of COPILOT_SCENARIOS) {
    for (const step of scenario.steps) {
      if (normalize(step.userText) === needle || needle.includes(normalize(step.userText).slice(0, 20))) {
        return { reply: step.assistantText, actions: step.toolCalls, truncated: false };
      }
    }
  }

  return {
    reply:
      "Esta demonstração está limitada a um conjunto de conversas roteirizadas (ver as sugestões acima). " +
      "Numa instância ligada à API da Anthropic, esta pergunta seguiria o mesmo ciclo agêntico, com acesso " +
      "às mesmas 5 ferramentas, mas sem estar limitada a respostas pré-definidas.",
    actions: [],
    truncated: false,
  };
}

export async function sendCopilotMessage(history: CopilotChatMessage[]): Promise<CopilotTurnResult> {
  const fallback = resolveScriptedReply(history);
  if (!API_BASE_URL) {
    await demoDelay(700);
    return fallback;
  }
  return tryFetch(
    `/copilot/chat`,
    fallback,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId: DEFAULT_TENANT_ID, userId: DEFAULT_USER_ID, history }),
    }
  );
}
