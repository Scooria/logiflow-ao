/**
 * Instância singleton do Prisma Client.
 *
 * Em desenvolvimento com hot-reload (ts-node-dev, next dev, etc.) reutiliza-se
 * a instância em `globalThis` para não esgotar o pool de ligações da base de
 * dados a cada recarregamento de módulo.
 *
 * IMPORTANTE: antes de usar este módulo é necessário correr `npx prisma
 * generate` (ver prisma/schema.prisma do Passo 1) para que o @prisma/client
 * seja gerado com os modelos/enums do domínio (Tenant, Warehouse, AirWaybill,
 * RoadWaybill, Transaction, etc.).
 */
import { PrismaClient } from "@prisma/client";
import { env } from "./env";

declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__prisma__ ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (env.NODE_ENV !== "production") {
  global.__prisma__ = prisma;
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
