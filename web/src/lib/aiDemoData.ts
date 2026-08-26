/**
 * Dados de demonstração para o Document AI e o Copilot (Passo 4).
 *
 * Numa ligação real ao backend (VITE_API_BASE_URL definido), estas páginas
 * chamam /ai/documents/* e /copilot/chat, que por sua vez chamam a API da
 * Anthropic (ver src/modules/ai/*). Sem essa ligação — como acontece nesta
 * demonstração publicada de forma estática — usamos exemplos "roteirizados":
 * o resultado é fixo e conhecido, mas a interação (carregar um documento,
 * escrever uma pergunta, pedir confirmação antes de gerar um pagamento) é
 * real e clicável.
 */
import { DraftBookingProposal, IngestedDocument } from "../types/ai";

// --- Document AI — exemplos de extração --------------------------------------

export interface SampleDocument {
  id: string;
  label: string;
  fileName: string;
  description: string;
  document: IngestedDocument;
}

export const SAMPLE_DOCUMENTS: SampleDocument[] = [
  {
    id: "invoice-1",
    label: "Farmangola Import → Farmácia Central",
    fileName: "fatura_farmangola_2608.pdf",
    description: "Fatura de importação farmacêutica, Lisboa → Luanda.",
    document: {
      id: "doc-inv-1",
      tenantId: "demo-tenant",
      type: "INVOICE",
      status: "PENDING_REVIEW",
      sourceFileName: "fatura_farmangola_2608.pdf",
      modelUsed: "claude-sonnet-4-5",
      confidenceScore: 0.94,
      createdAt: "2026-08-25T08:12:00Z",
      extractedPayload: {
        invoiceNumber: "FL-2026-08341",
        issueDate: "2026-08-22",
        sellerName: "Farmangola Import Lda",
        sellerNif: "PT509876543",
        buyerName: "Farmácia Central Luanda",
        buyerNif: "AO5417839210",
        currency: "EUR",
        totalAmount: 18420.5,
        lineItems: [
          { description: "Paracetamol 500mg (caixa 20un) — 800 caixas", quantity: 800, unitPrice: 6.2 },
          { description: "Soro Fisiológico 500ml — 1200 unidades", quantity: 1200, unitPrice: 4.85 },
          { description: "Álcool Gel 500ml — 500 unidades", quantity: 500, unitPrice: 5.9 },
        ],
        confidence: 0.94,
        needsReview: false,
        notes: "Documento nítido, todos os campos-chave extraídos com alta confiança.",
      },
    },
  },
  {
    id: "packing-list-1",
    label: "Cimangola → Construtora Moxico Leste",
    fileName: "packing_list_cimangola_0824.pdf",
    description: "Lista de embalagem para carga rodoviária, Bengo → Moxico Leste.",
    document: {
      id: "doc-pl-1",
      tenantId: "demo-tenant",
      type: "PACKING_LIST",
      status: "PENDING_REVIEW",
      sourceFileName: "packing_list_cimangola_0824.pdf",
      modelUsed: "claude-sonnet-4-5",
      confidenceScore: 0.88,
      createdAt: "2026-08-25T08:20:00Z",
      extractedPayload: {
        referenceNumber: "PL-CIM-08241",
        shipperName: "Cimangola",
        consigneeName: "Construtora Moxico Leste",
        pieces: [
          { description: "Cimento Portland 50kg (palete)", quantity: 18, lengthCm: 120, widthCm: 100, heightCm: 140, grossWeightKg: 1250 },
          { description: "Ferro 12mm (feixe 6m)", quantity: 40, lengthCm: 600, widthCm: 20, heightCm: 20, grossWeightKg: 180 },
          { description: "Chapa Zinco 2m", quantity: 200, lengthCm: 200, widthCm: 90, heightCm: null, grossWeightKg: null },
        ],
        totalGrossWeightKg: 29020,
        confidence: 0.88,
        needsReview: true,
        notes: "Uma linha (Chapa Zinco) sem altura nem peso — confirmar manualmente antes de calcular o peso taxável total.",
      },
    },
  },
  {
    id: "quotation-1",
    label: "Endiama Comercial — pedido por email",
    fileName: "email_cotacao_endiama.eml",
    description: "Pedido de cotação recebido por email para carga aérea internacional.",
    document: {
      id: "doc-qt-1",
      tenantId: "demo-tenant",
      type: "QUOTATION_EMAIL",
      status: "PENDING_REVIEW",
      sourceFileName: "email_cotacao_endiama.eml",
      modelUsed: "claude-sonnet-4-5",
      confidenceScore: 0.91,
      createdAt: "2026-08-25T08:31:00Z",
      extractedPayload: {
        requestedMode: "AIR",
        originProvince: "LUANDA",
        destinationProvince: null,
        requesterName: "Isabel Neto",
        requesterCompany: "Endiama Comercial",
        cargoDescription: "Lote de amostras minerais para avaliação, com escolta de segurança.",
        approxWeightKg: 42,
        targetDate: "2026-09-03",
        confidence: 0.91,
        needsReview: true,
        notes: "Destino mencionado apenas como \"o nosso escritório na Bélgica\" — a IA reconheceu o modal e a origem, mas o destino precisa de confirmação humana (não é uma província angolana).",
      },
    },
  },
];

export const SAMPLE_DRAFT_PROPOSALS: Record<string, DraftBookingProposal> = {
  "doc-pl-1": {
    documentId: "doc-pl-1",
    suggestedMode: "ROAD",
    shipperName: "Cimangola",
    consigneeName: "Construtora Moxico Leste",
    originProvince: "BENGO",
    destinationProvince: "MOXICO_LESTE",
    pieceCount: 258,
    totalGrossWeightKg: 29020,
    chargeableWeightKg: null,
    missingFields: ["pieces[2].heightCm", "pieces[2].grossWeightKg", "vehicleId", "driverId"],
  },
  "doc-inv-1": {
    documentId: "doc-inv-1",
    suggestedMode: "UNKNOWN",
    shipperName: "Farmangola Import Lda",
    consigneeName: "Farmácia Central Luanda",
    originProvince: null,
    destinationProvince: "LUANDA",
    pieceCount: 0,
    totalGrossWeightKg: null,
    chargeableWeightKg: null,
    missingFields: ["mode", "pieces", "originProvince"],
  },
  "doc-qt-1": {
    documentId: "doc-qt-1",
    suggestedMode: "AIR",
    shipperName: "Endiama Comercial",
    consigneeName: null,
    originProvince: "LUANDA",
    destinationProvince: null,
    pieceCount: 0,
    totalGrossWeightKg: 42,
    chargeableWeightKg: null,
    missingFields: ["destinationProvince", "consigneeName", "pieces"],
  },
};

// --- Copilot — conversas roteirizadas -----------------------------------------

export interface ScriptedToolCall {
  name: string;
  input: Record<string, unknown>;
  result: unknown;
}

export interface ScriptedStep {
  /** Texto que aparece como se o utilizador o tivesse escrito. */
  userText: string;
  /** Ferramentas que o Copilot "chama" antes de responder — mostradas na UI. */
  toolCalls: ScriptedToolCall[];
  assistantText: string;
}

export interface ScriptedScenario {
  id: string;
  buttonLabel: string;
  steps: ScriptedStep[];
}

export const COPILOT_SCENARIOS: ScriptedScenario[] = [
  {
    id: "route",
    buttonLabel: "Qual a rota Luanda → Huambo?",
    steps: [
      {
        userText: "Qual é a rota entre Luanda e Huambo, e quanto tempo demora?",
        toolCalls: [
          {
            name: "find_route",
            input: { originProvince: "LUANDA", destinationProvince: "HUAMBO" },
            result: {
              originProvince: "LUANDA",
              destinationProvince: "HUAMBO",
              distanceKm: 604,
              estimatedTransitHours: 11.5,
              crossesLobitoCorridor: false,
              source: "SEED_ESTIMATE",
            },
          },
        ],
        assistantText:
          "A rota Luanda → Huambo tem cerca de 604 km, com um tempo de trânsito estimado de 11h30 por estrada. " +
          "Não atravessa o Corredor do Lobito. Nota: este tenant ainda não configurou uma rota real para este " +
          "par de províncias, por isso o valor vem da estimativa de referência (SEED_ESTIMATE) — assim que " +
          "existirem viagens reais registadas, uso sempre a distância medida do tenant em vez desta estimativa.",
      },
    ],
  },
  {
    id: "tracking",
    buttonLabel: "Estado do envio SHP-ROAD-20260812-C3D4",
    steps: [
      {
        userText: "Qual é o estado actual do envio SHP-ROAD-20260812-C3D4?",
        toolCalls: [
          {
            name: "get_shipment_tracking",
            input: { shipmentNumber: "SHP-ROAD-20260812-C3D4" },
            result: {
              found: true,
              status: "CUSTOMS_HOLD",
              mode: "ROAD",
              events: [
                {
                  status: "CUSTOMS_HOLD",
                  description: "Guia retida para verificação documental na fronteira interprovincial.",
                  occurredAt: "2026-08-25T08:10:00Z",
                },
                {
                  status: "IN_TRANSIT",
                  description: "Saída do armazém de Luanda confirmada pelo motorista.",
                  occurredAt: "2026-08-12T11:00:00Z",
                },
              ],
            },
          },
        ],
        assistantText:
          "O envio SHP-ROAD-20260812-C3D4 (Refriango SA → Distribuidora do Huambo) está actualmente Retido na " +
          "Alfândega. O evento mais recente, às 08:10 de hoje, indica que a guia de transporte foi retida para " +
          "verificação documental numa fronteira interprovincial. Antes disso, tinha saído do armazém de Luanda " +
          "a 12 de Agosto. Recomendo confirmar com o despachante se falta algum documento.",
      },
    ],
  },
  {
    id: "chargeable-weight",
    buttonLabel: "Calcular peso taxável de 3 volumes",
    steps: [
      {
        userText:
          "Tenho 3 volumes de 60x50x40cm com 25kg cada, para envio aéreo. Qual é o peso taxável?",
        toolCalls: [
          {
            name: "calculate_chargeable_weight",
            input: {
              pieces: [
                { lengthCm: 60, widthCm: 50, heightCm: 40, grossWeightKg: 25 },
                { lengthCm: 60, widthCm: 50, heightCm: 40, grossWeightKg: 25 },
                { lengthCm: 60, widthCm: 50, heightCm: 40, grossWeightKg: 25 },
              ],
            },
            result: {
              totalGrossWeightKg: 75,
              totalVolumetricWeightKg: 60,
              chargeableWeightKg: 75,
            },
          },
        ],
        assistantText:
          "Para os 3 volumes (60×50×40cm, 25kg cada): peso bruto total = 75kg. Peso volumétrico = " +
          "(60×50×40 / 6000) × 3 = 60kg. Como o peso taxável IATA é o maior dos dois, o peso taxável final " +
          "é 75kg (arredondado ao meio-quilo — já não há fracção neste caso).",
      },
    ],
  },
  {
    id: "multicaixa",
    buttonLabel: "Gerar referência Multicaixa (com confirmação)",
    steps: [
      {
        userText: "Gera uma referência Multicaixa de 150000 AOA para o envio SHP-ROAD-20260812-C3D4.",
        toolCalls: [
          {
            name: "generate_multicaixa_reference",
            input: {
              amount: 150000,
              description: "Frete rodoviário SHP-ROAD-20260812-C3D4",
              shipmentNumber: "SHP-ROAD-20260812-C3D4",
              confirmed: false,
            },
            result: {
              ok: false,
              requiresConfirmation: true,
              message:
                "Confirmação necessária: pergunta ao utilizador se deve gerar uma referência Multicaixa de " +
                "150000 AOA, e só chama esta ferramenta outra vez com confirmed=true depois de uma resposta " +
                "afirmativa explícita.",
            },
          },
        ],
        assistantText:
          "Antes de gerar seja o que for: isto cria uma referência Multicaixa real, associada ao envio " +
          "SHP-ROAD-20260812-C3D4, no valor de 150.000 AOA. Confirma que queres que eu avance?",
      },
      {
        userText: "Sim, confirmo.",
        toolCalls: [
          {
            name: "generate_multicaixa_reference",
            input: {
              amount: 150000,
              description: "Frete rodoviário SHP-ROAD-20260812-C3D4",
              shipmentNumber: "SHP-ROAD-20260812-C3D4",
              confirmed: true,
            },
            result: {
              ok: true,
              emisEntity: "00891",
              emisReference: "00312456",
              expiresAt: "2026-08-28T08:00:00Z",
            },
          },
        ],
        assistantText:
          "Referência gerada. Entidade EMIS 00891, Referência 00312456, no valor de 150.000 AOA — válida até " +
          "28 de Agosto às 08:00. O cliente pode pagar em qualquer ATM, Multicaixa Express ou home banking " +
          "associado ao Multicaixa.",
      },
    ],
  },
];
