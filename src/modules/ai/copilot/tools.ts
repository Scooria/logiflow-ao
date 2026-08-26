/**
 * Definição das ferramentas do Copilot — cada uma é um "tool" Anthropic
 * (nome + input_schema) mais um executor que chama os serviços já
 * existentes do Passo 2 (routeEngine, chargeableWeight, EMIS) e do Passo 1
 * (Prisma), sempre isolado por `tenantId`.
 *
 * Ferramentas com efeito colateral financeiro (gerar referência Multicaixa)
 * exigem `confirmed: true` explícito no input — se o modelo chamar a
 * ferramenta sem confirmação, o executor devolve um pedido de confirmação
 * em vez de agir, e cabe ao modelo perguntar ao utilizador antes de repetir
 * a chamada. Numa integração de produção, isto deve ser reforçado também
 * na camada de UI (diálogo de confirmação antes do pedido HTTP chegar cá).
 */
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { Province } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { findRoute } from "../../cargo/routeEngine";
import { summarizeAwbWeights, PieceDimensions } from "../../cargo/chargeableWeight";
import { generateMulticaixaReference } from "../../payments/emis.service";
import { PROVINCE_CODE } from "../../../config/provinces";

export interface ToolContext {
  tenantId: string;
  userId: string;
}

export interface CopilotTool {
  definition: Tool;
  execute: (input: any, ctx: ToolContext) => Promise<unknown>;
}

const PROVINCE_ENUM = Object.keys(PROVINCE_CODE);

const findRouteTool: CopilotTool = {
  definition: {
    name: "find_route",
    description:
      "Calcula a rota interprovincial (distância, tempo estimado, se atravessa o Corredor " +
      "do Lobito/SADC) entre duas províncias de Angola, usando as rotas reais do tenant " +
      "quando existem, ou uma estimativa de referência caso contrário.",
    input_schema: {
      type: "object",
      properties: {
        originProvince: { type: "string", enum: PROVINCE_ENUM },
        destinationProvince: { type: "string", enum: PROVINCE_ENUM },
      },
      required: ["originProvince", "destinationProvince"],
    },
  },
  execute: async (input, ctx) => {
    const route = await findRoute(ctx.tenantId, input.originProvince as Province, input.destinationProvince as Province);
    return route;
  },
};

const chargeableWeightTool: CopilotTool = {
  definition: {
    name: "calculate_chargeable_weight",
    description:
      "Calcula o peso taxável IATA para frete aéreo a partir das dimensões e peso bruto " +
      "de um conjunto de volumes: peso volumétrico = (C x L x A em cm) / 6000; peso " +
      "taxável = maior entre peso bruto total e peso volumétrico total, arredondado ao " +
      "meio-quilo.",
    input_schema: {
      type: "object",
      properties: {
        pieces: {
          type: "array",
          items: {
            type: "object",
            properties: {
              lengthCm: { type: "number" },
              widthCm: { type: "number" },
              heightCm: { type: "number" },
              grossWeightKg: { type: "number" },
            },
            required: ["lengthCm", "widthCm", "heightCm", "grossWeightKg"],
          },
        },
      },
      required: ["pieces"],
    },
  },
  execute: async (input) => summarizeAwbWeights(input.pieces as PieceDimensions[]),
};

const listShipmentsTool: CopilotTool = {
  definition: {
    name: "list_shipments",
    description: "Lista os envios mais recentes do tenant, opcionalmente filtrados por modo e/ou estado.",
    input_schema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["AIR", "ROAD", "MULTIMODAL"] },
        status: {
          type: "string",
          enum: [
            "DRAFT", "BOOKED", "PICKED_UP", "IN_TRANSIT", "CUSTOMS_HOLD",
            "CUSTOMS_CLEARED", "ARRIVED", "OUT_FOR_DELIVERY", "DELIVERED",
            "CANCELLED", "RETURNED",
          ],
        },
        limit: { type: "number", minimum: 1, maximum: 50 },
      },
      required: [],
    },
  },
  execute: async (input, ctx) => {
    const shipments = await prisma.shipment.findMany({
      where: {
        tenantId: ctx.tenantId,
        mode: input.mode ?? undefined,
        status: input.status ?? undefined,
      },
      orderBy: { updatedAt: "desc" },
      take: Math.min(input.limit ?? 10, 50),
      include: { shipper: true, consignee: true },
    });
    return shipments.map(
      (s: {
        shipmentNumber: string;
        mode: string;
        status: string;
        shipper: { name: string };
        consignee: { name: string };
        updatedAt: Date;
      }) => ({
        shipmentNumber: s.shipmentNumber,
        mode: s.mode,
        status: s.status,
        shipper: s.shipper.name,
        consignee: s.consignee.name,
        updatedAt: s.updatedAt,
      })
    );
  },
};

const getShipmentTrackingTool: CopilotTool = {
  definition: {
    name: "get_shipment_tracking",
    description: "Devolve o estado actual e o histórico de eventos de rastreamento de um envio, pelo número.",
    input_schema: {
      type: "object",
      properties: { shipmentNumber: { type: "string" } },
      required: ["shipmentNumber"],
    },
  },
  execute: async (input, ctx) => {
    const shipment = await prisma.shipment.findFirst({
      where: { tenantId: ctx.tenantId, shipmentNumber: input.shipmentNumber },
      include: { trackingEvents: { orderBy: { occurredAt: "desc" }, take: 10 } },
    });
    if (!shipment) return { found: false };
    return {
      found: true,
      status: shipment.status,
      mode: shipment.mode,
      events: shipment.trackingEvents.map(
        (e: { status: string; description: string | null; occurredAt: Date }) => ({
          status: e.status,
          description: e.description,
          occurredAt: e.occurredAt,
        })
      ),
    };
  },
};

const generateMulticaixaReferenceTool: CopilotTool = {
  definition: {
    name: "generate_multicaixa_reference",
    description:
      "Gera uma Referência Multicaixa (EMIS) dinâmica em Kwanza para pagamento. AÇÃO " +
      "FINANCEIRA REAL — só chamar com confirmed=true depois de o utilizador confirmar " +
      "explicitamente o montante. Se confirmed=false ou omitido, a ferramenta não gera " +
      "nada e devolve um pedido de confirmação.",
    input_schema: {
      type: "object",
      properties: {
        amount: { type: "number" },
        description: { type: "string" },
        shipmentNumber: { type: "string" },
        confirmed: { type: "boolean" },
      },
      required: ["amount", "confirmed"],
    },
  },
  execute: async (input, ctx) => {
    if (!input.confirmed) {
      return {
        ok: false,
        requiresConfirmation: true,
        message:
          "Confirmação necessária: pergunta ao utilizador se deve gerar uma referência " +
          `Multicaixa de ${input.amount} AOA, e só chama esta ferramenta outra vez com ` +
          "confirmed=true depois de uma resposta afirmativa explícita.",
      };
    }

    let shipmentId: string | undefined;
    if (input.shipmentNumber) {
      const shipment = await prisma.shipment.findFirst({
        where: { tenantId: ctx.tenantId, shipmentNumber: input.shipmentNumber },
      });
      shipmentId = shipment?.id;
    }

    const transaction = await generateMulticaixaReference({
      tenantId: ctx.tenantId,
      amount: input.amount,
      description: input.description,
      shipmentId,
    });
    return {
      ok: true,
      emisEntity: transaction.emisEntity,
      emisReference: transaction.emisReference,
      expiresAt: transaction.expiresAt,
    };
  },
};

export const COPILOT_TOOLS: CopilotTool[] = [
  findRouteTool,
  chargeableWeightTool,
  listShipmentsTool,
  getShipmentTrackingTool,
  generateMulticaixaReferenceTool,
];

export const COPILOT_TOOL_MAP: Record<string, CopilotTool> = Object.fromEntries(
  COPILOT_TOOLS.map((t) => [t.definition.name, t])
);
