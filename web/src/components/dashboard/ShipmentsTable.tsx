import { useMemo, useState } from "react";
import {
  PROVINCE_NAME_PT,
  Shipment,
  ShipmentStatus,
  SHIPMENT_STATUS_LABEL_PT,
} from "../../types/domain";
import { StatusBadge } from "../ui/StatusBadge";
import { EmptyState } from "../ui/EmptyState";

type ModeFilter = "ALL" | "AIR" | "ROAD";

export function ShipmentsTable({ shipments }: { shipments: Shipment[] }) {
  const [mode, setMode] = useState<ModeFilter>("ALL");
  const [status, setStatus] = useState<ShipmentStatus | "ALL">("ALL");

  const filtered = useMemo(
    () =>
      shipments.filter(
        (s) => (mode === "ALL" || s.mode === mode) && (status === "ALL" || s.status === status)
      ),
    [shipments, mode, status]
  );

  const statuses = Array.from(new Set(shipments.map((s) => s.status)));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["ALL", "AIR", "ROAD"] as ModeFilter[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
              mode === m
                ? "border-[var(--color-series-1)] bg-[var(--color-series-1)]/10 text-[var(--color-series-1)]"
                : "border-[var(--color-grid)] text-[var(--color-text-secondary)]"
            }`}
          >
            {m === "ALL" ? "Todos os modos" : m === "AIR" ? "Aéreo" : "Terrestre"}
          </button>
        ))}

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ShipmentStatus | "ALL")}
          className="ml-auto rounded-md border border-[var(--color-grid)] bg-[var(--color-surface-1)] px-3 py-1.5 text-xs"
        >
          <option value="ALL">Todos os estados</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {SHIPMENT_STATUS_LABEL_PT[s]}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="Nenhum envio corresponde aos filtros selecionados." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-grid)] text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                <th className="py-2 pr-4 font-medium">Nº Envio</th>
                <th className="py-2 pr-4 font-medium">Modo</th>
                <th className="py-2 pr-4 font-medium">Origem → Destino</th>
                <th className="py-2 pr-4 font-medium">Expedidor / Destinatário</th>
                <th className="py-2 pr-4 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-[var(--color-grid)] last:border-0">
                  <td className="py-2.5 pr-4 font-mono text-xs">{s.shipmentNumber}</td>
                  <td className="py-2.5 pr-4">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                        s.mode === "AIR"
                          ? "bg-[var(--color-series-1)]/15 text-[var(--color-series-1)]"
                          : "bg-[var(--color-series-2)]/15 text-[var(--color-series-2)]"
                      }`}
                    >
                      {s.mode === "AIR" ? "Aéreo" : s.mode === "ROAD" ? "Terrestre" : "Multimodal"}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-[var(--color-text-secondary)]">
                    {s.originProvince
                      ? PROVINCE_NAME_PT[s.originProvince]
                      : s.originAirportCode ?? "—"}{" "}
                    →{" "}
                    {s.destinationProvince
                      ? PROVINCE_NAME_PT[s.destinationProvince]
                      : s.destinationAirportCode ?? "—"}
                  </td>
                  <td className="py-2.5 pr-4 text-[var(--color-text-secondary)]">
                    {s.shipperName} → {s.consigneeName}
                  </td>
                  <td className="py-2.5 pr-4">
                    <StatusBadge status={s.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
