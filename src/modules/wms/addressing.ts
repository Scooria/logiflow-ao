/**
 * Endereçamento único WMS.
 *
 * Hierarquia: País / Província / Armazém / Zona / Rack / Prateleira / Posição
 * Formato:    AO -   LUA     -   WH1    -  ZA  -  R04 -    L02     -   B12
 *
 * O endereço é calculado a partir da cadeia de FKs (Warehouse -> Zone -> Rack
 * -> Shelf -> StorageLocation) e persistido em `StorageLocation.uniqueAddress`
 * para leitura rápida (evita 4 JOINs em cada consulta de picking).
 */
import { Province } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { NotFoundError, ValidationError } from "../../lib/errors";
import { PROVINCE_CODE } from "../../config/provinces";

const COUNTRY_CODE = "AO";
const SEGMENT_PATTERN = /^[A-Z0-9]{1,6}$/;

export interface AddressSegments {
  province: Province;
  warehouseCode: string;
  zoneCode: string;
  rackCode: string;
  shelfCode: string;
  positionCode: string;
}

/** Valida que um segmento de código (WH1, ZA, R04, ...) só contém A-Z/0-9. */
function assertValidSegment(label: string, value: string): void {
  if (!SEGMENT_PATTERN.test(value)) {
    throw new ValidationError(
      `Segmento "${label}" inválido: "${value}". Use apenas letras maiúsculas e dígitos (máx. 6 caracteres).`
    );
  }
}

/** Constrói o endereço único a partir dos segmentos já normalizados (maiúsculas). */
export function buildUniqueAddress(segments: AddressSegments): string {
  const {
    province,
    warehouseCode,
    zoneCode,
    rackCode,
    shelfCode,
    positionCode,
  } = segments;

  const provinceCode = PROVINCE_CODE[province];
  if (!provinceCode) {
    throw new ValidationError(`Província desconhecida: ${province}`);
  }

  const parts = [warehouseCode, zoneCode, rackCode, shelfCode, positionCode].map((s) =>
    s.toUpperCase()
  );
  parts.forEach((p, i) =>
    assertValidSegment(["armazém", "zona", "rack", "prateleira", "posição"][i], p)
  );

  return [COUNTRY_CODE, provinceCode, ...parts].join("-");
}

/** Operação inversa: decompõe um endereço único nos seus segmentos. */
export function parseUniqueAddress(address: string): {
  country: string;
  provinceCode: string;
  warehouseCode: string;
  zoneCode: string;
  rackCode: string;
  shelfCode: string;
  positionCode: string;
} {
  const segments = address.split("-");
  if (segments.length !== 7) {
    throw new ValidationError(
      `Endereço único inválido: "${address}". Formato esperado AO-PPP-WHx-ZZ-Rxx-Lxx-Bxx.`
    );
  }
  const [country, provinceCode, warehouseCode, zoneCode, rackCode, shelfCode, positionCode] =
    segments;
  return { country, provinceCode, warehouseCode, zoneCode, rackCode, shelfCode, positionCode };
}

/**
 * Cria (ou recalcula) o `uniqueAddress` de uma StorageLocation a partir da
 * hierarquia relacional já persistida (shelf -> rack -> zone -> warehouse).
 * Também gera o valor de código de barras associado à posição (Code-128).
 */
export async function computeAndPersistLocationAddress(storageLocationId: string) {
  const location = await prisma.storageLocation.findUnique({
    where: { id: storageLocationId },
    include: {
      shelf: {
        include: {
          rack: {
            include: {
              zone: {
                include: { warehouse: true },
              },
            },
          },
        },
      },
    },
  });

  if (!location) {
    throw new NotFoundError("StorageLocation", storageLocationId);
  }

  const { shelf } = location;
  const { rack } = shelf;
  const { zone } = rack;
  const { warehouse } = zone;

  const uniqueAddress = buildUniqueAddress({
    province: warehouse.province,
    warehouseCode: warehouse.code,
    zoneCode: zone.code,
    rackCode: rack.code,
    shelfCode: shelf.code,
    positionCode: location.code,
  });

  return prisma.storageLocation.update({
    where: { id: storageLocationId },
    data: { uniqueAddress, barcodeValue: uniqueAddress },
  });
}

/**
 * Recalcula em massa os endereços de todas as posições de um armazém — útil
 * após reestruturação física (renomear zona/rack) ou migração inicial de dados.
 */
export async function recomputeWarehouseAddresses(warehouseId: string): Promise<number> {
  const locations = await prisma.storageLocation.findMany({
    where: { shelf: { rack: { zone: { warehouseId } } } },
    select: { id: true },
  });

  let updated = 0;
  for (const loc of locations) {
    await computeAndPersistLocationAddress(loc.id);
    updated += 1;
  }
  return updated;
}
