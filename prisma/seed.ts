/**
 * Seed de dados de demonstração — popula uma base de dados Postgres vazia
 * com um tenant, armazém (com hierarquia WMS completa e stock), parceiros,
 * expedições Aéreas/Terrestres com rastreamento, pagamentos EMIS e faturas,
 * suficiente para que TODOS os ecrãs do frontend (Dashboard, Nova
 * Expedição, Painel WMS, Pagamentos) mostrem dados reais assim que
 * `VITE_API_BASE_URL` estiver configurado — em vez do mock estático
 * (web/src/lib/mockData.ts) usado em modo demonstração.
 *
 * Como correr (numa máquina/CI com acesso normal à internet — ver nota em
 * prisma.config.ts sobre o bloqueio de rede específico deste sandbox):
 *
 *   npx prisma generate
 *   npx prisma migrate dev --name init
 *   npx prisma db seed
 *
 * O tenant e o utilizador de demonstração usam IDs fixos ("demo-tenant" /
 * "demo-user") que coincidem com os valores por omissão de
 * VITE_DEMO_TENANT_ID / VITE_DEMO_USER_ID no frontend (ver web/.env.example
 * e web/src/lib/api.ts), para que não seja preciso configurar mais nada.
 */
import { PrismaClient } from "@prisma/client";
import { formatAwbNumber } from "../src/modules/cargo/awbNumber";
import { generateRoadGuideNumber, generateShipmentNumber } from "../src/modules/cargo/documentCodes";

const prisma = new PrismaClient();

const TENANT_ID = "demo-tenant";
const USER_ID = "demo-user";

async function main() {
  console.log("A limpar dados de demonstração anteriores (se existirem)...");
  // StockItem não tem `onDelete: Cascade` a partir de Warehouse/StorageLocation/
  // Item no schema (Passo 1) — se não for apagado explicitamente primeiro, a
  // BD recusa apagar essas linhas (violação de FK) numa segunda execução do
  // seed. O resto do grafo do tenant cascata normalmente a partir daqui.
  await prisma.stockItem.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.tenant.deleteMany({ where: { id: TENANT_ID } }); // cascade apaga tudo o resto do tenant

  console.log("A criar tenant e utilizador...");
  await prisma.tenant.create({
    data: {
      id: TENANT_ID,
      name: "LogiFlow AO — Demonstração",
      legalName: "LogiFlow Angola, Lda.",
      nif: "5417000000",
      country: "AO",
      defaultCurrency: "AOA",
    },
  });
  await prisma.user.create({
    data: {
      id: USER_ID,
      tenantId: TENANT_ID,
      email: "operacoes@logiflow.ao",
      passwordHash: "seed-only-not-a-real-hash",
      name: "Equipa de Operações",
      role: "OPERATIONS_MANAGER",
    },
  });

  console.log("A criar armazém e hierarquia WMS (WH1 — Luanda)...");
  const warehouse = await prisma.warehouse.create({
    data: {
      tenantId: TENANT_ID,
      code: "WH1",
      name: "Armazém Central Luanda",
      province: "LUANDA",
      address: "Zona Industrial do Viana, Luanda",
    },
  });

  const item1 = await prisma.item.create({
    data: {
      tenantId: TENANT_ID,
      sku: "CIM-050",
      name: "Cimento Portland 50kg",
      unitOfMeasure: "SC",
      weightKg: 50,
      requiresBatchTracking: true,
    },
  });
  const item2 = await prisma.item.create({
    data: {
      tenantId: TENANT_ID,
      sku: "PEC-A01",
      name: "Peças Sobressalentes — Kit A",
      unitOfMeasure: "CX",
      weightKg: 12.5,
    },
  });
  const batch1 = await prisma.batch.create({
    data: { itemId: item1.id, batchNumber: "L2608-A", expiryDate: new Date("2027-06-30") },
  });

  const zone = await prisma.warehouseZone.create({
    data: { warehouseId: warehouse.id, code: "ZA", name: "Zona A — Armazenagem Geral", type: "STORAGE" },
  });

  // AO-LUA-WH1-ZA-{rack}-{shelf}-{pos} — mesma convenção do frontend/backend (Passo 2/3).
  const layout: { rack: string; shelf: string; positions: { pos: string; capacity: number; occupied: number }[] }[] = [
    { rack: "R01", shelf: "L01", positions: [
      { pos: "B01", capacity: 50, occupied: 42 },
      { pos: "B02", capacity: 50, occupied: 12 },
      { pos: "B03", capacity: 50, occupied: 50 },
      { pos: "B04", capacity: 50, occupied: 0 },
    ] },
    { rack: "R01", shelf: "L02", positions: [
      { pos: "B01", capacity: 40, occupied: 30 },
      { pos: "B02", capacity: 40, occupied: 18 },
      { pos: "B03", capacity: 40, occupied: 40 },
    ] },
    { rack: "R02", shelf: "L01", positions: [
      { pos: "B01", capacity: 30, occupied: 6 },
      { pos: "B02", capacity: 30, occupied: 28 },
      { pos: "B03", capacity: 30, occupied: 0 },
    ] },
    { rack: "R02", shelf: "L02", positions: [
      { pos: "B01", capacity: 25, occupied: 19 },
      { pos: "B02", capacity: 25, occupied: 25 },
    ] },
  ];

  for (const rackDef of layout) {
    let rack = await prisma.rack.findFirst({ where: { zoneId: zone.id, code: rackDef.rack } });
    if (!rack) rack = await prisma.rack.create({ data: { zoneId: zone.id, code: rackDef.rack } });
    const shelf = await prisma.shelf.create({ data: { rackId: rack.id, code: rackDef.shelf } });

    for (const posDef of rackDef.positions) {
      const uniqueAddress = `AO-LUA-WH1-ZA-${rackDef.rack}-${rackDef.shelf}-${posDef.pos}`;
      const location = await prisma.storageLocation.create({
        data: {
          shelfId: shelf.id,
          code: posDef.pos,
          uniqueAddress,
          capacityUnits: posDef.capacity,
          barcodeValue: uniqueAddress,
        },
      });
      if (posDef.occupied > 0) {
        await prisma.stockItem.create({
          data: {
            tenantId: TENANT_ID,
            warehouseId: warehouse.id,
            locationId: location.id,
            itemId: item1.id,
            batchId: batch1.id,
            quantity: posDef.occupied,
          },
        });
      }
    }
  }

  console.log("A criar parceiros comerciais (shippers/consignees)...");
  const [sonangol, distribHuambo, refriango, importerUS] = await Promise.all([
    prisma.party.create({
      data: { tenantId: TENANT_ID, name: "Sonangol Distribuição", nif: "5401100000", province: "LUANDA", country: "AO" },
    }),
    prisma.party.create({
      data: { tenantId: TENANT_ID, name: "Distribuidora do Huambo", nif: "5402200000", province: "HUAMBO", country: "AO" },
    }),
    prisma.party.create({
      data: { tenantId: TENANT_ID, name: "Refriango Exportação", nif: "5403300000", province: "LUANDA", country: "AO" },
    }),
    prisma.party.create({
      data: { tenantId: TENANT_ID, name: "Importer Test Inc", country: "US" },
    }),
  ]);

  console.log("A criar aeroportos, veículo e motorista...");
  const [airportLAD, airportJFK] = await Promise.all([
    prisma.airport.upsert({
      where: { iataCode: "LAD" },
      create: { iataCode: "LAD", icaoCode: "FNLU", name: "Aeroporto Internacional 4 de Fevereiro", city: "Luanda", country: "AO" },
      update: {},
    }),
    prisma.airport.upsert({
      where: { iataCode: "JFK" },
      create: { iataCode: "JFK", icaoCode: "KJFK", name: "John F. Kennedy International Airport", city: "Nova Iorque", country: "US" },
      update: {},
    }),
  ]);
  const vehicle = await prisma.vehicle.create({
    data: { tenantId: TENANT_ID, plateNumber: "LD-45-67-AO", type: "CONTAINER_TRUCK", capacityKg: 24000 },
  });
  const driver = await prisma.driver.create({
    data: { tenantId: TENANT_ID, name: "Manuel dos Santos", licenseNumber: "AO-CH-88213" },
  });

  console.log("A criar expedições, AWB/Guias e rastreamento...");
  const now = new Date();

  async function createRoadShipment(opts: {
    shipperId: string;
    consigneeId: string;
    origin: "LUANDA" | "BENGUELA" | "ZAIRE";
    destination: "HUAMBO" | "CABINDA" | "HUILA";
    status: "IN_TRANSIT" | "DELIVERED" | "CUSTOMS_HOLD" | "OUT_FOR_DELIVERY";
    daysAgo: number;
  }) {
    const issuedAt = new Date(now.getTime() - opts.daysAgo * 86_400_000);
    const roadWaybill = await prisma.roadWaybill.create({
      data: {
        tenantId: TENANT_ID,
        guideNumber: generateRoadGuideNumber(opts.origin as never, opts.destination as never, issuedAt),
        shipperId: opts.shipperId,
        consigneeId: opts.consigneeId,
        originProvince: opts.origin as never,
        destinationProvince: opts.destination as never,
        vehicleId: vehicle.id,
        driverId: driver.id,
        totalWeightKg: 850,
        status: opts.status,
        issuedAt,
      },
    });
    const shipment = await prisma.shipment.create({
      data: {
        tenantId: TENANT_ID,
        shipmentNumber: generateShipmentNumber("ROAD", issuedAt),
        mode: "ROAD",
        status: opts.status,
        shipperId: opts.shipperId,
        consigneeId: opts.consigneeId,
        originWarehouseId: warehouse.id,
        roadWaybillId: roadWaybill.id,
        createdAt: issuedAt,
      },
    });
    await prisma.trackingEvent.create({
      data: {
        tenantId: TENANT_ID,
        shipmentId: shipment.id,
        status: "BOOKED",
        location: opts.origin,
        province: opts.origin as never,
        description: "Guia emitida e carga confirmada no armazém de origem.",
        source: "MANUAL",
        occurredAt: issuedAt,
      },
    });
    await prisma.trackingEvent.create({
      data: {
        tenantId: TENANT_ID,
        shipmentId: shipment.id,
        status: opts.status,
        location: opts.status === "DELIVERED" ? opts.destination : opts.origin,
        province: (opts.status === "DELIVERED" ? opts.destination : opts.origin) as never,
        description:
          opts.status === "DELIVERED"
            ? "Entrega confirmada pelo consignatário."
            : opts.status === "CUSTOMS_HOLD"
              ? "Guia retida para verificação documental na fronteira interprovincial."
              : "Em progresso na rota interprovincial.",
        source: "DRIVER_APP",
        occurredAt: new Date(issuedAt.getTime() + 3600_000 * 6),
      },
    });
    return shipment;
  }

  async function createAirShipment(opts: {
    shipperId: string;
    consigneeId: string;
    destinationAirportId: string;
    status: "IN_TRANSIT" | "DELIVERED" | "ARRIVED";
    daysAgo: number;
    sequence: number;
  }) {
    const issuedAt = new Date(now.getTime() - opts.daysAgo * 86_400_000);
    const airWaybill = await prisma.airWaybill.create({
      data: {
        tenantId: TENANT_ID,
        awbNumber: formatAwbNumber("649", opts.sequence), // 649 — mero exemplo ilustrativo, ver awbNumber.ts
        shipperId: opts.shipperId,
        consigneeId: opts.consigneeId,
        originAirportId: airportLAD.id,
        destinationAirportId: opts.destinationAirportId,
        pieces: 4,
        grossWeightKg: 320,
        chargeableWeightKg: 340,
        currency: "USD",
        status: opts.status,
        issuedAt,
      },
    });
    const shipment = await prisma.shipment.create({
      data: {
        tenantId: TENANT_ID,
        shipmentNumber: generateShipmentNumber("AIR", issuedAt),
        mode: "AIR",
        status: opts.status,
        shipperId: opts.shipperId,
        consigneeId: opts.consigneeId,
        originWarehouseId: warehouse.id,
        airWaybillId: airWaybill.id,
        createdAt: issuedAt,
      },
    });
    await prisma.trackingEvent.create({
      data: {
        tenantId: TENANT_ID,
        shipmentId: shipment.id,
        status: opts.status,
        location: "Luanda (LAD)",
        description: `Voo TP1234 descolou de Luanda (LAD) com destino a ${opts.destinationAirportId === airportJFK.id ? "JFK" : "destino"}.`,
        source: "ONE_RECORD",
        occurredAt: issuedAt,
      },
    });
    return shipment;
  }

  await createRoadShipment({
    shipperId: sonangol.id, consigneeId: distribHuambo.id,
    origin: "LUANDA", destination: "HUAMBO", status: "IN_TRANSIT", daysAgo: 2,
  });
  await createRoadShipment({
    shipperId: distribHuambo.id, consigneeId: sonangol.id,
    origin: "ZAIRE", destination: "CABINDA", status: "CUSTOMS_HOLD", daysAgo: 6,
  });
  await createRoadShipment({
    shipperId: refriango.id, consigneeId: distribHuambo.id,
    origin: "BENGUELA", destination: "HUILA", status: "DELIVERED", daysAgo: 10,
  });
  await createAirShipment({
    shipperId: refriango.id, consigneeId: importerUS.id,
    destinationAirportId: airportJFK.id, status: "IN_TRANSIT", daysAgo: 1, sequence: 1234567,
  });
  await createAirShipment({
    shipperId: sonangol.id, consigneeId: importerUS.id,
    destinationAirportId: airportJFK.id, status: "DELIVERED", daysAgo: 14, sequence: 2345671,
  });

  console.log("A criar pagamentos EMIS (Multicaixa) e faturas...");
  await prisma.transaction.create({
    data: {
      tenantId: TENANT_ID, type: "PAYMENT", method: "EMIS_REFERENCE", status: "PENDING",
      amount: 1_250_000, currency: "AOA", emisEntity: "00099", emisReference: "600 123 456",
      expiresAt: new Date(now.getTime() + 72 * 3600_000),
    },
  });
  await prisma.transaction.create({
    data: {
      tenantId: TENANT_ID, type: "PAYMENT", method: "EMIS_REFERENCE", status: "PAID",
      amount: 480_000, currency: "AOA", emisEntity: "00099", emisReference: "600 654 321",
      paidAt: new Date(now.getTime() - 2 * 86_400_000),
    },
  });

  const invoiceDefs = [
    { number: "A/2026/001", party: sonangol.id, currency: "AOA" as const, subtotal: 4_200_000 },
    { number: "A/2026/002", party: distribHuambo.id, currency: "AOA" as const, subtotal: 2_100_000 },
    { number: "A/2026/003", party: refriango.id, currency: "AOA" as const, subtotal: 9_500_000 },
    { number: "A/2026/004", party: importerUS.id, currency: "USD" as const, subtotal: 32_000 },
    { number: "A/2026/005", party: importerUS.id, currency: "USD" as const, subtotal: 18_500 },
  ];
  for (const inv of invoiceDefs) {
    const ivaAmount = inv.subtotal * 0.14;
    await prisma.invoice.create({
      data: {
        tenantId: TENANT_ID,
        invoiceNumber: inv.number,
        partyId: inv.party,
        currency: inv.currency,
        subtotal: inv.subtotal,
        ivaAmount,
        totalAmount: inv.subtotal + ivaAmount,
        status: "CERTIFIED_AGT",
        issuedAt: new Date(now.getFullYear(), now.getMonth(), Math.min(now.getDate(), 20)),
      },
    });
  }

  console.log("Seed concluído.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
