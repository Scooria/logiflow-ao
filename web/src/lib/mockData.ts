/**
 * Dados de demonstração — usados como fallback quando a API do backend
 * (Passo 2) não está acessível (`VITE_API_BASE_URL` por definir, ou o
 * pedido falha), para que o frontend seja demonstrável de forma autónoma.
 * Ver lib/api.ts para a lógica de fallback.
 */
import {
  EmisPaymentSummary,
  Shipment,
  StorageLocation,
  TrackingEvent,
  Warehouse,
} from "../types/domain";

export const MOCK_SHIPMENTS: Shipment[] = [
  { id: "s1", shipmentNumber: "SHP-AIR-20260810-A1B2", mode: "AIR", status: "IN_TRANSIT", shipperName: "Sonangol Distribuição", consigneeName: "TAAG Cargo Handling JFK", originAirportCode: "LAD", destinationAirportCode: "JFK", createdAt: "2026-08-10T08:00:00Z", updatedAt: "2026-08-12T14:00:00Z" },
  { id: "s2", shipmentNumber: "SHP-ROAD-20260812-C3D4", mode: "ROAD", status: "CUSTOMS_HOLD", shipperName: "Refriango SA", consigneeName: "Distribuidora do Huambo", originProvince: "LUANDA", destinationProvince: "HUAMBO", createdAt: "2026-08-12T09:30:00Z", updatedAt: "2026-08-13T10:00:00Z" },
  { id: "s3", shipmentNumber: "SHP-ROAD-20260813-E5F6", mode: "ROAD", status: "DELIVERED", shipperName: "Fazenda Kwanza Agro", consigneeName: "Mercado do Lobito", originProvince: "CUANZA_SUL", destinationProvince: "BENGUELA", createdAt: "2026-08-13T07:00:00Z", updatedAt: "2026-08-14T16:00:00Z" },
  { id: "s4", shipmentNumber: "SHP-AIR-20260815-G7H8", mode: "AIR", status: "CUSTOMS_CLEARED", shipperName: "Farmangola Import", consigneeName: "Farmácia Central Luanda", originAirportCode: "LIS", destinationAirportCode: "LAD", createdAt: "2026-08-15T06:00:00Z", updatedAt: "2026-08-16T09:00:00Z" },
  { id: "s5", shipmentNumber: "SHP-ROAD-20260816-I9J0", mode: "ROAD", status: "IN_TRANSIT", shipperName: "Cimangola", consigneeName: "Construtora Moxico Leste", originProvince: "BENGO", destinationProvince: "MOXICO_LESTE", createdAt: "2026-08-16T05:30:00Z", updatedAt: "2026-08-18T12:00:00Z" },
  { id: "s6", shipmentNumber: "SHP-AIR-20260817-K1L2", mode: "AIR", status: "BOOKED", shipperName: "Endiama Comercial", consigneeName: "Antwerp Diamond Center", originAirportCode: "LAD", destinationAirportCode: "BRU", createdAt: "2026-08-17T11:00:00Z", updatedAt: "2026-08-17T11:00:00Z" },
  { id: "s7", shipmentNumber: "SHP-ROAD-20260818-M3N4", mode: "ROAD", status: "PICKED_UP", shipperName: "Nova Vida Distribuição", consigneeName: "Loja Namibe Center", originProvince: "HUILA", destinationProvince: "NAMIBE", createdAt: "2026-08-18T08:00:00Z", updatedAt: "2026-08-18T08:30:00Z" },
  { id: "s8", shipmentNumber: "SHP-AIR-20260819-O5P6", mode: "AIR", status: "DELIVERED", shipperName: "Angola Tech Imports", consigneeName: "Datacenter Talatona", originAirportCode: "DXB", destinationAirportCode: "LAD", createdAt: "2026-08-19T04:00:00Z", updatedAt: "2026-08-20T15:00:00Z" },
  { id: "s9", shipmentNumber: "SHP-ROAD-20260820-Q7R8", mode: "ROAD", status: "OUT_FOR_DELIVERY", shipperName: "Coca-Cola Bottling Angola", consigneeName: "Supermercado Cabinda", originProvince: "ZAIRE", destinationProvince: "CABINDA", createdAt: "2026-08-20T06:00:00Z", updatedAt: "2026-08-21T09:00:00Z" },
  { id: "s10", shipmentNumber: "SHP-ROAD-20260821-S9T0", mode: "ROAD", status: "RETURNED", shipperName: "Textang II", consigneeName: "Loja Malanje Centro", originProvince: "LUANDA", destinationProvince: "MALANJE", createdAt: "2026-08-21T07:00:00Z", updatedAt: "2026-08-22T13:00:00Z" },
  { id: "s11", shipmentNumber: "SHP-AIR-20260822-U1V2", mode: "AIR", status: "ARRIVED", shipperName: "Petromar Supply", consigneeName: "Base Logística Soyo", originAirportCode: "HOU", destinationAirportCode: "LAD", createdAt: "2026-08-22T03:00:00Z", updatedAt: "2026-08-23T10:00:00Z" },
  { id: "s12", shipmentNumber: "SHP-ROAD-20260823-W3X4", mode: "ROAD", status: "IN_TRANSIT", shipperName: "Mineração Catoca", consigneeName: "Porto do Lobito", originProvince: "LUNDA_SUL", destinationProvince: "BENGUELA", createdAt: "2026-08-23T05:00:00Z", updatedAt: "2026-08-24T18:00:00Z" },
  { id: "s13", shipmentNumber: "SHP_DRAFT_1", mode: "AIR", status: "DRAFT", shipperName: "Kero Supermercados", consigneeName: "CDW Miami", createdAt: "2026-08-24T09:00:00Z", updatedAt: "2026-08-24T09:00:00Z" },
  { id: "s14", shipmentNumber: "SHP-ROAD-20260824-Y5Z6", mode: "ROAD", status: "CANCELLED", shipperName: "Simportex", consigneeName: "Armazém Cunene", originProvince: "HUILA", destinationProvince: "CUNENE", createdAt: "2026-08-24T10:00:00Z", updatedAt: "2026-08-24T15:00:00Z" },
];

export const MOCK_TRACKING_EVENTS: TrackingEvent[] = [
  { id: "t1", shipmentId: "s2", shipmentNumber: "SHP-ROAD-20260812-C3D4", status: "CUSTOMS_HOLD", province: "CUANZA_SUL", description: "Guia retida para verificação documental na fronteira interprovincial.", source: "AGT", occurredAt: "2026-08-25T08:10:00Z" },
  { id: "t2", shipmentId: "s5", shipmentNumber: "SHP-ROAD-20260816-I9J0", status: "IN_TRANSIT", province: "BIE", description: "Passagem pelo Corredor do Lobito confirmada (Huambo -> Bié).", source: "DRIVER_APP", occurredAt: "2026-08-25T07:40:00Z" },
  { id: "t3", shipmentId: "s1", shipmentNumber: "SHP-AIR-20260810-A1B2", status: "IN_TRANSIT", description: "Voo TP1234 descolou de Luanda (LAD) com destino a JFK.", source: "ONE_RECORD", occurredAt: "2026-08-25T06:55:00Z" },
  { id: "t4", shipmentId: "s9", shipmentNumber: "SHP-ROAD-20260820-Q7R8", status: "OUT_FOR_DELIVERY", province: "CABINDA", description: "Saída para entrega final em Cabinda.", source: "DRIVER_APP", occurredAt: "2026-08-25T06:20:00Z" },
  { id: "t5", shipmentId: "s12", shipmentNumber: "SHP-ROAD-20260823-W3X4", status: "IN_TRANSIT", province: "MOXICO", description: "Checkpoint Lunda Sul -> Moxico confirmado.", source: "DRIVER_APP", occurredAt: "2026-08-25T05:15:00Z" },
  { id: "t6", shipmentId: "s4", shipmentNumber: "SHP-AIR-20260815-G7H8", status: "CUSTOMS_CLEARED", description: "Desalfandegamento concluído no Aeroporto Internacional 4 de Fevereiro.", source: "AGT", occurredAt: "2026-08-25T04:50:00Z" },
];

export const MOCK_EMIS_PAYMENTS: EmisPaymentSummary[] = [
  { id: "p1", emisReference: "00998877", amount: 1250000, currency: "AOA", status: "PENDING", createdAt: "2026-08-24T09:00:00Z" },
  { id: "p2", emisReference: "00998544", amount: 430000, currency: "AOA", status: "PAID", createdAt: "2026-08-23T14:00:00Z" },
  { id: "p3", emisReference: "00997432", amount: 89000, currency: "AOA", status: "EXPIRED", createdAt: "2026-08-20T10:00:00Z" },
];

/** Faturação consolidada do mês — frete nacional (AOA) + clientes internacionais via Stripe (USD). */
export const MOCK_BILLING_SUMMARY = {
  aoaThisMonth: 18_450_000,
  usdThisMonth: 62_300,
};

function loc(id: string, code: string, occupiedUnits: number, capacityUnits: number, items: StorageLocation["stockItems"] = []): StorageLocation {
  return {
    id,
    code,
    uniqueAddress: `AO-LUA-WH1-ZA-${id.slice(0, 3).toUpperCase()}-${code}`,
    capacityUnits,
    occupiedUnits,
    stockItems: items,
  };
}

export const MOCK_WAREHOUSE: Warehouse = {
  id: "wh1",
  code: "WH1",
  name: "Armazém Central Luanda",
  province: "LUANDA",
  zones: [
    {
      id: "za",
      code: "ZA",
      name: "Zona A — Armazenagem Geral",
      type: "STORAGE",
      racks: [
        {
          id: "r01",
          code: "R01",
          shelves: [
            {
              id: "r01l01",
              code: "L01",
              positions: [
                loc("r01l01b01", "B01", 42, 50, [{ id: "si1", itemName: "Cimento Portland 50kg", sku: "CIM-050", quantity: 42 }]),
                loc("r01l01b02", "B02", 12, 50, [{ id: "si2", itemName: "Chapa Zinco 2m", sku: "CHZ-200", quantity: 12 }]),
                loc("r01l01b03", "B03", 50, 50, [{ id: "si3", itemName: "Ferro 12mm", sku: "FER-012", quantity: 50 }]),
                loc("r01l01b04", "B04", 0, 50),
              ],
            },
            {
              id: "r01l02",
              code: "L02",
              positions: [
                loc("r01l02b01", "B01", 30, 40, [{ id: "si4", itemName: "Óleo Alimentar 20L", sku: "OAL-020", batchNumber: "LT2608A", expiryDate: "2027-02-01", quantity: 30 }]),
                loc("r01l02b02", "B02", 18, 40, [{ id: "si5", itemName: "Arroz 25kg", sku: "ARZ-025", batchNumber: "LT2608B", expiryDate: "2027-06-15", quantity: 18 }]),
                loc("r01l02b03", "B03", 40, 40, [{ id: "si6", itemName: "Farinha de Trigo 25kg", sku: "FAR-025", batchNumber: "LT2607C", expiryDate: "2026-12-01", quantity: 40 }]),
              ],
            },
          ],
        },
        {
          id: "r02",
          code: "R02",
          shelves: [
            {
              id: "r02l01",
              code: "L01",
              positions: [
                loc("r02l01b01", "B01", 6, 30, [{ id: "si7", itemName: "Peças Automóveis (kit)", sku: "PCA-KIT", quantity: 6 }]),
                loc("r02l01b02", "B02", 28, 30, [{ id: "si8", itemName: "Bateria 12V", sku: "BAT-012", quantity: 28 }]),
                loc("r02l01b03", "B03", 0, 30),
              ],
            },
            {
              id: "r02l02",
              code: "L02",
              positions: [
                loc("r02l02b01", "B01", 15, 20, [{ id: "si9", itemName: "Material Escolar (caixa)", sku: "ESC-CX1", quantity: 15 }]),
                loc("r02l02b02", "B02", 20, 20, [{ id: "si10", itemName: "Medicamentos OTC (caixa)", sku: "MED-OTC", batchNumber: "LT2608D", expiryDate: "2026-11-20", quantity: 20 }]),
              ],
            },
          ],
        },
      ],
    },
  ],
};
