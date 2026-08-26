import { StorageLocation } from "../../types/domain";
import { occupancyPercent } from "./occupancy";
import { EmptyState } from "../ui/EmptyState";
import { AnimatedBar } from "../ui/AnimatedBar";
import { LocationLabel } from "./LocationLabel";

export function LocationDetailPanel({ location }: { location: StorageLocation | null }) {
  if (!location) {
    return (
      <div className="animate-fade-in rounded-xl border border-[var(--color-grid)] bg-[var(--color-surface-1)] p-5">
        <EmptyState message="Selecione uma posição no mapa para ver o stock alocado." />
      </div>
    );
  }

  const pct = occupancyPercent(location.occupiedUnits, location.capacityUnits);

  return (
    <div
      key={location.id}
      className="animate-fade-up rounded-xl border border-[var(--color-grid)] bg-[var(--color-surface-1)] p-5"
    >
      <p className="font-mono text-xs text-[var(--color-text-muted)]">{location.uniqueAddress}</p>
      <h3 className="mt-1 text-lg font-semibold">Posição {location.code}</h3>

      <div className="mt-3 flex items-center gap-3">
        <AnimatedBar pct={pct ?? 0} color="var(--color-series-1)" trackClassName="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-grid)]" />
        <span className="tabular text-xs font-medium text-[var(--color-text-secondary)]">
          {pct === null ? "capacidade n/d" : `${pct}% ocupado`}
        </span>
      </div>
      <p className="tabular mt-1 text-xs text-[var(--color-text-muted)]">
        {location.occupiedUnits} / {location.capacityUnits ?? "?"} unidades
      </p>

      <h4 className="mt-5 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        Stock nesta posição
      </h4>
      {location.stockItems.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">Posição vazia.</p>
      ) : (
        <ul className="mt-2 divide-y divide-[var(--color-grid)]">
          {location.stockItems.map((item, i) => (
            <li key={item.id} className="animate-fade-up py-2" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{item.itemName}</p>
                <span className="text-sm tabular text-[var(--color-text-secondary)]">{item.quantity} un.</span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)]">
                SKU {item.sku}
                {item.batchNumber && ` · Lote ${item.batchNumber}`}
                {item.expiryDate && ` · Validade ${new Date(item.expiryDate).toLocaleDateString("pt-AO")}`}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5">
        <LocationLabel uniqueAddress={location.uniqueAddress} />
      </div>
    </div>
  );
}
