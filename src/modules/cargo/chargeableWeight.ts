/**
 * Cálculo de peso taxável para frete aéreo, segundo a convenção IATA:
 *
 *   peso volumétrico (kg) = (Comprimento x Largura x Altura em cm) / 6000
 *   peso taxável          = MAIOR valor entre peso bruto real e peso volumétrico
 *
 * O resultado final é arredondado para cima ao meio-quilo mais próximo (0.5kg),
 * convenção também usual na tarifação IATA para frete aéreo.
 */
import { ValidationError } from "../../lib/errors";

export const IATA_VOLUMETRIC_DIVISOR = 6000;

export interface PieceDimensions {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  grossWeightKg: number;
}

function assertPositive(label: string, value: number): void {
  if (!(value > 0)) {
    throw new ValidationError(`${label} deve ser um valor positivo (recebido: ${value}).`);
  }
}

/** Arredonda para cima ao múltiplo de 0.5 mais próximo (convenção IATA). */
export function roundUpToHalfKg(value: number): number {
  return Math.ceil(value * 2) / 2;
}

export function volumetricWeightKg(piece: PieceDimensions): number {
  assertPositive("comprimento", piece.lengthCm);
  assertPositive("largura", piece.widthCm);
  assertPositive("altura", piece.heightCm);
  return (piece.lengthCm * piece.widthCm * piece.heightCm) / IATA_VOLUMETRIC_DIVISOR;
}

export function volumeM3(piece: PieceDimensions): number {
  return (piece.lengthCm * piece.widthCm * piece.heightCm) / 1_000_000;
}

/** Peso taxável de UMA peça: maior valor entre peso bruto e peso volumétrico. */
export function chargeableWeightForPiece(piece: PieceDimensions): number {
  assertPositive("peso bruto", piece.grossWeightKg);
  const volumetric = volumetricWeightKg(piece);
  return roundUpToHalfKg(Math.max(piece.grossWeightKg, volumetric));
}

export interface AwbWeightSummary {
  pieces: number;
  grossWeightKg: number;
  volumeM3: number;
  volumetricWeightKg: number;
  chargeableWeightKg: number;
}

/**
 * Consolida o resumo de peso/volume de um AWB a partir das suas peças
 * individuais — usado ao emitir a guia aérea (ver awb.service.ts) e para
 * preencher o payload IATA CargoXML (campos GrossWeight/ChargeableWeight).
 */
export function summarizeAwbWeights(pieces: PieceDimensions[]): AwbWeightSummary {
  if (pieces.length === 0) {
    throw new ValidationError("O AWB precisa de pelo menos uma peça/volume.");
  }

  const grossWeightKg = pieces.reduce((sum, p) => sum + p.grossWeightKg, 0);
  const totalVolumeM3 = pieces.reduce((sum, p) => sum + volumeM3(p), 0);
  const totalVolumetricWeightKg = pieces.reduce((sum, p) => sum + volumetricWeightKg(p), 0);

  // Peso taxável total = maior entre peso bruto total e peso volumétrico
  // total, arredondado — e NÃO a soma dos arredondamentos por peça, para
  // evitar sobre-cobrança por acumulação de arredondamentos.
  const chargeableWeightKg = roundUpToHalfKg(Math.max(grossWeightKg, totalVolumetricWeightKg));

  return {
    pieces: pieces.length,
    grossWeightKg: Number(grossWeightKg.toFixed(3)),
    volumeM3: Number(totalVolumeM3.toFixed(4)),
    volumetricWeightKg: Number(totalVolumetricWeightKg.toFixed(3)),
    chargeableWeightKg,
  };
}
