/**
 * Tipos de domínio espelhados do prisma/schema.prisma (Passo 1) — apenas os
 * campos que a UI efectivamente consome. Mantidos manualmente em sincronia;
 * numa configuração de monorepo, o ideal é gerar/partilhar estes tipos a
 * partir do @prisma/client do backend (Passo 2) via um pacote `@logiflow/types`.
 */

export type Province =
  | "LUANDA" | "BENGO" | "BENGUELA" | "BIE" | "CABINDA" | "CUANDO_CUBANGO"
  | "CUANZA_NORTE" | "CUANZA_SUL" | "CUNENE" | "HUAMBO" | "HUILA"
  | "LUNDA_NORTE" | "LUNDA_SUL" | "MALANJE" | "MOXICO" | "NAMIBE" | "UIGE"
  | "ZAIRE" | "ICOLO_E_BENGO" | "MOXICO_LESTE" | "CUANDO";

export const PROVINCE_NAME_PT: Record<Province, string> = {
  LUANDA: "Luanda", BENGO: "Bengo", BENGUELA: "Benguela", BIE: "Bié",
  CABINDA: "Cabinda", CUANDO_CUBANGO: "Cuando Cubango", CUANZA_NORTE: "Cuanza Norte",
  CUANZA_SUL: "Cuanza Sul", CUNENE: "Cunene", HUAMBO: "Huambo", HUILA: "Huíla",
  LUNDA_NORTE: "Lunda Norte", LUNDA_SUL: "Lunda Sul", MALANJE: "Malanje",
  MOXICO: "Moxico", NAMIBE: "Namibe", UIGE: "Uíge", ZAIRE: "Zaire",
  ICOLO_E_BENGO: "Icolo e Bengo", MOXICO_LESTE: "Moxico Leste", CUANDO: "Cuando",
};

export type CargoMode = "AIR" | "ROAD" | "MULTIMODAL";

export type ShipmentStatus =
  | "DRAFT" | "BOOKED" | "PICKED_UP" | "IN_TRANSIT" | "CUSTOMS_HOLD"
  | "CUSTOMS_CLEARED" | "ARRIVED" | "OUT_FOR_DELIVERY" | "DELIVERED"
  | "CANCELLED" | "RETURNED";

export const SHIPMENT_STATUS_LABEL_PT: Record<ShipmentStatus, string> = {
  DRAFT: "Rascunho",
  BOOKED: "Reservado",
  PICKED_UP: "Recolhido",
  IN_TRANSIT: "Em Trânsito",
  CUSTOMS_HOLD: "Retido na Alfândega",
  CUSTOMS_CLEARED: "Desalfandegado",
  ARRIVED: "Chegou ao Destino",
  OUT_FOR_DELIVERY: "Em Distribuição",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
  RETURNED: "Devolvido",
};

/** Classificação semântica de estado usada para cor (paleta status: good/warning/serious/critical). */
export type StatusSemantic = "neutral" | "progress" | "good" | "warning" | "critical";

export const SHIPMENT_STATUS_SEMANTIC: Record<ShipmentStatus, StatusSemantic> = {
  DRAFT: "neutral",
  BOOKED: "progress",
  PICKED_UP: "progress",
  IN_TRANSIT: "progress",
  OUT_FOR_DELIVERY: "progress",
  CUSTOMS_HOLD: "warning",
  CUSTOMS_CLEARED: "good",
  ARRIVED: "good",
  DELIVERED: "good",
  CANCELLED: "critical",
  RETURNED: "critical",
};

export interface Shipment {
  id: string;
  shipmentNumber: string;
  mode: CargoMode;
  status: ShipmentStatus;
  shipperName: string;
  consigneeName: string;
  originProvince?: Province;
  destinationProvince?: Province;
  originAirportCode?: string;
  destinationAirportCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrackingEvent {
  id: string;
  shipmentId: string;
  shipmentNumber: string;
  status: ShipmentStatus;
  location?: string;
  province?: Province;
  description?: string;
  source?: string;
  occurredAt: string;
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  province: Province;
  zones: WarehouseZone[];
}

export interface WarehouseZone {
  id: string;
  code: string;
  name: string;
  type: string;
  racks: Rack[];
}

export interface Rack {
  id: string;
  code: string;
  shelves: Shelf[];
}

export interface Shelf {
  id: string;
  code: string;
  positions: StorageLocation[];
}

export interface StorageLocation {
  id: string;
  code: string;
  uniqueAddress: string;
  capacityUnits: number | null;
  occupiedUnits: number;
  stockItems: StockItemSummary[];
}

export interface StockItemSummary {
  id: string;
  itemName: string;
  sku: string;
  batchNumber?: string;
  expiryDate?: string;
  quantity: number;
}

export interface EmisPaymentSummary {
  id: string;
  emisReference: string;
  amount: number;
  currency: string;
  status: "PENDING" | "PROCESSING" | "PAID" | "PARTIALLY_PAID" | "FAILED" | "EXPIRED" | "REFUNDED" | "CANCELLED";
  createdAt: string;
}
