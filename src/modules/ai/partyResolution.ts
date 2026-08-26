/**
 * Resolve um nome/NIF extraído de um documento para um `Party` existente,
 * ou cria um novo — a ligação entre "texto livre extraído pela IA" e
 * "registo relacional que os serviços de emissão de AWB/Guia exigem"
 * (ver airWaybill.service.ts / roadWaybill.service.ts do Passo 2).
 *
 * Critério de correspondência, por ordem: NIF exacto (mais fiável) -> nome
 * exacto (case-insensitive). Sem correspondência, cria um novo Party
 * marcado como proveniente de extração automática, para que a equipa possa
 * depois rever/consolidar duplicados com confiança semelhante.
 */
import { Province } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ValidationError } from "../../lib/errors";

export async function resolveOrCreateParty(params: {
  tenantId: string;
  name: string | null;
  nif?: string | null;
  province?: Province | null;
}): Promise<{ id: string; name: string; wasCreated: boolean }> {
  if (!params.name || params.name.trim().length === 0) {
    throw new ValidationError(
      "Não é possível resolver um parceiro comercial sem nome — reveja a extração antes de continuar."
    );
  }
  const name = params.name.trim();

  if (params.nif) {
    const byNif = await prisma.party.findFirst({
      where: { tenantId: params.tenantId, nif: params.nif },
    });
    if (byNif) return { id: byNif.id, name: byNif.name, wasCreated: false };
  }

  const byName = await prisma.party.findFirst({
    where: { tenantId: params.tenantId, name: { equals: name, mode: "insensitive" } },
  });
  if (byName) return { id: byName.id, name: byName.name, wasCreated: false };

  const created = await prisma.party.create({
    data: {
      tenantId: params.tenantId,
      type: "COMPANY",
      name,
      nif: params.nif ?? undefined,
      province: params.province ?? undefined,
      country: "AO",
    },
  });
  return { id: created.id, name: created.name, wasCreated: true };
}
