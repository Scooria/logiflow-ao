import { useState } from "react";
import { StorageLocation, Warehouse } from "../../types/domain";
import { occupancyColor, occupancyPercent, occupancyTextColor } from "./occupancy";
import { LocationDetailPanel } from "./LocationDetailPanel";
import { PROVINCE_NAME_PT } from "../../types/domain";

function PositionCell({
  location,
  isSelected,
  onSelect,
}: {
  location: StorageLocation;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const pct = occupancyPercent(location.occupiedUnits, location.capacityUnits);
  return (
    <button
      type="button"
      onClick={onSelect}
      title={`${location.uniqueAddress} — ${pct === null ? "capacidade n/d" : `${pct}% ocupado`}`}
      className={`flex h-14 w-16 flex-col items-center justify-center rounded-md border text-xs font-semibold transition-transform hover:scale-[1.04] ${
        isSelected ? "ring-2 ring-[var(--color-series-1)] ring-offset-1" : "border-[var(--color-grid)]"
      }`}
      style={{
        backgroundColor: occupancyColor(location.occupiedUnits, location.capacityUnits),
        color: occupancyTextColor(location.occupiedUnits, location.capacityUnits),
      }}
    >
      <span>{location.code}</span>
      <span className="text-[10px] font-normal opacity-90 tabular">{pct === null ? "—" : `${pct}%`}</span>
    </button>
  );
}

function OccupancyLegend() {
  const steps = [0, 20, 40, 60, 80, 100];
  return (
    <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
      <span>Ocupação:</span>
      <div className="flex overflow-hidden rounded">
        {steps.map((s) => (
          <div
            key={s}
            className="h-3 w-6"
            style={{ backgroundColor: occupancyColor(s, 100) }}
            aria-hidden="true"
          />
        ))}
      </div>
      <span>0%</span>
      <span className="mx-1">→</span>
      <span>100%</span>
    </div>
  );
}

export function WarehouseMap({ warehouse }: { warehouse: Warehouse }) {
  const [activeZoneId, setActiveZoneId] = useState(warehouse.zones[0]?.id);
  const [selectedLocation, setSelectedLocation] = useState<StorageLocation | null>(null);

  const activeZone = warehouse.zones.find((z) => z.id === activeZoneId) ?? warehouse.zones[0];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <div className="rounded-xl border border-[var(--color-grid)] bg-[var(--color-surface-1)] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">
              {warehouse.name} <span className="text-[var(--color-text-muted)]">({warehouse.code})</span>
            </h2>
            <p className="text-xs text-[var(--color-text-muted)]">{PROVINCE_NAME_PT[warehouse.province]}</p>
          </div>
          <OccupancyLegend />
        </div>

        {warehouse.zones.length > 1 && (
          <div className="mb-4 flex gap-1 rounded-lg bg-[var(--color-page)] p-1">
            {warehouse.zones.map((zone) => (
              <button
                key={zone.id}
                onClick={() => setActiveZoneId(zone.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  zone.id === activeZone?.id
                    ? "bg-[var(--color-surface-1)] shadow-sm"
                    : "text-[var(--color-text-secondary)]"
                }`}
              >
                {zone.name}
              </button>
            ))}
          </div>
        )}

        {activeZone && (
          <div className="space-y-6">
            {activeZone.racks.map((rack) => (
              <div key={rack.id}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  Rack {rack.code}
                </p>
                <div className="space-y-2">
                  {rack.shelves.map((shelf) => (
                    <div key={shelf.id} className="flex items-center gap-2">
                      <span className="w-10 shrink-0 font-mono text-[10px] text-[var(--color-text-muted)]">
                        {shelf.code}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {shelf.positions.map((position) => (
                          <PositionCell
                            key={position.id}
                            location={position}
                            isSelected={selectedLocation?.id === position.id}
                            onSelect={() => setSelectedLocation(position)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <LocationDetailPanel location={selectedLocation} />
    </div>
  );
}
