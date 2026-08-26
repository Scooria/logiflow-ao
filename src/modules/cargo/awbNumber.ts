/**
 * Geração e validação do número de Air Waybill no formato IATA:
 *
 *   XXX-YYYYYYYC
 *   │    │      └ dígito verificador = (7 dígitos de série) mod 7
 *   │    └ 7 dígitos de série (0000001–9999999, ciclo por companhia aérea)
 *   └ prefixo de 3 dígitos da companhia aérea (ex.: 176 = Ethiopian, 649 = TAAG*)
 *
 * (*mero exemplo ilustrativo — o prefixo real de cada companhia aérea deve
 * ser confirmado junto da IATA / da própria transportadora.)
 */
import { ValidationError } from "../../lib/errors";

export function computeAwbCheckDigit(serial7: string): number {
  if (!/^\d{7}$/.test(serial7)) {
    throw new ValidationError("A série do AWB deve ter exactamente 7 dígitos.");
  }
  return Number(serial7) % 7;
}

/** Constrói um número de AWB formatado a partir do prefixo e de um contador sequencial. */
export function formatAwbNumber(airlinePrefix: string, sequence: number): string {
  if (!/^\d{3}$/.test(airlinePrefix)) {
    throw new ValidationError("O prefixo de companhia aérea deve ter exactamente 3 dígitos.");
  }
  if (sequence <= 0 || sequence > 9_999_999) {
    throw new ValidationError("A série do AWB deve estar entre 1 e 9999999.");
  }
  const serial7 = String(sequence).padStart(7, "0");
  const checkDigit = computeAwbCheckDigit(serial7);
  return `${airlinePrefix}-${serial7}${checkDigit}`;
}

/** Valida um número de AWB já formatado (ex.: recebido de um parceiro externo). */
export function isValidAwbNumber(awbNumber: string): boolean {
  const match = /^(\d{3})-(\d{7})(\d)$/.exec(awbNumber);
  if (!match) return false;
  const [, , serial7, checkDigit] = match;
  return computeAwbCheckDigit(serial7) === Number(checkDigit);
}
