/**
 * Geração de números de documento (Guia de Transporte Rodoviário) e do
 * código de validação digital junto à AGT.
 *
 * NOTA IMPORTANTE sobre `computeLocalAgtValidationCode`: a validação digital
 * real de Guias de Remessa/Transporte junto da AGT (Angola) exige comunicação
 * com o Sistema de Facturação Certificado / webservice da AGT, que devolve um
 * código oficial. A função abaixo gera apenas um HASH LOCAL determinístico
 * (não é um código AGT válido) para permitir desenvolver e testar o fluxo
 * antes da integração real estar disponível — deve ser substituída pela
 * chamada ao serviço da AGT antes de operar em produção.
 */
import { randomBytes, createHash } from "node:crypto";
import { Province } from "@prisma/client";
import { PROVINCE_CODE } from "../../config/provinces";

export function generateRoadGuideNumber(origin: Province, destination: Province, at = new Date()): string {
  const originCode = PROVINCE_CODE[origin];
  const destCode = PROVINCE_CODE[destination];
  const datePart = at.toISOString().slice(0, 10).replace(/-/g, "");
  const randomSuffix = randomBytes(3).toString("hex").toUpperCase();
  return `GTR-${originCode}${destCode}-${datePart}-${randomSuffix}`;
}

export function computeLocalAgtValidationCode(payload: Record<string, unknown>): string {
  const hash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  return `LOCAL-${hash.slice(0, 16).toUpperCase()}`;
}

export function generateShipmentNumber(prefix: "AIR" | "ROAD" | "MTM", at = new Date()): string {
  const datePart = at.toISOString().slice(0, 10).replace(/-/g, "");
  const randomSuffix = randomBytes(4).toString("hex").toUpperCase();
  return `SHP-${prefix}-${datePart}-${randomSuffix}`;
}
