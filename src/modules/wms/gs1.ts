/**
 * Construção de payloads GS1-128 (Application Identifiers).
 *
 * AIs suportados nesta implementação inicial:
 *   (01) GTIN-14           — comprimento fixo, 14 dígitos
 *   (10) Número de Lote    — comprimento variável, alfanumérico
 *   (17) Data de Validade  — comprimento fixo, formato YYMMDD
 *
 * Nota de produção: um GTIN é um identificador atribuído pela GS1 (via
 * associação nacional, ex. GS1 Angola) mediante prefixo de empresa — não deve
 * ser inventado em runtime. `deriveProvisionalGtin` só existe para ambientes
 * de desenvolvimento/demonstração, quando o Item ainda não tem GTIN oficial
 * atribuído; deve ser substituída por um campo `Item.gtin` real antes de
 * operar com parceiros que exijam GS1-128 válido (transportadoras, armazéns
 * de terceiros, etc.).
 */
import { ValidationError } from "../../lib/errors";

/** Group Separator (FNC1) — delimita campos de comprimento variável em GS1-128. */
export const GS1_GROUP_SEPARATOR = "";

export interface Gs1Input {
  gtin14: string;
  lot?: string;
  expiryDate?: Date;
}

function assertDigits(label: string, value: string, length: number): void {
  if (!new RegExp(`^\\d{${length}}$`).test(value)) {
    throw new ValidationError(`${label} deve ter exactamente ${length} dígitos numéricos.`);
  }
}

function formatYyMmDd(date: Date): string {
  const yy = String(date.getUTCFullYear() % 100).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

/**
 * Calcula o dígito verificador GTIN (módulo 10, pesos alternados 3/1 da
 * direita para a esquerda) e devolve o GTIN-14 completo.
 */
export function computeGtinCheckDigit(first13Digits: string): string {
  if (!/^\d{13}$/.test(first13Digits)) {
    throw new ValidationError("São necessários 13 dígitos para calcular o dígito verificador GTIN-14.");
  }
  const digits = first13Digits.split("").map(Number);
  let sum = 0;
  // da direita para a esquerda: peso 3, 1, 3, 1...
  for (let i = 0; i < digits.length; i++) {
    const weight = i % 2 === 0 ? 3 : 1;
    sum += digits[digits.length - 1 - i] * weight;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return `${first13Digits}${checkDigit}`;
}

/**
 * Gera um GTIN-14 PROVISÓRIO para ambientes de desenvolvimento a partir do
 * prefixo de país (789/790 = Angola, faixa GS1) e do SKU interno.
 * NÃO usar em produção sem um prefixo de empresa GS1 atribuído oficialmente.
 */
export function deriveProvisionalGtin(sku: string, companyPrefix = "789"): string {
  const numericSku = sku.replace(/\D/g, "").padStart(9, "0").slice(-9);
  const first13 = `0${companyPrefix}${numericSku}`.slice(0, 13).padEnd(13, "0");
  return computeGtinCheckDigit(first13);
}

/** Constrói o payload GS1-128 legível (parênteses) e o payload "raw" (com FNC1). */
export function buildGs1_128Payload(input: Gs1Input): { human: string; raw: string } {
  assertDigits("GTIN-14", input.gtin14, 14);

  const elements: { ai: string; value: string; fixedLength: boolean }[] = [
    { ai: "01", value: input.gtin14, fixedLength: true },
  ];

  if (input.expiryDate) {
    elements.push({ ai: "17", value: formatYyMmDd(input.expiryDate), fixedLength: true });
  }

  if (input.lot) {
    if (!/^[A-Z0-9-]{1,20}$/i.test(input.lot)) {
      throw new ValidationError("Número de lote inválido para codificação GS1-128.");
    }
    elements.push({ ai: "10", value: input.lot.toUpperCase(), fixedLength: false });
  }

  const human = elements.map((e) => `(${e.ai})${e.value}`).join("");

  // Em codificação "raw", campos de comprimento variável que não sejam o
  // último elemento devem ser terminados por FNC1 (GS). Como (10) é sempre
  // colocado por último aqui, não é necessário separador adicional — mas a
  // lógica está pronta para suportar mais AIs variáveis no futuro.
  let raw = "";
  elements.forEach((e, idx) => {
    raw += e.ai + e.value;
    const isLast = idx === elements.length - 1;
    if (!e.fixedLength && !isLast) raw += GS1_GROUP_SEPARATOR;
  });

  return { human, raw };
}
