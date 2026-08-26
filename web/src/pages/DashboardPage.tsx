import { useQuery } from "@tanstack/react-query";
import { fetchBillingSummary, fetchEmisPayments, fetchTrackingEvents, fetchWarehouseMap } from "../lib/api";
import { useShipments } from "../lib/ShipmentsContext";
import { OperationsDashboard } from "../components/dashboard/OperationsDashboard";

export default function DashboardPage() {
  const { shipments, isLoading: shipmentsLoading } = useShipments();
  const trackingQuery = useQuery({ queryKey: ["tracking-events"], queryFn: () => fetchTrackingEvents() });
  const paymentsQuery = useQuery({ queryKey: ["emis-payments"], queryFn: fetchEmisPayments });
  const warehouseQuery = useQuery({ queryKey: ["warehouse", "wh1"], queryFn: () => fetchWarehouseMap("wh1") });
  const billingQuery = useQuery({ queryKey: ["billing-summary"], queryFn: fetchBillingSummary });

  const isLoading =
    shipmentsLoading ||
    trackingQuery.isLoading ||
    paymentsQuery.isLoading ||
    warehouseQuery.isLoading ||
    billingQuery.isLoading;

  if (isLoading) {
    return <p className="text-sm text-[var(--color-text-muted)]">A carregar dashboard…</p>;
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Dashboard Multimodal de Operações</h1>
      <p className="mb-6 text-sm text-[var(--color-text-muted)]">
        Controlo unificado de expedição Aérea e Terrestre — nacional e internacional.
      </p>
      <OperationsDashboard
        shipments={shipments}
        trackingEvents={trackingQuery.data ?? []}
        emisPayments={paymentsQuery.data ?? []}
        warehouse={warehouseQuery.data}
        trackingUpdatedAt={trackingQuery.dataUpdatedAt}
        billing={billingQuery.data}
      />
    </div>
  );
}
