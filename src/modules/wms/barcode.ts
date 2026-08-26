/**
 * Geração de códigos de barra/QR (Code-128, GS1-128, QR Code) e associação
 * instantânea a Item, Batch e/ou StorageLocation.
 *
 * A renderização gráfica (barras/módulos QR -> SVG) é delegada à biblioteca
 * `bwip-js` (pura em JavaScript, sem dependências nativas de canvas), que
 * implementa as especificações Code-128/GS1-128/QR de forma testada — a
 * lógica própria desta plataforma foca-se na CONSTRUÇÃO DO PAYLOAD correcto
 * (endereço WMS, AIs GS1) e na sua PERSISTÊNCIA/associação no domínio.
 */
import bwipjs from "bwip-js";
import { BarcodeSymbology } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { NotFoundError, ValidationError } from "../../lib/errors";
import { buildGs1_128Payload, deriveProvisionalGtin } from "./gs1";

export interface RenderedBarcode {
  value: string;
  symbology: BarcodeSymbology;
  svg: string;
}

const BWIP_BCID: Record<BarcodeSymbology, string> = {
  CODE_128: "code128",
  GS1_128: "gs1-128",
  QR_CODE: "qrcode",
};

/** Renderiza um valor já construído para SVG, sem tocar na base de dados. */
export async function renderBarcodeSvg(
  symbology: BarcodeSymbology,
  value: string
): Promise<string> {
  try {
    return await bwipjs.toSVG({
      bcid: BWIP_BCID[symbology],
      text: value,
      scale: 3,
      height: symbology === "QR_CODE" ? 25 : 10,
      includetext: symbology !== "QR_CODE",
      textxalign: "center",
    });
  } catch (err) {
    throw new ValidationError(
      `Não foi possível renderizar código de barras (${symbology}): ${(err as Error).message}`
    );
  }
}

/**
 * Gera e persiste um código de barras GS1-128 para um Item (+ Batch opcional),
 * cobrindo GTIN, lote e validade — usado na entrada de mercadoria em armazém.
 */
export async function generateItemBarcode(params: {
  tenantId: string;
  itemId: string;
  batchId?: string;
  gtin14?: string;
}): Promise<{ barcodeId: string; value: string; svg: string; humanReadable: string }> {
  const item = await prisma.item.findFirst({
    where: { id: params.itemId, tenantId: params.tenantId },
  });
  if (!item) throw new NotFoundError("Item", params.itemId);

  let batch = null;
  if (params.batchId) {
    batch = await prisma.batch.findFirst({
      where: { id: params.batchId, itemId: params.itemId },
    });
    if (!batch) throw new NotFoundError("Batch", params.batchId);
  }

  const gtin14 = params.gtin14 ?? deriveProvisionalGtin(item.sku);
  const { human, raw } = buildGs1_128Payload({
    gtin14,
    lot: batch?.batchNumber,
    expiryDate: batch?.expiryDate ?? undefined,
  });

  const svg = await renderBarcodeSvg("GS1_128", raw);

  const barcode = await prisma.barcode.create({
    data: {
      tenantId: params.tenantId,
      symbology: "GS1_128",
      value: raw,
      itemId: item.id,
      batchId: batch?.id,
      gs1AiPayload: {
        gtin: gtin14,
        lot: batch?.batchNumber ?? null,
        expiryDate: batch?.expiryDate?.toISOString() ?? null,
        humanReadable: human,
      },
    },
  });

  return { barcodeId: barcode.id, value: raw, svg, humanReadable: human };
}

/**
 * Gera e persiste o código de barras Code-128 de uma StorageLocation a
 * partir do seu `uniqueAddress` (deve ser chamado depois de
 * `computeAndPersistLocationAddress`, ver addressing.ts).
 */
export async function generateLocationBarcode(params: {
  tenantId: string;
  locationId: string;
}): Promise<{ barcodeId: string; value: string; svg: string }> {
  const location = await prisma.storageLocation.findUnique({
    where: { id: params.locationId },
  });
  if (!location) throw new NotFoundError("StorageLocation", params.locationId);
  if (!location.uniqueAddress) {
    throw new ValidationError(
      "A posição ainda não tem uniqueAddress calculado — chame computeAndPersistLocationAddress primeiro."
    );
  }

  const svg = await renderBarcodeSvg("CODE_128", location.uniqueAddress);

  const barcode = await prisma.barcode.create({
    data: {
      tenantId: params.tenantId,
      symbology: "CODE_128",
      value: location.uniqueAddress,
      locationId: location.id,
    },
  });

  return { barcodeId: barcode.id, value: location.uniqueAddress, svg };
}

/**
 * Gera um QR Code "de conveniência" que embrulha o endereço WMS + SKU + lote
 * num único payload JSON compacto — útil para apps móveis que preferem ler
 * um único código em vez de cruzar Code-128 de posição + GS1-128 de item.
 */
export async function generateCompositeQrCode(params: {
  tenantId: string;
  itemId: string;
  batchId?: string;
  locationId?: string;
}): Promise<{ barcodeId: string; value: string; svg: string }> {
  const payload = JSON.stringify({
    t: params.tenantId,
    i: params.itemId,
    b: params.batchId ?? null,
    l: params.locationId ?? null,
    ts: Date.now(),
  });

  const svg = await renderBarcodeSvg("QR_CODE", payload);

  const barcode = await prisma.barcode.create({
    data: {
      tenantId: params.tenantId,
      symbology: "QR_CODE",
      value: payload,
      itemId: params.itemId,
      batchId: params.batchId,
      locationId: params.locationId,
    },
  });

  return { barcodeId: barcode.id, value: payload, svg };
}

/**
 * Regista uma leitura de scanner (câmara do dispositivo ou leitor dedicado),
 * usada pelo painel WMS (Passo 3) para dar entrada/saída de stock em tempo
 * real. Devolve o Barcode lido com as suas associações, para a UI decidir o
 * próximo passo do fluxo (ex.: pedir quantidade, confirmar localização destino).
 */
export async function registerBarcodeScan(params: {
  tenantId: string;
  barcodeValue: string;
  action: "INBOUND" | "OUTBOUND" | "TRANSFER" | "CYCLE_COUNT" | "PICK" | "PUTAWAY";
  scannedByUserId: string;
  deviceId?: string;
}) {
  const barcode = await prisma.barcode.findFirst({
    where: { value: params.barcodeValue, tenantId: params.tenantId },
    include: { item: true, batch: true, location: true },
  });

  if (!barcode) {
    throw new NotFoundError("Barcode", params.barcodeValue);
  }

  await prisma.barcodeScanEvent.create({
    data: {
      tenantId: params.tenantId,
      barcodeId: barcode.id,
      action: params.action,
      scannedByUserId: params.scannedByUserId,
      deviceId: params.deviceId,
    },
  });

  return barcode;
}
