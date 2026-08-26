import { EmisPaymentSummary, Shipment, TrackingEvent, Warehouse } from "../../types/domain";
import { BillingSummary } from "../../lib/api";
import { StatTile } from "../ui/StatTile";
import { Card } from "../ui/Card";
import { LiveIndicator } from "../ui/LiveIndicator";
import { ModeComparisonBar } from "./ModeComparisonBar";
import { StatusBreakdownList } from "./StatusBreakdownList";
import { TrackingFeed } from "./TrackingFeed";
import { ShipmentsTable } from "./ShipmentsTable";
import { occupancyPercent } from "../wms/occupancy";

function computeWarehouseOccupancy(warehouse?: Warehouse): number | null {
  if (!warehouse) return null;
  const positions = warehouse.zones.flatMap((z) => z.racks.flatMap((r) => r.shelves.flatMap((s) => s.positions)));
  const withCapacity = positions.filter((p) => p.capacityUnits);
  if (withCapacity.length === 0) return null;
  const total = withCapacity.reduce((sum, p) => sum + (occupancyPercent(p.occupiedUnits, p.capacityUnits) ?? 0), 0);
  return Math.round(total / withCapacity.length);
}

export function OperationsDashboard({
  shipments,
  trackingEvents,
  emisPayments,
  warehouse,
  trackingUpdatedAt,
  billing,
}: {
  shipments: Shipment[];
  trackingEvents: TrackingEvent[];
  emisPayments: EmisPaymentSummary[];
  warehouse?: Warehouse;
  trackingUpdatedAt?: number;
  billing?: BillingSummary;
}) {
  const inTransit = shipments.filter((s) => s.status === "IN_TRANSIT" || s.status === "OUT_FOR_DELIVERY").length;
  const delivered = shipments.filter((s) => s.status === "DELIVERED").length;
  const customsHold = shipments.filter((s) => s.status === "CUSTOMS_HOLD").length;
  const pendingPayments = emisPayments.filter((p) => p.status === "PENDING" || p.status === "PROCESSING");
  const pendingAmount = pendingPayments.reduce((sum, p) => sum + p.amount, 0);
  const occupancy = computeWarehouseOccupancy(warehouse);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Total de Envios" countTo={shipments.length} hint="Aéreo + Terrestre" delayMs={0} />
        <StatTile label="Em Trânsito" countTo={inTransit} tone="warning" delayMs={60} />
        <StatTile label="Entregues" countTo={delivered} tone="good" delayMs={120} />
        <StatTile
          label="Retidos na Alfândega"
          countTo={customsHold}
          tone={customsHold > 0 ? "critical" : "neutral"}
          delayMs={180}
        />
        <StatTile
          label="Pagamentos EMIS Pendentes"
          countTo={pendingPayments.length}
          hint={`${pendingAmount.toLocaleString("pt-AO")} AOA`}
          tone={pendingPayments.length > 0 ? "warning" : "good"}
          delayMs={240}
        />
        <StatTile
          label="Ocupação WMS Média"
          value={occupancy === null ? "n/d" : undefined}
          countTo={occupancy === null ? undefined : occupancy}
          suffix="%"
          hint={warehouse?.name}
          delayMs={300}
        />
      </div>

      {billing && (
        <div className="grid grid-cols-2 gap-4 md:w-1/2">
          <StatTile
            label="Faturação do Mês (AOA)"
            countTo={billing.aoaThisMonth}
            thousands
            suffix=" Kz"
            hint="Frete nacional"
            delayMs={360}
          />
          <StatTile
            label="Faturação do Mês (USD)"
            countTo={billing.usdThisMonth}
            thousands
            prefix="$"
            hint="Clientes internacionais"
            delayMs={420}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Aéreo vs. Terrestre" subtitle="Volume de envios ativos">
          <ModeComparisonBar shipments={shipments} />
        </Card>
        <Card title="Distribuição por Estado" subtitle="Top 8 estados operacionais">
          <StatusBreakdownList shipments={shipments} />
        </Card>
        <Card
          title="Rastreamento em Tempo Real"
          subtitle="Últimos eventos (atualiza a cada 15s)"
          action={<LiveIndicator updatedAt={trackingUpdatedAt} />}
        >
          <TrackingFeed events={trackingEvents.slice(0, 5)} />
        </Card>
      </div>

      <Card title="Envios" subtitle="Nacional e internacional — filtre por modo e estado">
        <ShipmentsTable shipments={shipments} />
      </Card>
    </div>
  );
}
