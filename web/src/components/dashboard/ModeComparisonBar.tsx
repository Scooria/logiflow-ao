/**
 * Comparação de volume Aéreo vs Terrestre — duas categorias fixas (slot 1 =
 * azul = Aéreo, slot 2 = laranja = Terrestre), a mesma ordem em qualquer
 * parte da aplicação onde o modo apareça. Rótulos diretos (não só a legenda),
 * porque são apenas duas barras.
 */
import { Shipment } from "../../types/domain";
import { AnimatedBar } from "../ui/AnimatedBar";

export function ModeComparisonBar({ shipments }: { shipments: Shipment[] }) {
  const air = shipments.filter((s) => s.mode === "AIR").length;
  const road = shipments.filter((s) => s.mode === "ROAD").length;
  const max = Math.max(air, road, 1);

  const rows = [
    { label: "Aéreo", value: air, color: "var(--color-series-1)" },
    { label: "Terrestre", value: road, color: "var(--color-series-2)" },
  ];

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-medium text-[var(--color-text-secondary)]">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.color }} aria-hidden="true" />
              {row.label}
            </span>
            <span className="tabular font-semibold text-[var(--color-text-primary)]">{row.value}</span>
          </div>
          <AnimatedBar pct={(row.value / max) * 100} color={row.color} />
        </div>
      ))}
    </div>
  );
}
