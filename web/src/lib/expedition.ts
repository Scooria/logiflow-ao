/**
 * Lógica de emissão de expedições — portada do backend (Passo 2:
 * src/modules/cargo/{documentCodes,chargeableWeight,awbNumber}.ts) para
 * correr no cliente nesta demonstração. Mantém as MESMAS fórmulas e
 * convenções (peso taxável IATA, dígito de verificação AWB, formato de
 * número de Guia Rodoviária) — quando ligado a um backend real
 * (VITE_API_BASE_URL), a emissão passa a ser feita lá; isto serve apenas
 * para a expedição "nascer" já com um número de documento plausível e
 * consistente com o resto da aplicação.
 */
import { Province } from "../types/domain";

export const PROVINCE_CODE: Record<Province, string> = {
  LUANDA: "LUA",
  BENGO: "BGO",
  BENGUELA: "BGU",
  BIE: "BIE",
  CABINDA: "CAB",
  CUANDO_CUBANGO: "CCB",
  CUANZA_NORTE: "CNO",
  CUANZA_SUL: "CSU",
  CUNENE: "CUN",
  HUAMBO: "HUA",
  HUILA: "HUI",
  LUNDA_NORTE: "LNO",
  LUNDA_SUL: "LSU",
  MALANJE: "MAL",
  MOXICO: "MOX",
  NAMIBE: "NAM",
  UIGE: "UIG",
  ZAIRE: "ZAI",
  ICOLO_E_BENGO: "ICB",
  MOXICO_LESTE: "MXL",
  CUANDO: "CDO",
};

export interface InternationalDestination {
  code: string;
  city: string;
  country: string;
}

export const INTERNATIONAL_DESTINATIONS: InternationalDestination[] = [
  { code: "LIS", city: "Lisboa", country: "Portugal" },
  { code: "JFK", city: "Nova Iorque", country: "EUA" },
  { code: "GRU", city: "São Paulo", country: "Brasil" },
  { code: "JNB", city: "Joanesburgo", country: "África do Sul" },
  { code: "DXB", city: "Dubai", country: "EAU" },
  { code: "BRU", city: "Bruxelas", country: "Bélgica" },
  { code: "LHR", city: "Londres", country: "Reino Unido" },
];

export interface DomesticAirport {
  province: Province;
  code: string;
  city: string;
}

/**
 * Aeroportos provinciais com carga aérea doméstica relevante — subconjunto
 * ilustrativo (nem todas as 21 províncias têm operação cargueira regular).
 * Códigos IATA verificados em 2026-08-25 contra a Wikipédia/ICAO (ver
 * fontes abaixo); a frequência e o estado atual da operação de carga em
 * cada aeroporto devem ainda ser confirmados junto da ANAC/TAAG/Fly Angola
 * antes de uso em produção, tal como já assinalado para o prefixo de
 * companhia aérea no backend.
 *   Cabinda (FNCA): https://en.wikipedia.org/wiki/Cabinda_Airport
 *   Lubango — Mukanka (FNUB): https://en.wikipedia.org/wiki/Lubango_Airport
 *   Huambo — Albano Machado (FNHU): https://en.wikipedia.org/wiki/Albano_Machado_Airport
 *   Benguela (FNBG): https://en.wikipedia.org/wiki/Benguela_Airport
 *   Namibe — Welwitschia Mirabilis (FNMO): https://en.wikipedia.org/wiki/Welwitschia_Mirabilis_Airport
 *   Uíge — Carmona (FNUG): https://en.wikipedia.org/wiki/U%C3%ADge_Airport
 *   Soyo (FNSO): https://en.wikipedia.org/wiki/Soyo_Airport
 *   Saurimo (FNSA): https://en.wikipedia.org/wiki/Saurimo_Airport
 */
export const DOMESTIC_AIR_DESTINATIONS: DomesticAirport[] = [
  { province: "CABINDA", code: "CAB", city: "Cabinda" },
  { province: "HUILA", code: "SDD", city: "Lubango" },
  { province: "HUAMBO", code: "NOV", city: "Huambo" },
  { province: "BENGUELA", code: "BUG", city: "Benguela" },
  { province: "NAMIBE", code: "MSZ", city: "Namibe" },
  { province: "UIGE", code: "UGO", city: "Uíge" },
  { province: "ZAIRE", code: "SZA", city: "Soyo" },
  { province: "LUNDA_SUL", code: "VHC", city: "Saurimo" },
];

function randomHex(chars: number): string {
  let out = "";
  for (let i = 0; i < chars; i++) {
    out += Math.floor(Math.random() * 16).toString(16);
  }
  return out.toUpperCase();
}

function datePart(at: Date): string {
  return at.toISOString().slice(0, 10).replace(/-/g, "");
}

/** SHP-{AIR|ROAD}-{YYYYMMDD}-{4 carateres} — mesmo esquema usado nos dados de exemplo. */
export function generateShipmentNumber(mode: "AIR" | "ROAD", at: Date = new Date()): string {
  return `SHP-${mode}-${datePart(at)}-${randomHex(4)}`;
}

/** GTR-{origem}{destino}-{YYYYMMDD}-{6 carateres} — Guia de Transporte Rodoviário interprovincial. */
export function generateRoadGuideNumber(origin: Province, destination: Province, at: Date = new Date()): string {
  return `GTR-${PROVINCE_CODE[origin]}${PROVINCE_CODE[destination]}-${datePart(at)}-${randomHex(6)}`;
}

/** Dígito de verificação IATA: série de 7 dígitos módulo 7. */
export function computeAwbCheckDigit(serial7: string): number {
  return Number(serial7) % 7;
}

/** Número de AWB no formato IATA: XXX-YYYYYYYC (prefixo de companhia + série de 7 + dígito de controlo). */
export function formatAwbNumber(airlinePrefix: string, sequence: number): string {
  const serial7 = String(sequence).padStart(7, "0").slice(-7);
  return `${airlinePrefix}-${serial7}${computeAwbCheckDigit(serial7)}`;
}

export interface PieceInput {
  quantity: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  grossWeightKg: number;
}

export interface ChargeableWeightSummary {
  pieces: number;
  grossWeightKg: number;
  volumeM3: number;
  volumetricWeightKg: number;
  chargeableWeightKg: number;
}

/** Arredonda para cima ao múltiplo de 0.5 mais próximo (convenção IATA). */
export function roundUpToHalfKg(value: number): number {
  return Math.ceil(value * 2) / 2;
}

/** Resume peso bruto, volumétrico e taxável de um conjunto de volumes — mesma fórmula IATA do backend. */
export function summarizeChargeableWeight(pieces: PieceInput[]): ChargeableWeightSummary {
  let count = 0;
  let grossTotal = 0;
  let volumeTotal = 0;
  let volumetricTotal = 0;

  for (const piece of pieces) {
    const qty = Math.max(0, piece.quantity || 0);
    count += qty;
    grossTotal += piece.grossWeightKg * qty;
    volumeTotal += (piece.lengthCm * piece.widthCm * piece.heightCm * qty) / 1_000_000;
    volumetricTotal += ((piece.lengthCm * piece.widthCm * piece.heightCm) / 6000) * qty;
  }

  return {
    pieces: count,
    grossWeightKg: grossTotal,
    volumeM3: volumeTotal,
    volumetricWeightKg: volumetricTotal,
    chargeableWeightKg: roundUpToHalfKg(Math.max(grossTotal, volumetricTotal)),
  };
}
