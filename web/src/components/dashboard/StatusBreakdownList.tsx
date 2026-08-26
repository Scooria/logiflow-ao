/**
 * Distribuição por estado — codificada por SEMÂNTICA de estado (paleta
 * status: neutro/progresso/bom/aviso/crítico), não por 11 matizes
 * categóricas distintas (o enum ShipmentStatus tem 11 valores; usar a
 * paleta categórica aqui ultrapassaria o tecto de identidades distintas
 * legíveis e obrigaria a reciclar matizes). Ordenado por contagem
 * decrescente; a cor nunca é a única pista — cada linha tem rótulo.
 */
import { SHIPMENT_STATUS_LABEL_PT, SHIPMENT_STATUS_SEMANTIC, Shipment, ShipmentStatus } from "../../types/domain";
import { AnimatedBar } from "../ui/AnimatedBar";

const SEMANTIC_COLOR: Record<string, string> = {
  neutral: "var(--color-baseline)",
  progress: "var(--color-series-1)",
  good: "var(--color-status-good)",
  warning: "var(--color-status-warning)",
  critical: "var(--color-status-critical)",
};

export function StatusBreakdownList({ shipments }: { shipments: Shipment[] }) {
  const counts = new Map<ShipmentStatus, number>();
  shipments.forEach((s) => counts.set(s.status, (counts.get(s.status) ?? 0) + 1));

  const rows = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const max = Math.max(...rows.map(([, count]) => count), 1);

  if (rows.length === 0) {
    return <p className="text-sm text-[var(--color-text-muted)]">Sem envios registados.</p>;
  }

  return (
    <ul className="space-y-2.5">
      {rows.map(([status, count]) => {
        const semantic = SHIPMENT_STATUS_SEMANTIC[status];
        return (
          <li key={status}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-[var(--color-text-secondary)]">{SHIPMENT_STATUS_LABEL_PT[status]}</span>
              <span className="tabular font-semibold">{count}</span>
            </div>
            <AnimatedBar
              pct={(count / max) * 100}
              color={SEMANTIC_COLOR[semantic]}
              trackClassName="h-2 w-full overflow-hidden rounded-full bg-[var(--color-grid)]"
            />
          </li>
        );
      })}
    </ul>
  );
}
